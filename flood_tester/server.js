/**
 * pubnubApi.js
 * subscribe and publish to pubnub channels for client/server communication
 */
"use strict";
var PUBNUB = require('pubnub');
var logger = require('./logger');
var CONFIG = require('./config');

var CHANNELS_PER_PUBNUB = 25;
var CHANNELS = {};

var currentPubnub = null;
var totalPubnubs = 0;
var numServerConnectChannels;
var testCount = 0;

var getPubnubSettings = function() {
  /* jshint camelcase: false */
  return {
    publish_key: CONFIG.PUBLISH_KEY,
    subscribe_key: CONFIG.SUBSCRIBE_KEY,
    /*
    secret_key: CONFIG.PUBNUB_SECRET_KEY,
    auth_key: CONFIG.PUBNUB_SECRET_KEY,
    */
    ssl: true,
    uuid: CONFIG.COMM_NAME
  };
};

var createPubnub = function(channel) {
  if (Object.keys(CHANNELS).length % CHANNELS_PER_PUBNUB === 0) {
    currentPubnub = PUBNUB.init(getPubnubSettings());
    totalPubnubs += 1;
    logger.notice('totalPubnubs:', totalPubnubs);
  }
  CHANNELS[channel] = currentPubnub;
  return CHANNELS[channel];
};

var getPubnub = function(channel) {
  if (channel in CHANNELS) {
    return CHANNELS[channel];
  }
  return createPubnub(channel);
};

var publishMessage = function(uuid, type, data) {
  var channel = CONFIG.SERVER_PREFIX + uuid;
  var message = data;
  message.type = type;

  var messageStr = JSON.stringify(message);
  logger.debug(channel, messageStr);

  getPubnub(channel).publish({
    channel: channel,
    message: message,
    callback: function(result) {
      if (result[0] === 0) {
        logger.debug(result);
      }
    },
    error: function(error) {
      logger.error('ERROR publishing message', channel, messageStr, error);
    }
  });
};

var shutdown = function() {
  /*jshint camelcase:false*/
  /*jshint -W083 */ // XXX don't make functions in a loop!
  logger.info("Shutting down PubNub API...");
  var uuid;
  for (uuid in CHANNELS) {
    if (CHANNELS.hasOwnProperty(uuid)) {
      CHANNELS[uuid].where_now({
        uuid: CONFIG.COMM_NAME,
        callback: function(m) {
          if (m.channels) {
            logger.debug("PubNub unsubscribe from " + JSON.stringify(m.channels));
            CHANNELS[uuid].unsubscribe({
              channel: m.channels
            });
          } else {
            logger.warn("I'm not suscribed to any PubNub channels, weird!");
          }
        },
        error: function(m) {
          logger.error("Error with shutdown where_now(): " + JSON.stringify(m));
        }
      });
    }
  }
  process.exit(0);
};

