const app = require("./src/app");
const { closeDatabase } = require("./src/repositories/urlRepository");
const settings = require("./src/config/settings");

const server = app.listen(settings.port, () => {
  console.log(`Server is running at ${settings.shortUrlBase}`);
  const trustedProxyHops = app.get("trust proxy");
  console.log(`Trusted reverse proxy hops: ${trustedProxyHops === false ? 0 : trustedProxyHops}`);
  if (settings.swaggerEnabled) {
    console.log(`API documentation: ${settings.shortUrlBase}/api-docs`);
  }
});

let isShuttingDown = false;

/**
 * Stop accepting new HTTP connections and close SQLite gracefully.
 *
 * Repeated signals are ignored after shutdown has started. The process exit
 * code is set when the HTTP server or database fails to close cleanly.
 *
 * @param {string} signal Operating-system signal that initiated shutdown.
 * @returns {void}
 */
function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`${signal} received. Shutting down gracefully...`);

  server.close((error) => {
    if (error) {
      console.error("Error while shutting down the HTTP server:", error);
      process.exitCode = 1;
    }

    try {
      closeDatabase();
    } catch (databaseError) {
      console.error("Error while closing SQLite:", databaseError);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
