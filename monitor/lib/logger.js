"use strict";
var util    = require('util');
var winston = require('winston');
var path    = require('path');

function commNameTimestamp() {
  var suffix = cluster.isWorker ? cluster.worker.id : 0;
  return util.format('%s comm-%s', new Date().toISOString(), suffix);
}

var transports = [
  new(winston.transports.Console)({
    level:    'debug',
    colorize:  true,
    timestamp: util.format('%s %s', new Date().toISOString())
  }),
];

// set up the log levels
var levels = {
  trace:   0,
  debug:   1,
  verbose: 2,
  info:    3,
  notice:  4,
  warn:    4,
  error:   5,
  crit:    6
};

var colors = {
  trace:   'grey',
  debug:   'cyan',
  verbose: 'blue',
  info:    'green',
  notice:  'magenta',
  warn:    'yellow',
  error:   'red',
  crit:    'red'
};

winston.addColors(colors);

// instantiate the logger
var logger = new(winston.Logger)({
  transports: transports,
  levels:     levels,
});

module.exports = logger;
