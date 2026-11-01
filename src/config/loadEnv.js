const path = require("node:path");
const dotenv = require("dotenv");

// Resolve the file from the project root, not from process.cwd().
const DEFAULT_ENV_PATH = path.resolve(__dirname, "../../.env");

/**
 * Load variables from a dotenv file into a target environment object.
 *
 * Values already supplied by the operating system or deployment platform take
 * precedence unless `override` is explicitly enabled. A missing optional file
 * is not an error, which allows production platforms to inject variables.
 *
 * @param {object} [options] Loader options.
 * @param {string} [options.envPath] Absolute or relative dotenv file path.
 * @param {NodeJS.ProcessEnv|Record<string, string>} [options.target=process.env]
 * Destination object receiving parsed variables.
 * @param {boolean} [options.override=false] Replace existing target values.
 * @returns {{loaded: boolean, path: string, values: Record<string, string>}}
 * Result containing whether a file was loaded, its path and parsed values.
 * @throws {Error} If the file exists but cannot be read or parsed from disk.
 */
function loadEnvironment({
  envPath = DEFAULT_ENV_PATH,
  target = process.env,
  override = false,
} = {}) {
  const result = dotenv.config({
    path: envPath,
    processEnv: target,
    override,
    quiet: true,
  });

  if (result.error && result.error.code !== "ENOENT") {
    const loadError = new Error("Unable to read the environment configuration file.", {
      cause: result.error,
    });
    loadError.code = "ENV_FILE_LOAD_FAILED";
    throw loadError;
  }

  return {
    loaded: !result.error,
    path: envPath,
    values: result.parsed || {},
  };
}

module.exports = {
  DEFAULT_ENV_PATH,
  loadEnvironment,
};
