const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const settings = require("../config/settings");

let database;

/**
 * Open and initialize the shared SQLite connection on first use.
 *
 * The database directory is created automatically for file-backed databases.
 * The schema enforces a six-character alphanumeric primary key and a maximum
 * URL length, providing a second validation boundary below the service layer.
 *
 * @returns {import("better-sqlite3").Database} Initialized SQLite connection.
 * @throws {Error} If the database cannot be opened or initialized.
 */
function getDatabase() {
  if (database) {
    return database;
  }

  const databasePath = settings.databasePath;
  let connection;

  if (databasePath !== ":memory:") {
    const resolvedPath = path.resolve(databasePath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    connection = new Database(resolvedPath);
  } else {
    connection = new Database(":memory:");
  }

  try {
    connection.pragma("busy_timeout = 5000");
    connection.pragma("foreign_keys = ON");
    connection.pragma("journal_mode = WAL");
    connection.exec(`
      CREATE TABLE IF NOT EXISTS urls (
        code TEXT PRIMARY KEY
          CHECK (
            length(code) = 6 AND
            code NOT GLOB '*[^A-Za-z0-9]*'
          ),
        url TEXT NOT NULL CHECK (length(url) <= 2048),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Publish the connection only after all initialization steps succeed.
    database = connection;
    return database;
  } catch (error) {
    connection.close();
    throw error;
  }
}

/**
 * Close the shared SQLite connection, if it has been opened.
 *
 * Safe to call repeatedly. The next call to {@link getDatabase} will create a
 * fresh connection and initialize the schema again.
 *
 * @returns {void}
 */
function closeDatabase() {
  if (database) {
    database.close();
    database = undefined;
  }
}

module.exports = { getDatabase, closeDatabase };
