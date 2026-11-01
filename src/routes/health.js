const express = require("express");

const router = express.Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - System
 *     summary: Health check
 *     description: Confirms that the Express application is responding.
 *     operationId: getHealth
 *     responses:
 *       200:
 *         description: The service is healthy.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [ok]
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 */
router.get("/", (req, res) => {
  void req;
  res.status(200).json({ ok: true });
});

module.exports = router;
