const { randomInt } = require("node:crypto");
const urlRepository = require("../repositories/urlRepository");
const settings = require("../config/settings");

const CODE_LENGTH = 6;
const CODE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CODE_PATTERN = /^[A-Za-z0-9]{6}$/;
const MAX_URL_LENGTH = 2048;
const MAX_CODE_ATTEMPTS = 100;
const RESERVED_CODE_TTL_MS = 60_000;
const MAX_RESERVED_CODES = 10_000;
const reservedCodes = new Map();

/**
 * Error type for expected application failures.
 *
 * `statusCode` and `errorCode` are safe, machine-readable values that the HTTP
 * layer can map to a response. Unexpected infrastructure errors should remain
 * ordinary errors and be handled by the centralized error middleware.
 */
class AppError extends Error {
  /**
   * Create an operational application error.
   *
   * @param {string} message Human-readable internal error description.
   * @param {number} statusCode HTTP status associated with this failure.
   * @param {string} errorCode Stable machine-readable error identifier.
   * @param {ErrorOptions} [options] Optional native Error options, including cause.
   */
  constructor(message, statusCode, errorCode, options = {}) {
    super(message, options);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
  }
}

/**
 * Parse and validate a destination URL according to the shortener's policy.
 *
 * Only absolute HTTP and HTTPS URLs are accepted. Credentials are disallowed,
 * URLs are limited to 2048 characters, and the optional exact-host allowlist
 * from `SHORTENER_ALLOWED_HOSTS` is enforced here.
 *
 * @param {*} value Value supplied by a client or read from storage.
 * @returns {URL | null} Parsed URL when valid, otherwise `null`.
 */
function parseHttpUrl(value) {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    value.length > MAX_URL_LENGTH
  ) {
    return null;
  }

  try {
    const parsedUrl = new URL(value.trim());

    if (
      !["http:", "https:"].includes(parsedUrl.protocol) ||
      !parsedUrl.hostname ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return null;
    }

    if (parsedUrl.href.length > MAX_URL_LENGTH) {
      return null;
    }

    if (
      settings.allowedRedirectHosts.length > 0 &&
      !settings.allowedRedirectHosts.includes(parsedUrl.hostname.toLowerCase())
    ) {
      return null;
    }

    return parsedUrl;
  } catch {
    return null;
  }
}

/**
 * Check whether a value is an allowed absolute HTTP(S) URL.
 *
 * @param {*} url Candidate URL.
 * @returns {boolean} `true` when the URL satisfies the shortener policy.
 * @example
 * isvalidurl("https://example.com/docs"); // true
 * isvalidurl("javascript:alert(1)"); // false
 */
function isvalidurl(url) {
  return parseHttpUrl(url) !== null;
}

/**
 * Generate and temporarily reserve a unique six-character alphanumeric code.
 *
 * Cryptographically secure random selection is used for each character. The
 * function checks both the current in-process reservations and SQLite. A
 * reservation expires after one minute if the caller never saves the code.
 * Database uniqueness remains the final cross-process guarantee.
 *
 * @returns {string} Newly reserved short code.
 * @throws {AppError} When reservation capacity is full or no unique code can
 * be produced after the configured number of attempts.
 * @example
 * const code = createcode(); // e.g. "aB12xZ"
 */
function createcode() {
  const now = Date.now();

  for (const [reservedCode, expiresAt] of reservedCodes) {
    if (expiresAt <= now) {
      reservedCodes.delete(reservedCode);
    }
  }

  if (reservedCodes.size >= MAX_RESERVED_CODES) {
    throw new AppError(
      "Too many short codes are currently reserved.",
      503,
      "code-reservation-capacity-reached",
    );
  }

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    let code = "";

    for (let index = 0; index < CODE_LENGTH; index += 1) {
      code += CODE_CHARACTERS[randomInt(CODE_CHARACTERS.length)];
    }

    if (!reservedCodes.has(code) && !urlRepository.codeExists(code)) {
      reservedCodes.set(code, now + RESERVED_CODE_TTL_MS);
      return code;
    }
  }

  throw new AppError(
    "Unable to generate a unique short URL code.",
    503,
    "code-generation-unavailable",
  );
}

/**
 * Persist a URL mapping for a caller-supplied short code.
 *
 * The URL is normalized before storage. The code must contain exactly six
 * ASCII letters or digits. Existing codes are never overwritten.
 *
 * @param {*} url Destination URL to store.
 * @param {*} code Six-character code to associate with the URL.
 * @returns {true} Returns `true` after a successful insert.
 * @throws {AppError} With status 422 for invalid URL/code or 409 for duplicate
 * codes. Unexpected SQLite errors are propagated to the error middleware.
 * @example
 * saveurl("https://example.com", "Ab12Cd");
 */
function saveurl(url, code) {
  try {
    const parsedUrl = parseHttpUrl(url);

    if (!parsedUrl) {
      throw new AppError(
        "url must be a valid HTTP or HTTPS URL no longer than 2048 characters.",
        422,
        "invalid-url",
      );
    }

    if (typeof code !== "string" || !CODE_PATTERN.test(code)) {
      throw new AppError(
        "code must contain exactly six letters or numbers.",
        422,
        "invalid-code",
      );
    }

    urlRepository.insertUrl(code, parsedUrl.href);
    return true;
  } catch (error) {
    if (
      error.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
      error.code === "SQLITE_CONSTRAINT_UNIQUE"
    ) {
      throw new AppError(
        "The short code already exists.",
        409,
        "code-already-exists",
        { cause: error },
      );
    }

    throw error;
  } finally {
    if (typeof code === "string") {
      reservedCodes.delete(code);
    }
  }
}

/**
 * Retrieve the original destination URL for a stored short code.
 *
 * The stored URL is validated again before being returned, so stale or
 * manually modified records cannot bypass the current redirect policy.
 *
 * @param {*} code Code from the request path.
 * @returns {string | null} Destination URL, or `null` for an invalid, unregistered,
 * or currently disallowed code.
 * @example
 * const originalUrl = geturl("Ab12Cd");
 */
function geturl(code) {
  if (typeof code !== "string" || !CODE_PATTERN.test(code)) {
    return null;
  }

  const record = urlRepository.findUrlByCode(code);
  return record && isvalidurl(record.url) ? record.url : null;
}

/**
 * Validate a URL, generate a code and persist the mapping as one service flow.
 *
 * This is the main operation used by `POST /shorten`. If an extremely unlikely
 * unique-key race occurs, the service generates another code and retries.
 *
 * @param {*} url Destination URL submitted by the client.
 * @returns {{code: string, url: string}} Generated code and normalized URL.
 * @throws {AppError} With status 422 for an invalid URL or 503 if code
 * generation cannot complete.
 * @example
 * const result = createShortUrl("https://example.com/docs");
 * // { code: "aB12xZ", url: "https://example.com/docs" }
 */
function createShortUrl(url) {
  const parsedUrl = parseHttpUrl(url);

  if (!parsedUrl) {
    throw new AppError("The supplied URL is invalid.", 422, "invalid-url");
  }

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = createcode();

    try {
      saveurl(parsedUrl.href, code);
      return { code, url: parsedUrl.href };
    } catch (error) {
      if (error.errorCode === "code-already-exists") {
        continue;
      }

      throw error;
    }
  }

  throw new AppError(
    "Unable to reserve a unique short URL code.",
    503,
    "code-generation-unavailable",
  );
}

module.exports = {
  isvalidurl,
  createcode,
  saveurl,
  geturl,
  createShortUrl,
  AppError,
  MAX_URL_LENGTH,
};
