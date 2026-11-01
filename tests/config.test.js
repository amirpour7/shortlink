const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.SHORT_URL_BASE = "https://short.example";

const settings = require("../src/config/settings");

test("SHORT_URL_BASE accepts a clean HTTP or HTTPS origin", () => {
  assert.equal(settings.validateShortUrlBase("https://short.example/"), "https://short.example");
  assert.equal(settings.validateShortUrlBase("http://localhost:3000"), "http://localhost:3000");
});

test("SHORT_URL_BASE rejects credentials, paths, queries, and fragments", () => {
  const invalidBases = [
    "https://user:password@short.example",
    "https://short.example/app",
    "https://short.example?next=/admin",
    "https://short.example#fragment",
    "ftp://short.example",
    "not-a-url",
    "",
  ];

  for (const value of invalidBases) {
    assert.throws(() => settings.validateShortUrlBase(value));
  }
});

test("SHORT_URL_BASE requires HTTPS in production", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    assert.throws(() => settings.validateShortUrlBase("http://short.example"));
    assert.equal(settings.validateShortUrlBase("https://short.example"), "https://short.example");
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});


test("PORT rejects values outside the valid TCP port range", () => {
  const previousPort = process.env.PORT;
  const settingsPath = require.resolve("../src/config/settings");

  process.env.PORT = "65536";
  delete require.cache[settingsPath];

  try {
    assert.throws(() => require(settingsPath), /PORT must not exceed 65535/);
  } finally {
    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }

    delete require.cache[settingsPath];
    require(settingsPath);
  }
});


test("allowed redirect hosts are trimmed and normalized to lowercase", () => {
  assert.deepEqual(
    settings.parseAllowedHosts(" Example.com, docs.example.org ,,API.EXAMPLE.NET "),
    ["example.com", "docs.example.org", "api.example.net"],
  );
});


test("readBoolean accepts common true and false values and rejects typos", () => {
  const previousFallbackValue = process.env.UNUSED_BOOLEAN;
  delete process.env.UNUSED_BOOLEAN;
  assert.equal(settings.readBoolean("UNUSED_BOOLEAN", true), true);

  const previousValue = process.env.TEST_BOOLEAN_SETTING;
  try {
    for (const value of ["true", "1", "yes", "on"]) {
      process.env.TEST_BOOLEAN_SETTING = value;
      assert.equal(settings.readBoolean("TEST_BOOLEAN_SETTING", false), true);
    }

    for (const value of ["false", "0", "no", "off"]) {
      process.env.TEST_BOOLEAN_SETTING = value;
      assert.equal(settings.readBoolean("TEST_BOOLEAN_SETTING", true), false);
    }

    process.env.TEST_BOOLEAN_SETTING = "maybe";
    assert.throws(() => settings.readBoolean("TEST_BOOLEAN_SETTING", false), /must be a boolean/);
  } finally {
    if (previousValue === undefined) {
      delete process.env.TEST_BOOLEAN_SETTING;
    } else {
      process.env.TEST_BOOLEAN_SETTING = previousValue;
    }

    if (previousFallbackValue === undefined) {
      delete process.env.UNUSED_BOOLEAN;
    } else {
      process.env.UNUSED_BOOLEAN = previousFallbackValue;
    }
  }
});


test("TRUST_PROXY_HOPS accepts only an explicit non-negative hop count", () => {
  assert.equal(settings.parseTrustProxyHops(undefined), false);
  assert.equal(settings.parseTrustProxyHops(""), false);
  assert.equal(settings.parseTrustProxyHops("0"), false);
  assert.equal(settings.parseTrustProxyHops("false"), false);
  assert.equal(settings.parseTrustProxyHops("1"), 1);
  assert.equal(settings.parseTrustProxyHops("2"), 2);
  assert.equal(settings.parseTrustProxyHops(" 1 "), 1);
});

test("TRUST_PROXY_HOPS rejects permissive, negative, and non-integer values", () => {
  for (const value of ["true", "yes", "on", "-1", "1.5", "many", "Infinity"]) {
    assert.throws(
      () => settings.parseTrustProxyHops(value),
      /TRUST_PROXY_HOPS must be a non-negative integer/,
      `Expected ${value} to be rejected`,
    );
  }
});
