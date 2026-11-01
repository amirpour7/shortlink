/**
 * Return a consistent JSON 404 response when no route or static file matches.
 *
 * @param {import("express").Request} req Incoming HTTP request.
 * @param {import("express").Response} res Outgoing HTTP response.
 * @returns {import("express").Response} JSON 404 response.
 */
function notFound(req, res) {
  void req;
  return res.status(404).json({ error: "not-found" });
}

module.exports = notFound;
