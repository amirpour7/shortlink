const express = require("express");
const path = require("node:path");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const healthRouter = require("./routes/health");
const createShortenerRouter = require("./routes/shortner").createShortenerRouter;
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");
const settings = require("./config/settings");

let cachedSwaggerDocument;

/** Load the OpenAPI document on demand so disabled docs do not incur parsing cost. */
function getSwaggerDocument() {
  if (!cachedSwaggerDocument) {
    cachedSwaggerDocument = require("./config/swagger");
  }

  return cachedSwaggerDocument;
}

/**
 * Create a configured Express application instance.
 *
 * Middleware and route order is intentional: security headers first, then
 * static frontend files, health/docs endpoints, and finally the one-segment
 * `/:code` redirect route. The 404 and error handlers must remain last.
 *
 * @param {object} [options] Optional overrides for isolated app instances.
 * @param {string} [options.publicDir] Alternate directory containing frontend assets.
 * @param {string} [options.shortUrlBase] Public origin used in generated links.
 * @param {{windowMs?: number, limit?: number, lookupLimit?: number}} [options.rateLimit]
 * Rate-limit overrides for tests or a separately configured instance.
 * @param {string|number} [options.jsonBodyLimit] JSON request body size limit.
 * @param {boolean} [options.swaggerEnabled] Enable Swagger endpoints for this app instance.
 * @returns {import("express").Express} Configured Express application.
 */
function createApp(options = {}) {
  const app = express();
  const swaggerEnabled = options.swaggerEnabled ?? settings.swaggerEnabled;

  app.disable("x-powered-by");

  // Swagger UI needs its inline bootstrap script. Relax CSP only on the docs
  // route; all other routes retain Helmet's default Content-Security-Policy.
  const defaultSecurityHeaders = helmet();
  const docsSecurityHeaders = helmet({ contentSecurityPolicy: false });
  app.use((req, res, next) => {
    const isSwaggerRequest = req.path === "/api-docs" || req.path.startsWith("/api-docs/");
    const securityHeaders = isSwaggerRequest
      ? docsSecurityHeaders
      : defaultSecurityHeaders;
    return securityHeaders(req, res, next);
  });

  // Serve the frontend from the same origin as the API.
  app.use(express.static(options.publicDir || path.join(settings.projectRoot, "public"), {
    dotfiles: "ignore",
    fallthrough: true,
    index: "index.html",
    maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
  }));

  app.use("/health", healthRouter);

  // Register documentation before /:code, because the latter accepts any
  // single URL segment as a short code.
  if (swaggerEnabled) {
    const swaggerDocument = getSwaggerDocument();

    app.get("/api-docs.json", (req, res) => {
      void req;
      res.status(200).json(swaggerDocument);
    });
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
      customSiteTitle: "Link Shortener API Documentation",
      swaggerOptions: {
        persistAuthorization: false,
        displayRequestDuration: true,
        validatorUrl: null,
      },
    }));
  }

  app.use("/", createShortenerRouter({
    shortUrlBase: options.shortUrlBase || settings.shortUrlBase,
    rateLimit: options.rateLimit,
    jsonBodyLimit: options.jsonBodyLimit,
  }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const app = createApp();
app.createApp = createApp;

module.exports = app;
