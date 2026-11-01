/**
 * Convert known parser, request and application errors into safe JSON responses.
 *
 * Internal error details are logged server-side for 5xx failures but are never
 * sent to clients. If headers have already been sent, Express receives the
 * original error so its default connection/error handling can take over.
 *
 * @param {Error & {type?: string, code?: string, statusCode?: number, errorCode?: string, isOperational?: boolean}} error Error passed by Express.
 * @param {import("express").Request} req Incoming HTTP request.
 * @param {import("express").Response} res Outgoing HTTP response.
 * @param {import("express").NextFunction} next Express continuation callback.
 * @returns {void}
 */
function errorHandler(error, req, res, next) {
  void req;

  if (res.headersSent) {
    return next(error);
  }

  let statusCode = 500;
  let errorCode = "internal-server-error";

  if (error.type === "entity.parse.failed") {
    statusCode = 400;
    errorCode = "invalid-json";
  } else if (error.type === "request.aborted") {
    statusCode = 400;
    errorCode = "request-aborted";
  } else if (error.type === "request.size.invalid") {
    statusCode = 400;
    errorCode = "invalid-content-length";
  } else if (error.type === "entity.verify.failed") {
    statusCode = 403;
    errorCode = "entity-verification-failed";
  } else if (error.type === "entity.too.large") {
    statusCode = 413;
    errorCode = "payload-too-large";
  } else if (
    error.type === "charset.unsupported" ||
    error.type === "encoding.unsupported"
  ) {
    statusCode = 415;
    errorCode = "unsupported-media-type";
  } else if (error instanceof URIError) {
    statusCode = 400;
    errorCode = "invalid-path-parameter";
  } else if (
    typeof error.code === "string" &&
    (error.code.startsWith("SQLITE_BUSY") || error.code.startsWith("SQLITE_LOCKED"))
  ) {
    statusCode = 503;
    errorCode = "database-temporarily-unavailable";
  } else if (error.isOperational && Number.isInteger(error.statusCode)) {
    statusCode = error.statusCode;
    errorCode = error.errorCode;
  }

  if (statusCode >= 500 && process.env.NODE_ENV !== "test") {
    console.error("Unhandled application error:", error);
  }

  return res.status(statusCode).json({ error: errorCode });
}

module.exports = errorHandler;
