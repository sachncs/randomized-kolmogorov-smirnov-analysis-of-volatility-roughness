/**
 * Minimal logging framework for RK-SAVR.
 * Defaults to WARN level in production; can be tuned via setLogLevel.
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
 * @param {number} level One of LogLevel values.
 */
export function setLogLevel(level) {
  currentLevel = level;
}

/**
 * Gets the current log level.
 * @return {number} Current log level.
 */
export function getLogLevel() {
  return currentLevel;
}

/**
 * Internal log dispatcher.
 * @param {number} level Log level.
 * @param {string} label Level label.
 * @param {Array<*>} args Arguments to log.
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

/** @param {...*} args */
export function debug(...args) {
  log(LogLevel.DEBUG, 'DEBUG', args);
}

/** @param {...*} args */
export function info(...args) {
  log(LogLevel.INFO, 'INFO', args);
}

/** @param {...*} args */
export function warn(...args) {
  log(LogLevel.WARN, 'WARN', args);
}

/** @param {...*} args */
export function error(...args) {
  log(LogLevel.ERROR, 'ERROR', args);
}
