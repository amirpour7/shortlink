const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.SHORT_URL_BASE = "http://localhost:3000";
process.env.PORT = "3000";
process.env.SHORTENER_DB_PATH = ":memory:";
process.env.SHORTEN_RATE_LIMIT_MAX = "1000";
process.env.SHORT_CODE_LOOKUP_RATE_LIMIT_MAX = "1000";

const app = require("../src/app");

async function startTestServer(t) {
  const server = app.listen(0, "127.0.0.1");

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

test("GET / serves the Persian RTL frontend", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(html, /<html lang="fa" dir="rtl">/);
  assert.match(html, /id="shortenForm"/);
  assert.match(html, /type="url"/);
  assert.match(html, /\/assets\/style\.css/);
  assert.match(html, /\/assets\/script\.js/);
  assert.match(html, /\/assets\/fonts\/Vazir-Regular\.woff2/);
  assert.doesNotMatch(html, /cdn\.tailwindcss\.com/);
});

test("GET /assets/style.css serves the compiled Tailwind stylesheet", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/assets/style.css`);
  const css = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/css/);
  assert.match(css, /\.shortener-card/);
  assert.match(css, /\.submit-button/);
  assert.match(css, /prefers-reduced-motion/);
  assert.ok(css.includes("@font-face"));
  assert.ok(css.includes("/assets/fonts/Vazir-Regular.woff2"));
  assert.match(css, /font-family:\s*["\']?Vazir/i);
  assert.match(css, /:root\s*\{[^}]*font-family:\s*["\']?Vazir/i);
});

test("GET /assets/script.js serves the frontend interaction code", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/assets/script.js`);
  const script = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /javascript/);
  assert.match(script, /fetch\("\/shorten"/);
  assert.match(script, /navigator\.clipboard\.writeText/);
  assert.match(script, /redirect|credentials: "same-origin"/i);
});

test("unavailable static files do not replace the JSON API 404 response", async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/assets/missing-file.js`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "not-found" });
});
