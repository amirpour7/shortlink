const {
  isvalidurl,
  createcode,
  saveurl,
  geturl,
} = require("./src/shortner");

const originalUrl = "https://example.com/articles/node-js";

try {
  if (!isvalidurl(originalUrl)) {
    throw new Error("The example URL is not valid.");
  }

  // Generate a unique six-character code and save the URL in SQLite.
  const code = createcode();
  saveurl(originalUrl, code);

  // Print the short code, then retrieve the original URL using that code.
  console.log("Original URL:", originalUrl);
  console.log("Short code:", code);
  console.log("Retrieved URL:", geturl(code));
} catch (error) {
  console.error("URL shortener example failed:", error.message);
  process.exitCode = 1;
}
