const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.SHORT_URL_BASE = "http://localhost:3000";
process.env.PORT = "3000";
process.env.JSON_BODY_LIMIT = "8kb";
process.env.SHORTENER_ALLOWED_HOSTS = "";

// Configure the environment before the application/settings modules are loaded.
process.env.SHORTENER_DB_PATH = ":memory:";
process.env.SHORTEN_RATE_LIMIT_MAX = "1000";
process.env.SHORT_CODE_LOOKUP_RATE_LIMIT_MAX = "1000";

const app = require("../src/app");

async function startTestServer(t, appInstance = app) {
  const server = appInstance.listen(0, "127.0.0.1");

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  }));

  return `http://127.0.0.1:${server.address().port}`;
}

async function postShorten(baseUrl, url, extraOptions = {}) {
  return fetch(`${baseUrl}/shorten`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...extraOptions.headers,
    },
    body: extraOptions.body ?? JSON.stringify({ url }),
  });
}

test("GET /health returns the health check response", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("security headers are present and X-Powered-By is disabled", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(response.headers.get("x-powered-by"), null);
  await response.text();
});

test("POST /shorten creates and returns a short URL", async (t) => {
  const baseUrl = await startTestServer(t);
  const originalUrl = "https://example.com/articles/express";
  const response = await postShorten(baseUrl, originalUrl);
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.match(body.code, /^[A-Za-z0-9]{6}$/);
  assert.equal(body.shorturl, `http://localhost:3000/${body.code}`);
});

test("GET /:code redirects to the original URL with HTTP 302", async (t) => {
  const baseUrl = await startTestServer(t);
  const originalUrl = "https://example.com/articles/redirect-target";
  const createResponse = await postShorten(baseUrl, originalUrl);

  assert.equal(createResponse.status, 201);
  const { code } = await createResponse.json();

  const redirectResponse = await fetch(`${baseUrl}/${code}`, {
    redirect: "manual",
  });

  assert.equal(redirectResponse.status, 302);
  assert.equal(redirectResponse.headers.get("location"), originalUrl);
  await redirectResponse.text();
});

test("POST /shorten returns 422 for an invalid URL", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await postShorten(baseUrl, "javascript:alert(1)");

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: "invalid-url" });
});

test("POST /shorten rejects credential-bearing and oversized URLs", async (t) => {
  const baseUrl = await startTestServer(t);
  const invalidUrls = [
    "https://user:password@example.com",
    `https://example.com/${"a".repeat(2048)}`,
  ];

  for (const url of invalidUrls) {
    const response = await postShorten(baseUrl, url);
    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), { error: "invalid-url" });
  }
});

test("POST /shorten returns invalid-url for a missing or invalid URL field", async (t) => {
  const baseUrl = await startTestServer(t);
  const invalidUrlBodies = [{}, { url: "" }, { url: "   " }, { url: null }];

  for (const body of invalidUrlBodies) {
    const response = await postShorten(baseUrl, undefined, {
      body: JSON.stringify(body),
    });

    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), { error: "invalid-url" });
  }
});

test("POST /shorten returns invalid-request-body when JSON body is not an object", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await postShorten(baseUrl, undefined, {
    body: JSON.stringify([]),
  });

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: "invalid-request-body" });
});

test("POST /shorten returns 400 for malformed JSON syntax", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await postShorten(baseUrl, undefined, {
    body: '{"url":',
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid-json" });
});

test("POST /shorten returns 400 for a valid JSON primitive instead of an object", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await postShorten(baseUrl, undefined, {
    body: JSON.stringify("https://example.com"),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid-json" });
});

test("POST /shorten returns 413 when the JSON body exceeds the configured limit", async (t) => {
  const baseUrl = await startTestServer(t);
  const hugeBody = JSON.stringify({ url: `https://example.com/${"a".repeat(10_000)}` });

  const response = await postShorten(baseUrl, undefined, { body: hugeBody });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "payload-too-large" });
});

test("POST /shorten returns 415 when the content type is not JSON", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/shorten`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "https://example.com",
  });

  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), { error: "unsupported-media-type" });
});

test("GET /:code returns the required 404 JSON for an unregistered code", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/NotFound`, {
    redirect: "manual",
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "404 Not Found" });
});

test("POST /shorten applies a configurable per-IP rate limit", async (t) => {
  const limitedApp = app.createApp({
    rateLimit: { windowMs: 60_000, limit: 2 },
  });
  const baseUrl = await startTestServer(t, limitedApp);

  const first = await postShorten(baseUrl, "https://example.com/one");
  const second = await postShorten(baseUrl, "https://example.com/two");
  const third = await postShorten(baseUrl, "https://example.com/three");

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(third.status, 429);
  await first.text();
  await second.text();
  assert.deepEqual(await third.json(), { error: "rate-limit-exceeded" });
  assert.ok(third.headers.has("ratelimit"));
});

test("unregistered non-shortener routes return a JSON 404", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/this/route/does/not/exist`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "not-found" });
});


test("GET /:code also applies its own configurable lookup rate limit", async (t) => {
  const limitedApp = app.createApp({
    rateLimit: { windowMs: 60_000, limit: 100, lookupLimit: 1 },
  });
  const baseUrl = await startTestServer(t, limitedApp);
  const createResponse = await postShorten(baseUrl, "https://example.com/lookup-limit");
  const { code } = await createResponse.json();

  const firstLookup = await fetch(`${baseUrl}/${code}`, { redirect: "manual" });
  const secondLookup = await fetch(`${baseUrl}/${code}`, { redirect: "manual" });

  assert.equal(firstLookup.status, 302);
  assert.equal(secondLookup.status, 429);
  await firstLookup.text();
  assert.deepEqual(await secondLookup.json(), { error: "rate-limit-exceeded" });
});


test("malformed URL-encoded path parameters return HTTP 400", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/%E0%A4%A`, { redirect: "manual" });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid-path-parameter" });
});
