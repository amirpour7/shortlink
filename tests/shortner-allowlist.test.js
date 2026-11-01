const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.SHORT_URL_BASE = "http://localhost:3000";
process.env.PORT = "3000";
process.env.JSON_BODY_LIMIT = "8kb";

process.env.SHORTENER_DB_PATH = ":memory:";
process.env.SHORTENER_ALLOWED_HOSTS = "allowed.example,docs.example.org";

const { isvalidurl, createShortUrl, geturl } = require("../src/shortner");
const repository = require("../src/repositories/urlRepository");

test("configured redirect allowlist accepts only exact hostnames", () => {
  assert.equal(isvalidurl("https://allowed.example/docs"), true);
  assert.equal(isvalidurl("https://docs.example.org"), true);
  assert.equal(isvalidurl("https://sub.allowed.example"), false);
  assert.equal(isvalidurl("https://not-allowed.example"), false);
});

test("createShortUrl rejects a destination outside the configured allowlist", () => {
  assert.throws(() => createShortUrl("https://outside.example/path"), {
    statusCode: 422,
    errorCode: "invalid-url",
  });
});

test("geturl refuses legacy or manually inserted unsafe destinations", () => {
  repository.insertUrl("Unsafe", "javascript:alert(1)");
  assert.equal(geturl("Unsafe"), null);
});
