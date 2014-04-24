"use strict";
var winston = require('winston');

var customLevels = {
  levels: {
    silly: 0,
    debug: 1,
    verbose: 2,
    info: 3,
    notice: 4,
    warn: 4,
    error: 5,
    crit: 6
  },
  colors: {
    silly: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    info: 'green',
    notice: 'magenta',
    warn: 'yellow',
    error: 'red',
    crit: 'red'
  }
};

winston.addColors(customLevels.colors);

var logger = new(winston.Logger)({
  transports: [
    new(winston.transports.Console)({
      level: 'debug',
      colorize: true,
      timestamp: true,
    })
  ],
  levels: customLevels.levels,
});

module.exports = logger;
