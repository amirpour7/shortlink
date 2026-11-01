const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const { DEFAULT_ENV_PATH, loadEnvironment } = require("../src/config/loadEnv");

test("loadEnvironment reads key/value pairs from a .env file", (t) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "express-env-test-"));
  const envPath = path.join(tempDirectory, ".env");
  const target = {};

  t.after(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));

  fs.writeFileSync(
    envPath,
    [
      "PORT=4321",
      'APP_LABEL="A local test app"',
      "# this is a comment",
      "EMPTY_VALUE=",
      "",
    ].join("\n"),
  );

  const result = loadEnvironment({ envPath, target });

  assert.equal(result.loaded, true);
  assert.equal(target.PORT, "4321");
  assert.equal(target.APP_LABEL, "A local test app");
  assert.equal(target.EMPTY_VALUE, "");
});

test("existing system environment variables take precedence by default", (t) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "express-env-test-"));
  const envPath = path.join(tempDirectory, ".env");
  const target = { PORT: "9000" };

  t.after(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));
  fs.writeFileSync(envPath, "PORT=3000\nNODE_ENV=development\n");

  loadEnvironment({ envPath, target });

  assert.equal(target.PORT, "9000");
  assert.equal(target.NODE_ENV, "development");
});

test("loadEnvironment can explicitly override existing values", (t) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "express-env-test-"));
  const envPath = path.join(tempDirectory, ".env");
  const target = { PORT: "9000" };

  t.after(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));
  fs.writeFileSync(envPath, "PORT=3000\n");

  loadEnvironment({ envPath, target, override: true });

  assert.equal(target.PORT, "3000");
});

test("a missing optional .env file does not prevent startup", (t) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "express-env-test-"));
  const envPath = path.join(tempDirectory, ".env-missing");

  t.after(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));

  const result = loadEnvironment({ envPath, target: {} });

  assert.equal(result.loaded, false);
  assert.deepEqual(result.values, {});
});

test("the application loads the project-root .env before reading settings", () => {
  assert.equal(DEFAULT_ENV_PATH, path.join(projectRoot, ".env"));

  const childEnvironment = { ...process.env };
  for (const key of [
    "NODE_ENV",
    "PORT",
    "SHORT_URL_BASE",
    "SHORTENER_DB_PATH",
    "JSON_BODY_LIMIT",
    "SHORTEN_RATE_LIMIT_WINDOW_MS",
    "SHORTEN_RATE_LIMIT_MAX",
    "SHORT_CODE_LOOKUP_RATE_LIMIT_MAX",
    "SHORTENER_ALLOWED_HOSTS",
    "SWAGGER_ENABLED",
  ]) {
    delete childEnvironment[key];
  }

  const child = spawnSync(
    process.execPath,
    [
      "-e",
      [
        'const settings = require("./src/config/settings");',
        "process.stdout.write(JSON.stringify({",
        "  port: settings.port,",
        "  shortUrlBase: settings.shortUrlBase,",
        "  jsonBodyLimit: settings.jsonBodyLimit,",
        "  allowedRedirectHosts: settings.allowedRedirectHosts,",
        "  swaggerEnabled: settings.swaggerEnabled,",
        "}));",
      ].join("\n"),
    ],
    {
      cwd: projectRoot,
      env: childEnvironment,
      encoding: "utf8",
    },
  );

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {
    port: 3000,
    shortUrlBase: "http://localhost:3000",
    jsonBodyLimit: "8kb",
    allowedRedirectHosts: [],
    swaggerEnabled: true,
  });
});
