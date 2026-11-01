const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
const errorHandler = require("../src/middleware/errorHandler");

function invokeErrorHandler(error, headersSent = false) {
  let statusCode;
  let responseBody;
  let forwardedError;

  const response = {
    headersSent,
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return body;
    },
  };

  errorHandler(error, {}, response, (nextError) => {
    forwardedError = nextError;
  });

  return { statusCode, responseBody, forwardedError };
}

test("error handler maps malformed JSON to HTTP 400", () => {
  const result = invokeErrorHandler({ type: "entity.parse.failed" });

  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.responseBody, { error: "invalid-json" });
});

test("error handler maps aborted and invalid-size requests to HTTP 400", () => {
  const aborted = invokeErrorHandler({ type: "request.aborted" });
  const invalidSize = invokeErrorHandler({ type: "request.size.invalid" });

  assert.equal(aborted.statusCode, 400);
  assert.deepEqual(aborted.responseBody, { error: "request-aborted" });
  assert.equal(invalidSize.statusCode, 400);
  assert.deepEqual(invalidSize.responseBody, { error: "invalid-content-length" });
});

test("error handler maps failed entity verification to HTTP 403", () => {
  const result = invokeErrorHandler({ type: "entity.verify.failed" });

  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.responseBody, { error: "entity-verification-failed" });
});

test("error handler maps oversized JSON to HTTP 413", () => {
  const result = invokeErrorHandler({ type: "entity.too.large" });

  assert.equal(result.statusCode, 413);
  assert.deepEqual(result.responseBody, { error: "payload-too-large" });
});

test("error handler maps unsupported body encodings to HTTP 415", () => {
  const result = invokeErrorHandler({ type: "encoding.unsupported" });

  assert.equal(result.statusCode, 415);
  assert.deepEqual(result.responseBody, { error: "unsupported-media-type" });
});

test("error handler maps SQLite lock errors to HTTP 503", () => {
  const result = invokeErrorHandler({ code: "SQLITE_BUSY_SNAPSHOT" });

  assert.equal(result.statusCode, 503);
  assert.deepEqual(result.responseBody, {
    error: "database-temporarily-unavailable",
  });
});

test("error handler hides unexpected internal error details", () => {
  const result = invokeErrorHandler(new Error("private SQL details"));

  assert.equal(result.statusCode, 500);
  assert.deepEqual(result.responseBody, { error: "internal-server-error" });
  assert.equal(JSON.stringify(result.responseBody).includes("private SQL details"), false);
});

test("error handler forwards errors after response headers have been sent", () => {
  const error = new Error("stream failed");
  const result = invokeErrorHandler(error, true);

  assert.equal(result.forwardedError, error);
  assert.equal(result.statusCode, undefined);
  assert.equal(result.responseBody, undefined);
});
