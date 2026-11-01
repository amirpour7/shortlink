const express = require("express");
const { rateLimit } = require("express-rate-limit");
const {
  createShortUrl,
  geturl,
  AppError,
} = require("../services/shortenerService");
const settings = require("../config/settings");

/**
 * @openapi
 * /shorten:
 *   post:
 *     tags:
 *       - URL Shortener
 *     summary: Create a short URL
 *     description: Validates an HTTP(S) URL, stores it in SQLite and returns a unique six-character code with its public short URL.
 *     operationId: createShortUrl
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url]
 *             additionalProperties: false
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 maxLength: 2048
 *                 example: https://example.com/articles/express
 *     responses:
 *       201:
 *         description: Short URL created and stored successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [code, shorturl]
 *               properties:
 *                 code:
 *                   type: string
 *                   pattern: '^[A-Za-z0-9]{6}$'
 *                   example: aB12xZ
 *                 shorturl:
 *                   type: string
 *                   format: uri
 *                   example: http://localhost:3000/aB12xZ
 *       400:
 *         description: Malformed JSON or malformed HTTP request.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       413:
 *         description: Request body exceeds the configured JSON size limit.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       415:
 *         description: Content-Type is not JSON or uses an unsupported encoding.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       422:
 *         description: URL is missing or does not satisfy the shortener URL policy.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       429:
 *         description: Per-IP request limit has been exceeded.
 *         headers:
 *           RateLimit:
 *             schema: { type: string }
 *             description: Standard rate-limit metadata, when provided by the middleware.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Unexpected internal server error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       503:
 *         description: The database or short-code generator is temporarily unavailable.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */

/**
 * @openapi
 * /{code}:
 *   get:
 *     tags:
 *       - URL Shortener
 *     summary: Redirect using a short code
 *     description: Looks up a six-character code and responds with HTTP 302 and a Location header pointing to the original URL.
 *     operationId: redirectToOriginalUrl
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         description: Six-character alphanumeric short code.
 *         schema:
 *           type: string
 *           pattern: '^[A-Za-z0-9]{6}$'
 *         example: aB12xZ
 *     responses:
 *       302:
 *         description: Short code exists; the client should navigate to the original URL.
 *         headers:
 *           Location:
 *             required: true
 *             description: Original destination URL.
 *             schema:
 *               type: string
 *               format: uri
 *             example: https://example.com/articles/express
 *       404:
 *         description: Code is invalid, unregistered, or no longer allowed by redirect policy.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       429:
 *         description: Per-IP lookup request limit has been exceeded.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Unexpected internal server error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       503:
 *         description: The database is temporarily unavailable.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */

/**
 * Create the URL-shortener router.
 *
 * The factory form allows integration tests and alternate app instances to
 * inject limits or a public URL origin without changing process-wide settings.
 * Register this router after static files and documentation routes because
 * `GET /:code` is intentionally a catch-all one-segment redirect endpoint.
 *
 * @param {object} [options] Router configuration overrides.
 * @param {string} [options.shortUrlBase] Public origin used in generated links.
 * @param {{windowMs?: number, limit?: number, lookupLimit?: number}} [options.rateLimit]
 * Per-IP rate-limit overrides, primarily useful for tests.
 * @param {string|number} [options.jsonBodyLimit] Express JSON body size limit.
 * @returns {import("express").Router} Configured Express router.
 */
function createShortenerRouter(options = {}) {
  const router = express.Router();
  const shortUrlBase = settings.validateShortUrlBase(
    options.shortUrlBase || settings.shortUrlBase,
  );
  const windowMs = options.rateLimit?.windowMs ?? settings.shortenRateLimitWindowMs;

  const shortenLimiter = rateLimit({
    windowMs,
    limit: options.rateLimit?.limit ?? settings.shortenRateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ error: "rate-limit-exceeded" });
    },
  });

  const lookupLimiter = rateLimit({
    windowMs,
    limit: options.rateLimit?.lookupLimit ?? settings.lookupRateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ error: "rate-limit-exceeded" });
    },
  });

  router.post(
    "/shorten",
    shortenLimiter,
    express.json({
      limit: options.jsonBodyLimit || settings.jsonBodyLimit,
      strict: true,
      type: ["application/json", "application/*+json"],
    }),
    (req, res, next) => {
      if (!req.is(["application/json", "application/*+json"])) {
        return res.status(415).json({ error: "unsupported-media-type" });
      }

      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(422).json({ error: "invalid-json" });
      }

      try {
        const { code } = createShortUrl(req.body.url);

        return res.status(201).json({
          code,
          shorturl: `${shortUrlBase}/${code}`,
        });
      } catch (error) {
        // Preserve the API's original error response for invalid URLs.
        if (error instanceof AppError && error.errorCode === "invalid-url") {
          return res.status(422).json({ error: "invalid-json" });
        }

        return next(error);
      }
    },
  );

  router.get("/:code", lookupLimiter, (req, res) => {
    const originalUrl = geturl(req.params.code);

    if (!originalUrl) {
      return res.status(404).json({ error: "404 Not Found" });
    }

    return res.redirect(302, originalUrl);
  });

  return router;
}

const router = createShortenerRouter();
router.createShortenerRouter = createShortenerRouter;

module.exports = router;
