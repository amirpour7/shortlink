const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.SHORT_URL_BASE = "http://localhost:3000";
process.env.PORT = "3000";
process.env.SHORTENER_DB_PATH = ":memory:";
process.env.SHORTEN_RATE_LIMIT_MAX = "1000";
process.env.SHORT_CODE_LOOKUP_RATE_LIMIT_MAX = "1000";
process.env.SWAGGER_ENABLED = "true";

const app = require("../src/app");
const swaggerDocument = require("../src/config/swagger");

/** Start an app instance on an ephemeral loopback port for HTTP tests. */
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

test("OpenAPI document contains the documented health and shortener operations", () => {
  assert.equal(swaggerDocument.openapi, "3.0.3");
  assert.equal(swaggerDocument.info.version, require("../package.json").version);
  assert.ok(swaggerDocument.paths && typeof swaggerDocument.paths === "object", "OpenAPI paths must be generated from the route JSDoc blocks");
  assert.ok(swaggerDocument.paths["/health"]?.get, "GET /health must be present in OpenAPI");
  assert.ok(swaggerDocument.paths["/shorten"]?.post, "POST /shorten must be present in OpenAPI");
  assert.ok(swaggerDocument.paths["/{code}"]?.get, "GET /{code} must be present in OpenAPI");
  assert.equal(
    swaggerDocument.paths["/shorten"].post.responses["201"].description,
    "Short URL created and stored successfully.",
  );
  assert.ok(swaggerDocument.components.schemas.Error);

  const shortenResponses = swaggerDocument.paths["/shorten"].post.responses;
  assert.deepEqual(
    shortenResponses["400"].content["application/json"].examples.malformedJson.value,
    { error: "invalid-json" },
  );
  assert.deepEqual(
    shortenResponses["422"].content["application/json"].examples.invalidUrl.value,
    { error: "invalid-url" },
  );
  assert.deepEqual(
    shortenResponses["422"].content["application/json"].examples.invalidRequestBody.value,
    { error: "invalid-request-body" },
  );
});

test("GET /api-docs.json returns the generated OpenAPI document", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/api-docs.json`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.equal(body.openapi, "3.0.3");
  assert.ok(body.paths && typeof body.paths === "object", "HTTP OpenAPI document must include its paths");
  assert.ok(body.paths["/health"]?.get);
  assert.ok(body.paths["/shorten"]?.post);
  assert.ok(body.paths["/{code}"]?.get);
});

test("GET /api-docs serves Swagger UI HTML", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/api-docs/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(html, /swagger-ui/);
  assert.equal(response.headers.get("content-security-policy"), null);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("Swagger endpoints can be disabled for an application instance", async (t) => {
  const disabledApp = app.createApp({ swaggerEnabled: false });
  const baseUrl = await startTestServer(t, disabledApp);
  const response = await fetch(`${baseUrl}/api-docs.json`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "404 Not Found" });
});
