const databaseModule = require("../db/database");

let cachedDatabase;
let statements;

/**
 * Return prepared statements for the active database connection.
 *
 * Statements are cached for performance and recreated if the underlying
 * connection has been closed and reopened.
 *
 * @returns {{insertUrl: import("better-sqlite3").Statement, findUrlByCode: import("better-sqlite3").Statement, codeExists: import("better-sqlite3").Statement}}
 * Prepared statements used by this repository.
 */
function getStatements() {
  const database = databaseModule.getDatabase();

  if (database !== cachedDatabase) {
    cachedDatabase = database;
    statements = {
      insertUrl: database.prepare(
        "INSERT INTO urls (code, url) VALUES (?, ?)",
      ),
      findUrlByCode: database.prepare(
        "SELECT url FROM urls WHERE code = ?",
      ),
      codeExists: database.prepare(
        "SELECT 1 FROM urls WHERE code = ? LIMIT 1",
      ),
    };
  }

  return statements;
}

/**
 * Insert a short-code-to-URL mapping.
 *
 * The `code` column is a primary key, so duplicate codes are rejected by
 * SQLite rather than overwriting an existing destination.
 *
 * @param {string} code Six-character alphanumeric short code.
 * @param {string} url Normalized destination URL.
 * @returns {import("better-sqlite3").RunResult} SQLite insert result.
 * @throws {Error} When SQLite rejects the insert or cannot write to the DB.
 */
function insertUrl(code, url) {
  return getStatements().insertUrl.run(code, url);
}

/**
 * Find the destination URL for a short code.
 *
 * @param {string} code Short code to look up.
 * @returns {{url: string} | undefined} Matching row, or `undefined` if absent.
 */
function findUrlByCode(code) {
  return getStatements().findUrlByCode.get(code);
}

/**
 * Check whether a short code is already stored.
 *
 * @param {string} code Candidate short code.
 * @returns {boolean} `true` when the code already exists in SQLite.
 */
function codeExists(code) {
  return Boolean(getStatements().codeExists.get(code));
}

/**
 * Close the repository's database connection and invalidate cached statements.
 *
 * @returns {void}
 */
function closeDatabase() {
  databaseModule.closeDatabase();
  cachedDatabase = undefined;
  statements = undefined;
}

module.exports = {
  insertUrl,
  findUrlByCode,
  codeExists,
  closeDatabase,
};
