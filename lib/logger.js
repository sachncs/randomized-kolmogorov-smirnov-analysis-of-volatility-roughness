/**
 * @fileoverview Minimal leveled logger for RK-SAVR.
 *
 * Provides a tiny four-level logger (`debug`, `info`, `warn`, `error`)
 * plus a `SILENT` cut-off. The default level is `WARN` so that production
 * callers see only genuinely important messages; tests typically call
 * `setLogLevel(LogLevel.SILENT)` to keep their output clean.
 *
 * The implementation routes every call through one private dispatcher
 * that routes to `console.error/warn/info/debug` based on the level. This
 * keeps the public API minimal (`debug`, `info`, `warn`, `error`) and
 * consistent with the rest of the project.
 *
 * ## Thread safety
 *
 * The current level lives in a module-level `let` variable. The logger is
 * not designed for multi-threaded environments — call sites that mutate
 * the level should serialize.
 */

/**
 * Severity levels, numerically ordered from most to least verbose.
 *
 * - `DEBUG` (0): per-step diagnostics, only useful for tracing algorithm
 *   internals.
 * - `INFO` (1): high-level progress messages.
 * - `WARN` (2): recoverable issues (default cut-off).
 * - `ERROR` (3): unhandled failures during processing.
 * - `SILENT` (4): disables all logging; convenience for tests.
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4,
};

let currentLevel = LogLevel.WARN;

/**
 * Sets the current log level.
 *
 * @param {number} level One of the `LogLevel` numeric constants.
 */
export function setLogLevel(level) {
  currentLevel = level;
}

/**
 * Reads the current log level.
 *
 * @return {number} Active `LogLevel` value.
 */
export function getLogLevel() {
  return currentLevel;
}

/**
 * Internal dispatcher: drops the message if it falls below the configured
 * cut-off, otherwise forwards to the appropriate `console.*` channel.
 *
 * @private
 * @param {number} level Log level (one of `LogLevel.*`).
 * @param {string} label Short human label (`DEBUG`, `INFO`, ...).
 * @param {Array<*>} args Arguments to forward to the underlying console.
 */
function log(level, label, args) {
  if (level < currentLevel) return;
  const prefix = `[RK-SAVR ${label}]`;
  if (level === LogLevel.ERROR) {
    console.error(prefix, ...args);
  } else if (level === LogLevel.WARN) {
    console.warn(prefix, ...args);
  } else if (level === LogLevel.INFO) {
    console.info(prefix, ...args);
  } else {
    console.debug(prefix, ...args);
  }
}

/**
 * Emits a message at `DEBUG` level.
 *
 * @param {...*} args Values forwarded to `console.debug`.
 */
export function debug(...args) {
  log(LogLevel.DEBUG, 'DEBUG', args);
}

/**
 * Emits a message at `INFO` level.
 *
 * @param {...*} args Values forwarded to `console.info`.
 */
export function info(...args) {
  log(LogLevel.INFO, 'INFO', args);
}

/**
 * Emits a message at `WARN` level (visible by default).
 *
 * @param {...*} args Values forwarded to `console.warn`.
 */
export function warn(...args) {
  log(LogLevel.WARN, 'WARN', args);
}

/**
 * Emits a message at `ERROR` level (visible by default).
 *
 * @param {...*} args Values forwarded to `console.error`.
 */
export function error(...args) {
  log(LogLevel.ERROR, 'ERROR', args);
}
