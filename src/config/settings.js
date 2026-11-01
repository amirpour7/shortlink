const path = require("node:path");
const { loadEnvironment } = require("./loadEnv");

// Load .env before reading any configuration values. Values already supplied
// by the operating system or deployment platform are intentionally preserved.
loadEnvironment();

const PROJECT_ROOT = path.resolve(__dirname, "../..");

/**
 * Read a positive integer from the environment, falling back when unset.
 *
 * @param {string} name Environment variable name.
 * @param {number} fallback Value used when the variable is missing or blank.
 * @returns {number} A positive safe integer.
 * @throws {Error} If the configured value is not a positive safe integer.
 */
function readPositiveInteger(name, fallback) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue.trim() === "") {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

/**
 * Read and validate a TCP port from the environment.
 *
 * @param {string} name Environment variable name.
 * @param {number} fallback Port used when the variable is missing or blank.
 * @returns {number} An integer in the TCP port range 1-65535.
 * @throws {Error} If the value is not a valid TCP port.
 */
function readPort(name, fallback) {
  const port = readPositiveInteger(name, fallback);

  if (port > 65_535) {
    throw new Error(`${name} must not exceed 65535.`);
  }

  return port;
}

/**
 * Parse the number of trusted reverse-proxy hops from the environment.
 *
 * Express uses this value to decide which address in X-Forwarded-For belongs
 * to the client. Zero disables proxy trust. A positive integer trusts exactly
 * that many proxy hops. The permissive boolean value `true` is deliberately
 * rejected because it can allow clients to spoof their IP address.
 *
 * @param {string | undefined} rawValue Environment value, usually
 * `TRUST_PROXY_HOPS`.
 * @param {false | number} [fallback=false] Value used when the setting is
 * missing or blank.
 * @returns {false | number} `false` when proxy headers are not trusted, or
 * the exact number of trusted proxy hops.
 * @throws {Error} If the value is not a non-negative safe integer.
 * @example
 * parseTrustProxyHops("1"); // 1: trust exactly one reverse proxy
 * parseTrustProxyHops("0"); // false: do not trust proxy headers
 */
function parseTrustProxyHops(rawValue, fallback = false) {
  if (rawValue === undefined || rawValue.trim() === "") {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();

  if (["false", "no", "off"].includes(normalized)) {
    return false;
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      "TRUST_PROXY_HOPS must be a non-negative integer. Do not use 'true'; configure the exact trusted proxy hop count.",
    );
  }

  const hops = Number(normalized);

  if (!Number.isSafeInteger(hops)) {
    throw new Error("TRUST_PROXY_HOPS must be a non-negative safe integer.");
  }

  return hops === 0 ? false : hops;
}


/**
 * Choose a conservative default for deployments that terminate TLS at one
 * platform reverse proxy. Development remains direct-access by default.
 * Deployments with a different proxy chain must set TRUST_PROXY_HOPS explicitly.
 *
 * @param {string | undefined} nodeEnv Runtime environment name.
 * @returns {false | number} One trusted hop in production, otherwise no proxy trust.
 */
function getDefaultTrustProxyHops(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === "production" ? 1 : false;
}

/**
 * Parse an HTTP(S) origin used when constructing public short links.
 *
 * The value must be an origin only: credentials, paths, query strings and
 * fragments are rejected. Production deployments must use HTTPS.
 *
 * @param {string} value Candidate public origin.
 * @returns {string} Normalized URL origin.
 * @throws {Error} If the value is not a permitted HTTP(S) origin.
 */
function validateShortUrlBase(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("SHORT_URL_BASE must be a non-empty URL string.");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(value.trim());
  } catch {
    throw new Error("SHORT_URL_BASE must be a valid absolute HTTP(S) URL.");
  }

  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    !parsedUrl.hostname ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error(
      "SHORT_URL_BASE must be an HTTP(S) origin without credentials, a path, a query, or a fragment.",
    );
  }

  if (process.env.NODE_ENV === "production" && parsedUrl.protocol !== "https:") {
    throw new Error("SHORT_URL_BASE must use HTTPS in production.");
  }

  return parsedUrl.origin;
}

/**
 * Parse a comma-separated exact hostname allowlist.
 *
 * @param {string} rawValue Comma-separated hostnames from the environment.
 * @returns {string[]} Lowercase, trimmed hostnames with empty entries removed.
 */
function parseAllowedHosts(rawValue) {
  if (!rawValue || rawValue.trim() === "") {
    return [];
  }

  return rawValue
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Parse a boolean environment variable without silently accepting typos.
 *
 * Accepted true values: true, 1, yes, on. False values: false, 0, no, off.
 *
 * @param {string} name Environment variable name.
 * @param {boolean} fallback Value used when the variable is missing or blank.
 * @returns {boolean} Parsed boolean value.
 * @throws {Error} If a non-empty value is not a recognized boolean token.
 */
function readBoolean(name, fallback) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue.trim() === "") {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();
  const trueValues = new Set(["true", "1", "yes", "on"]);
  const falseValues = new Set(["false", "0", "no", "off"]);

  if (trueValues.has(normalized)) {
    return true;
  }

  if (falseValues.has(normalized)) {
    return false;
  }

  throw new Error(`${name} must be a boolean value (true/false).`);
}

const port = readPort("PORT", 3000);
const rawDatabasePath = process.env.SHORTENER_DB_PATH || path.join("data", "urls.sqlite");
const databasePath = rawDatabasePath === ":memory:"
  ? rawDatabasePath
  : path.resolve(PROJECT_ROOT, rawDatabasePath);

const settings = {
  projectRoot: PROJECT_ROOT,
  port,
  shortUrlBase: validateShortUrlBase(
    process.env.SHORT_URL_BASE || `http://localhost:${port}`,
  ),
  databasePath,
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || "8kb",
  shortenRateLimitWindowMs: readPositiveInteger("SHORTEN_RATE_LIMIT_WINDOW_MS", 60_000),
  shortenRateLimitMax: readPositiveInteger("SHORTEN_RATE_LIMIT_MAX", 10),
  lookupRateLimitMax: readPositiveInteger("SHORT_CODE_LOOKUP_RATE_LIMIT_MAX", 300),
  allowedRedirectHosts: parseAllowedHosts(process.env.SHORTENER_ALLOWED_HOSTS || ""),
  swaggerEnabled: readBoolean("SWAGGER_ENABLED", true),
  trustProxyHops: parseTrustProxyHops(
    process.env.TRUST_PROXY_HOPS,
    getDefaultTrustProxyHops(process.env.NODE_ENV),
  ),
};

module.exports = {
  ...settings,
  validateShortUrlBase,
  parseAllowedHosts,
  readBoolean,
  parseTrustProxyHops,
  getDefaultTrustProxyHops,
};
