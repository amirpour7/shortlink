const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.SHORT_URL_BASE = "http://localhost:3000";
process.env.PORT = "3000";
process.env.JSON_BODY_LIMIT = "8kb";
process.env.SHORTENER_ALLOWED_HOSTS = "";

// Every test worker gets an isolated in-memory SQLite database.
process.env.SHORTENER_DB_PATH = ":memory:";

const {
  isvalidurl,
  createcode,
  saveurl,
  geturl,
  createShortUrl,
} = require("../src/shortner");

const VALID_URL = "https://example.com/articles/node-js?source=test";
const VALID_CODE = "Ab12Cd";

test("isvalidurl accepts valid HTTP and HTTPS URLs", () => {
  const validUrls = [
    "https://example.com",
    "http://example.com/path",
    "https://example.com:8443/path?q=1#section",
    "http://localhost:3000/health",
    "http://127.0.0.1:3000/health",
  ];

  for (const url of validUrls) {
    assert.equal(isvalidurl(url), true, `Expected URL to be valid: ${url}`);
  }
});

test("isvalidurl rejects empty, missing, and non-string values", () => {
  const invalidValues = [
    "",
    "   ",
    "\t",
    "\n",
    null,
    undefined,
    123,
    true,
    {},
    [],
  ];

  for (const value of invalidValues) {
    assert.equal(isvalidurl(value), false);
  }
});

test("isvalidurl rejects malformed URLs and unsupported protocols", () => {
  const invalidUrls = [
    "example.com",
    "/relative/path",
    "https://",
    "http://",
    "http://?query",
    "http://#hash",
    "http://:80",
    "https://example.com:invalid-port",
    "ftp://example.com/file",
    "javascript:alert(1)",
    "data:text/plain,hello",
    "file:///etc/passwd",
  ];

  for (const url of invalidUrls) {
    assert.equal(isvalidurl(url), false, `Expected URL to be invalid: ${url}`);
  }
});

test("isvalidurl rejects URLs containing credentials", () => {
  assert.equal(isvalidurl("https://user:password@example.com"), false);
  assert.equal(isvalidurl("https://user@example.com/path"), false);
});

test("isvalidurl rejects URLs longer than 2048 characters", () => {
  const longUrl = `https://example.com/${"a".repeat(2048)}`;
  assert.equal(isvalidurl(longUrl), false);
});

test("createcode returns a six-character alphanumeric code", () => {
  const code = createcode();

  assert.equal(code.length, 6);
  assert.match(code, /^[A-Za-z0-9]{6}$/);
});

test("createcode generates distinct codes across repeated calls", () => {
  const generatedCodes = new Set();

  for (let index = 0; index < 250; index += 1) {
    const code = createcode();

    assert.match(code, /^[A-Za-z0-9]{6}$/);
    assert.equal(generatedCodes.has(code), false, `Duplicate code generated: ${code}`);
    generatedCodes.add(code);
  }

  assert.equal(generatedCodes.size, 250);
});

test("createcode does not return a code already stored in SQLite", () => {
  const savedCode = createcode();
  saveurl(VALID_URL, savedCode);

  const nextCode = createcode();

  assert.notEqual(nextCode, savedCode);
  assert.match(nextCode, /^[A-Za-z0-9]{6}$/);
});

test("saveurl stores a URL and geturl retrieves the same URL", () => {
  const code = createcode();

  assert.equal(saveurl(VALID_URL, code), true);
  assert.equal(geturl(code), VALID_URL);
});

test("saveurl normalizes the URL and trims surrounding whitespace", () => {
  const code = "Trim01";
  const urlWithWhitespace = `  ${VALID_URL}  `;

  assert.equal(saveurl(urlWithWhitespace, code), true);
  assert.equal(geturl(code), VALID_URL);
});

test("saveurl rejects empty, missing, and invalid URL values", () => {
  const invalidUrls = [
    "",
    "   ",
    null,
    undefined,
    123,
    {},
    "not-a-url",
    "ftp://example.com",
    "https://user:secret@example.com",
  ];

  for (const url of invalidUrls) {
    assert.throws(() => saveurl(url, VALID_CODE), {
      statusCode: 422,
      errorCode: "invalid-url",
    });
  }

  assert.equal(geturl(VALID_CODE), null);
});

test("saveurl rejects empty, missing, and malformed codes", () => {
  const invalidCodes = [
    "",
    "   ",
    null,
    undefined,
    123456,
    "abc",
    "abcdefg",
    "abc-12",
    "abc 12",
    "äbc123",
  ];

  for (const code of invalidCodes) {
    assert.throws(() => saveurl(VALID_URL, code), {
      statusCode: 422,
      errorCode: "invalid-code",
    });
  }
});

test("geturl returns null for an unregistered code", () => {
  assert.equal(geturl("Zz99Yy"), null);
});

test("geturl returns null for empty, missing, or malformed codes", () => {
  const invalidCodes = ["", "   ", null, undefined, 123456, "abc", "abc-12"];

  for (const code of invalidCodes) {
    assert.equal(geturl(code), null);
  }
});

test("saveurl does not overwrite an existing code", () => {
  const code = "Dup123";
  const firstUrl = "https://example.com/first";
  const secondUrl = "https://example.com/second";

  assert.equal(saveurl(firstUrl, code), true);

  assert.throws(() => saveurl(secondUrl, code), {
    statusCode: 409,
    errorCode: "code-already-exists",
  });

  assert.equal(geturl(code), firstUrl);
});

test("a code reservation is released when saving fails", () => {
  const code = createcode();

  assert.throws(() => saveurl("not-a-url", code));
  assert.equal(saveurl(VALID_URL, code), true);
  assert.equal(geturl(code), VALID_URL);
});

test("createShortUrl validates, persists, and returns the generated code", () => {
  const result = createShortUrl(VALID_URL);

  assert.match(result.code, /^[A-Za-z0-9]{6}$/);
  assert.equal(result.url, VALID_URL);
  assert.equal(geturl(result.code), VALID_URL);
});

test("createShortUrl rejects invalid input with a 422 application error", () => {
  assert.throws(() => createShortUrl("javascript:alert(1)"), {
    statusCode: 422,
    errorCode: "invalid-url",
  });
});