//process.on('exit', gracefulShutdown);
process.on('SIGHUP', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

var timer = function() {
  setTimeout(function() {
    logger.notice('CPS Received:', testCount / 10);
    testCount = 0;
    timer();
  }, 10 * 1000);
};

timer();

var numPrivateChannels = 0;

var unsubscribePrivateChannel = function(uuid) {
  var SUCCESS_TRUE_MESSAGE = {
    success: true
  };

  getPubnub(uuid).unsubscribe({
    channel: CONFIG.CLIENT_PREFIX + uuid,
  });
  numPrivateChannels -= 1;
  publishMessage(uuid, 'disconnected', SUCCESS_TRUE_MESSAGE);
};

//var GRANT_ALL_AUTH_KEY = 'insecure';
var handlePrivateMessage = function(uuid, message) {
  //console.log(CLIENT_PREFIX + uuid, message);

  // XXX it sure would be nice if the return values didn't require this
  var type = message.type;
  var data = message;

  /*
  // some convenient closures
  var pub = function(type, message) {
    return publishMessage(uuid, type, message);
  };

  var unsub = function() {
    return unsubscribePrivateChannel(uuid);
  };
*/

  switch (type) {
    case 'count':
      testCount += 1;
      //      logger.debug('Test Count:', testCount);
      break;
    default:
      logger.warn('invalid message: ', type, data);
      break;
  }
};

var handlePrivateMessageWrapper = function(uuid, message) {
  try {
    handlePrivateMessage(uuid, message);
  } catch (error) {
    if (error.hasOwnProperty('stack')) {
      logger.error('handlePrivateMessage:', error.stack);
    } else {
      logger.error('handlePrivateMessage:', JSON.stringify(error));
    }
  }
};

var subscribePrivateChannel = function(uuid) {
  /*jshint camelcase:false*/

  var SUCCESS_TRUE_MESSAGE = {
    success: true
  };

  // a convenient closure
  var pub = function(type, message) {
    return publishMessage(uuid, type, message);
  };

  var clientChannel = CONFIG.CLIENT_PREFIX + uuid;
  var pubnub = getPubnub(clientChannel);

  var alreadySubscribed = false;

  pubnub.here_now({
    channel: clientChannel,
    callback: function(hereNow) {
      var i;
      for (i = 0; i < hereNow.uuids.length; i += 1) {
        if (hereNow.uuids[i] === CONFIG.COMM_NAME) {
          logger.notice("I'm already listening to:", clientChannel);
          pub('connected', SUCCESS_TRUE_MESSAGE);
          alreadySubscribed = true;
          return;
        }
      }

      pubnub.unsubscribe({
        channel: clientChannel
      });

      // privateAuthGrant(id, isDriver);

      pubnub.subscribe({
        channel: clientChannel,
        callback: function(message) {
          handlePrivateMessageWrapper(uuid, message);
        },
        connect: function() {
          logger.info("Subscribed to " + clientChannel);
          pub('connected', SUCCESS_TRUE_MESSAGE);
          numPrivateChannels += 1;
          logger.notice('Count Private Channels:', numPrivateChannels);
        },
        disconnect: function() {
          logger.info("Disconnected from " + clientChannel);
          numPrivateChannels -= 1;
          pub('disconnected', SUCCESS_TRUE_MESSAGE);
        },
        error: function(error) {
          logger.error(clientChannel, "ERROR:", error);
        },
        reconnect: function() {
          logger.info("Reconnected to " + clientChannel);
          numPrivateChannels += 1;
          pub('reconnected', SUCCESS_TRUE_MESSAGE);
        },
      });
    }
  });
};

var presenceConnectChannel = function(message) {
  if (message.uuid === CONFIG.COMM_NAME) {
    return;
  }
  logger.debug('Presence connect:', message);
  switch (message.action) {
    case 'join':
      subscribePrivateChannel(message.uuid);
      break;
    case 'leave':
    case 'timeout':
      unsubscribePrivateChannel(message.uuid);
      break;
    default:
      logger.debug('Unknown presence action:', message.action);
      break;
  }
};

var subscribeServerConnectChannel = function(serverConnectChannel) {
  /*jshint camelcase:false*/
  var pubnub = getPubnub(serverConnectChannel);

  var occupancy = 0;
  pubnub.here_now({
    channel: serverConnectChannel,
    callback: function(hereNow) {
      occupancy = hereNow.occupancy;
    }

  });

  pubnub.subscribe({
    channel: serverConnectChannel,
    callback: function() {
      logger.debug('ignored message sent on', serverConnectChannel);
    },
    connect: function() {
      logger.debug('Subscribed to', serverConnectChannel);
    },
    disconnect: function() {
      logger.info('Disconnected from', serverConnectChannel);
    },
    error: function(error) {
      logger.error(serverConnectChannel, error);
    },
    reconnect: function() {
      logger.info('Reconnected to', serverConnectChannel);
    },
    presence: presenceConnectChannel
  });
};

var PRESENCE_SUBS_PER_CHANNEL = 20; // Max without 'global cloud'
var SERVER_CONNECT_SUBSCRIBE_BUFFER_TIME = 10;

var subscribeConnectChannel = function() {

  // Auto listen to people who join the Server Connect channel

  //this stuff should get recalulated every time
  var numActiveIds = Math.floor(4000);
  var numServers = 1;
  var commNumber = 0;
  numServerConnectChannels = numActiveIds / PRESENCE_SUBS_PER_CHANNEL;
  var connectChannelsPerServer = numServerConnectChannels / numServers;

  logger.info('Spawning', connectChannelsPerServer,
    'server connect channels...');

  var baseChannelNum = commNumber * connectChannelsPerServer;

  var totalOccupancy = 0;
  var subscribeBuffer = function(i) {
    if (i < 0) {
      logger.info('Subscribed to', connectChannelsPerServer,
        'server connect channels');
      return;
    }
    setTimeout(function() {
      var channelNum = baseChannelNum + i;
      var serverConnectChannel = CONFIG.SERVER_CONNECT_CHANNEL_PREFIX + channelNum;
      totalOccupancy += subscribeServerConnectChannel(serverConnectChannel, channelNum);
      subscribeBuffer(i - 1);
    }, SERVER_CONNECT_SUBSCRIBE_BUFFER_TIME);
  };

  subscribeBuffer(connectChannelsPerServer);
};

var init = function() {
  logger.info("PubNub API initializing...");
  logger.debug(CONFIG.PUBLISH_KEY);
  logger.debug(CONFIG.SUBSCRIBE_KEY);
  subscribeConnectChannel();
};

module.exports = {
  init: init
};

init();
