const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.SHORT_URL_BASE = "http://localhost:3000";
process.env.PORT = "3000";
process.env.SHORTENER_DB_PATH = ":memory:";
process.env.SHORTEN_RATE_LIMIT_MAX = "1000";
process.env.SHORT_CODE_LOOKUP_RATE_LIMIT_MAX = "1000";
process.env.TRUST_PROXY_HOPS = "1";

const app = require("../src/app");

async function startTestServer(t, appInstance) {
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

async function postShorten(baseUrl, url, forwardedFor) {
  return fetch(`${baseUrl}/shorten`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": forwardedFor,
    },
    body: JSON.stringify({ url }),
  });
}

test("TRUST_PROXY_HOPS from the environment configures Express before routes", () => {
  assert.equal(app.get("trust proxy"), 1);
});

test("direct-access app instances can explicitly disable proxy trust", () => {
  const directApp = app.createApp({ trustProxyHops: false });
  assert.equal(directApp.get("trust proxy"), false);
});

test("an app instance can override the trusted proxy hop count", () => {
  const proxyApp = app.createApp({ trustProxyHops: 2 });
  assert.equal(proxyApp.get("trust proxy"), 2);
});

test("Rate Limiting uses the client IP supplied by one trusted reverse proxy", async (t) => {
  const proxyApp = app.createApp({
    trustProxyHops: 1,
    rateLimit: { windowMs: 60_000, limit: 1, lookupLimit: 100 },
  });
  const baseUrl = await startTestServer(t, proxyApp);

  const firstClientRequest = await postShorten(
    baseUrl,
    "https://example.com/client-a-first",
    "198.51.100.10",
  );
  const secondClientRequest = await postShorten(
    baseUrl,
    "https://example.com/client-b-first",
    "203.0.113.20",
  );
  const repeatedFirstClientRequest = await postShorten(
    baseUrl,
    "https://example.com/client-a-second",
    "198.51.100.10",
  );

  assert.equal(firstClientRequest.status, 201);
  assert.equal(secondClientRequest.status, 201);
  assert.equal(repeatedFirstClientRequest.status, 429);

  await firstClientRequest.text();
  await secondClientRequest.text();
  assert.deepEqual(await repeatedFirstClientRequest.json(), {
    error: "rate-limit-exceeded",
  });
});

test("X-Forwarded-For validation does not log ERR_ERL_UNEXPECTED_X_FORWARDED_FOR", async (t) => {
  const directApp = app.createApp({
    trustProxyHops: false,
    rateLimit: { windowMs: 60_000, limit: 1, lookupLimit: 100 },
  });
  const baseUrl = await startTestServer(t, directApp);
  const loggedMessages = [];
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  console.error = (...args) => loggedMessages.push(args.map(String).join(" "));
  console.warn = (...args) => loggedMessages.push(args.map(String).join(" "));

  let firstResponse;
  let secondResponse;

  try {
    firstResponse = await postShorten(
      baseUrl,
      "https://example.com/direct-client-first",
      "198.51.100.10",
    );
    secondResponse = await postShorten(
      baseUrl,
      "https://example.com/direct-client-second",
      "203.0.113.20",
    );
  } finally {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }

  assert.equal(firstResponse.status, 201);
  // Without a trusted proxy, forwarded headers are ignored. Both requests are
  // correctly grouped under the direct socket address rather than spoofed XFF.
  assert.equal(secondResponse.status, 429);
  assert.doesNotMatch(
    loggedMessages.join("\n"),
    /ERR_ERL_UNEXPECTED_X_FORWARDED_FOR/,
  );
  await firstResponse.text();
  await secondResponse.text();
});
