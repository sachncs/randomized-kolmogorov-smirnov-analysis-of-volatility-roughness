/**
 * Logger tests.
 */

import {describe, it} from 'mocha';
import {expect} from 'chai';
import {
  LogLevel,
  setLogLevel,
  getLogLevel,
  debug,
  info,
  warn,
  error,
} from '../lib/logger.js';

describe('Logger', function () {
  it('has correct log level values', function () {
    expect(LogLevel.DEBUG).to.equal(0);
    expect(LogLevel.INFO).to.equal(1);
    expect(LogLevel.WARN).to.equal(2);
    expect(LogLevel.ERROR).to.equal(3);
    expect(LogLevel.SILENT).to.equal(4);
  });

  it('gets and sets log level', function () {
    setLogLevel(LogLevel.ERROR);
    expect(getLogLevel()).to.equal(LogLevel.ERROR);
    setLogLevel(LogLevel.WARN);
    expect(getLogLevel()).to.equal(LogLevel.WARN);
  });

  it('debug logs only when level is DEBUG', function () {
    setLogLevel(LogLevel.DEBUG);
    expect(() => debug('test')).to.not.throw();
    setLogLevel(LogLevel.INFO);
    expect(() => debug('test')).to.not.throw();
  });

  it('info logs only when level is INFO or lower', function () {
    setLogLevel(LogLevel.INFO);
    expect(() => info('test')).to.not.throw();
    setLogLevel(LogLevel.WARN);
    expect(() => info('test')).to.not.throw();
  });

  it('warn logs when level is WARN or lower', function () {
    setLogLevel(LogLevel.WARN);
    expect(() => warn('test')).to.not.throw();
    setLogLevel(LogLevel.ERROR);
    expect(() => warn('test')).to.not.throw();
  });

  it('error logs when level is ERROR or lower', function () {
    setLogLevel(LogLevel.ERROR);
    expect(() => error('test')).to.not.throw();
    setLogLevel(LogLevel.SILENT);
    expect(() => error('test')).to.not.throw();
  });

  it('handles multiple arguments', function () {
    setLogLevel(LogLevel.DEBUG);
    expect(() => debug('a', 'b', 123)).to.not.throw();
    setLogLevel(LogLevel.WARN);
  });
});
