/**
 * Backward-compatible entry point for the original `shortner.js` module name.
 *
 * The implementation is maintained in `services/shortenerService.js`; this
 * file remains so existing imports do not break while the project evolves.
 *
 * @module shortner
 * @see module:services/shortenerService
 */
module.exports = require("./services/shortenerService");
