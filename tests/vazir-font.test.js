const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.join(__dirname, "..");
const fontsCss = readFileSync(path.join(projectRoot, "src/styles/fonts.css"), "utf8");
const installerBat = readFileSync(path.join(projectRoot, "setup-vazir-font.bat"), "utf8");

test("Vazir CSS defines all supported local font weights", () => {
  const weights = [
    ["Vazir-Thin.woff2", "100"],
    ["Vazir-Light.woff2", "300"],
    ["Vazir-Regular.woff2", "400"],
    ["Vazir-Medium.woff2", "500"],
    ["Vazir-Bold.woff2", "700"],
    ["Vazir-Black.woff2", "900"],
  ];

  for (const [fontFile, weight] of weights) {
    assert.ok(fontsCss.includes(`/assets/fonts/${fontFile}`), `${fontFile} should use a local asset URL`);
    assert.ok(fontsCss.includes(`font-weight: ${weight};`), `${fontFile} should map to weight ${weight}`);
  }

  assert.ok(fontsCss.includes('font-family: "Vazir";'));
  assert.ok(fontsCss.includes("font-display: swap;"));
});

test("Windows setup script downloads pinned Vazir files and the OFL license", () => {
  assert.ok(installerBat.includes("vazir-font@%FONT_VERSION%/dist"));
  assert.ok(installerBat.includes('set "FONT_VERSION=30.1.0"'));
  assert.ok(installerBat.includes("Vazir-Regular.woff2"));
  assert.ok(installerBat.includes("Vazir-Bold.woff2"));
  assert.ok(installerBat.includes("OFL.txt"));
  assert.ok(installerBat.includes("npm run build:css"));
});
