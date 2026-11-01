const path = require("node:path");
const swaggerJsdoc = require("swagger-jsdoc");
const settings = require("./settings");
const packageInfo = require("../../package.json");

/**
 * Generate the OpenAPI document from route-level JSDoc annotations.
 *
 * Keeping endpoint schemas beside their Express route handlers helps ensure
 * the interactive documentation remains close to the implementation.
 * `failOnErrors` makes malformed OpenAPI annotations fail during startup and
 * in tests instead of silently producing an incomplete specification.
 *
 * @returns {object} Generated OpenAPI 3.0.3 document.
 */
function buildSwaggerDocument() {
  const document = swaggerJsdoc({
    definition: {
      openapi: "3.0.3",
      info: {
        title: "Link Shortener API",
        version: packageInfo.version,
        description: [
          "REST API for creating short links and redirecting users to their original destinations.",
          "Short codes contain six alphanumeric characters. Destination URLs must use HTTP or HTTPS.",
        ].join(" "),
        contact: {
          name: "API Support",
        },
      },
      servers: [
        {
          url: settings.shortUrlBase,
          description: process.env.NODE_ENV === "production"
            ? "Production server"
            : "Local development server",
        },
      ],
      tags: [
        { name: "System", description: "Service status and health endpoints." },
        { name: "URL Shortener", description: "Create short URLs and follow redirects." },
      ],
      components: {
        schemas: {
          Error: {
            type: "object",
            required: ["error"],
            properties: {
              error: {
                type: "string",
                description: "Stable machine-readable error identifier.",
                example: "internal-server-error",
              },
            },
          },
        },
      },
    },
    // Use concrete paths instead of a wildcard. swagger-jsdoc resolves input
    // files from the current working directory; deriving the relative paths
    // here keeps discovery reliable on Windows and POSIX systems, even when
    // the process is launched from a directory other than the project root.
    apis: ["../routes/health.js", "../routes/shortner.js"].map((routeFile) =>
      path.relative(
        process.cwd(),
        path.resolve(__dirname, routeFile),
      ).split(path.sep).join("/"),
    ),
    failOnErrors: true,
  });

  const requiredOperations = [
    ["/health", "get"],
    ["/shorten", "post"],
    ["/{code}", "get"],
  ];
  const missingOperations = requiredOperations.filter(([routePath, method]) =>
    !document.paths?.[routePath]?.[method],
  );

  if (missingOperations.length > 0) {
    const missing = missingOperations
      .map(([routePath, method]) => `${method.toUpperCase()} ${routePath}`)
      .join(", ");
    throw new Error(
      `OpenAPI generation did not discover these route annotations: ${missing}. ` +
      "Check the @openapi JSDoc blocks in src/routes.",
    );
  }

  return document;
}

const swaggerDocument = buildSwaggerDocument();

module.exports = swaggerDocument;
