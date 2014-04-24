/**
 *
 */
"use strict";
var logger = require('./logger');
var Client = require('./Client');

var UUID_PREFIX = 'FLOOD-TESTER';

var NUM_DRIVERS = parseInt(process.argv[2]);
var COUNT_TIMEOUT = parseInt(process.argv[3]);
var CHANNELS = [];
var channelsOnline = 0;
var countsSent = 0;
var PRESENCE_TIMEOUT = 200;
var TIMER_SECS = 5;
var TIMER_TIMEOUT = TIMER_SECS * 1000;


Client.prototype.connectedHook = function() {
  channelsOnline += 1;
};

var waitConnect = function(i) {
  if (i >= NUM_DRIVERS) {
    return;
  }
  setTimeout(function() {
    try {
      CHANNELS[i].onConnect();
    } catch (err) {
      logger.error('connect:', err.stack);
    }
    waitConnect(i + 1);
  }, PRESENCE_TIMEOUT);
};

var counter = function(i) {
  if (i >= CHANNELS.length) {
    i = 0;
  }
  setTimeout(function() {
    CHANNELS[i].onCount();
    countsSent += 1;
    counter(i + 1);
  }, COUNT_TIMEOUT);
};

var timer = function() {
  setTimeout(function() {
    logger.info('CPS Sent:', countsSent / TIMER_SECS);
    countsSent = 0;
    timer();
  }, TIMER_TIMEOUT);
};

var waitChannelsOnline = function() {
  if (channelsOnline >= NUM_DRIVERS) {
    logger.info('ALL', channelsOnline, 'CHANNELS CONNECTED!');
    counter(0);
    timer();
    return;
  }
  logger.debug(channelsOnline, 'channels connected');
  setTimeout(waitChannelsOnline, 5 * 1000);
};

var run = function() {

  if (isNaN(NUM_DRIVERS) || NUM_DRIVERS < 0) {
    logger.error('bad number of drivers:', NUM_DRIVERS);
    process.kill(process.pid);
  }

  if (isNaN(COUNT_TIMEOUT) || COUNT_TIMEOUT < 0) {
    logger.error('bad count timeout:', COUNT_TIMEOUT);
    process.kill(process.pid);
  }


  var i;
  for (i = 0; i < NUM_DRIVERS; i += 1) {
    var uuid = UUID_PREFIX + i;
    var client = new Client(uuid);
    CHANNELS.push(client);
  }

  waitConnect(0);
  waitChannelsOnline();
};

run();
