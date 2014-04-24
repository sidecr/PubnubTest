"use strict";
var PUBNUB = require('pubnub');
var CONFIG = require('./config');
var logger = require('./logger');

var Client = function(uuid) {
  logger.debug('initializing.');

  if (uuid) {
    this.UUID = uuid;
  }
  this.pubnub = PUBNUB.init(this.getPubNubArgs(uuid));
  if (!this.UUID) {
    this.UUID = this.pubnub.uuid();
  }

  this.COMM_NAME = CONFIG.COMM_NAME;
  //  this.CLIENT_CONNECT_CHANNEL = 'client_connect_' + this.COMM_NAME;
  var NUM_SERVER_CONNECT_CHANNELS = 200; //XXX get this from comm or something
  // deliver ^^^ that number via AppAPI

  var connectNum = Math.floor(Math.random() * NUM_SERVER_CONNECT_CHANNELS);
  this.SERVER_CONNECT_CHANNEL = 'server_connect_' + this.COMM_NAME + '_' + connectNum;
  this.CLIENT_CHANNEL = 'client_' + this.UUID;
  this.SERVER_CHANNEL = 'server_' + this.UUID;
};

Client.prototype.onError = function(error) {
  logger.error(error);
};

Client.prototype.showOutput = function(message) {
  logger.debug(JSON.stringify(message));
};

Client.prototype.publish = function(channel, type, data, callback) {
  var message = data;
  message.type = type;

  logger.silly(JSON.stringify(message));

  var options = {
    channel: channel,
    message: message,
    callback: callback,
    error: this.onError.bind(this),
  };
  if (callback) {
    options.callback = callback;
  }

  this.pubnub.publish(options);
};

Client.prototype.privateChannelCallback = function(message) {
  this.showOutput(this.SERVER_CHANNEL, message);
  switch (message.type) {
    case 'connected':
      this.connected();
      break;
    default:
      logger.warn('unknown messsage', message);
      break;
  }
};


Client.prototype.publicChannelCallback = function(message) {
  if (message.type === 'reconnect') {
    this.connect();
  }
};

Client.prototype.onConnect = function() {
  this.connect();
};

Client.prototype.subscribeToPrivateChannel = function() {
  this.pubnub.subscribe({
    channel: this.SERVER_CHANNEL,
    callback: this.privateChannelCallback.bind(this),
    connect: function() {
      logger.debug('Subscribed to', this.SERVER_CHANNEL);
      this.subscribeToPublicChannel();
    }.bind(this),
    disconnect: function() {
      this.publish(this.CLIENT_CHANNEL, 'disconnect', {});
    }.bind(this),
    error: this.onError.bind(this),
    reconnect: function() {
      this.publish(this.CLIENT_CHANNEL, 'reconnect', {});
    }.bind(this),
    restore: true
  });
};

Client.prototype.subscribeToPublicChannel = function() {
  this.pubnub.subscribe({
    channel: this.SERVER_CONNECT_CHANNEL,
    callback: this.publicChannelCallback.bind(this),
    connect: function() {
      logger.debug('Subscribed to', this.SERVER_CONNECT_CHANNEL);
      //      this.publishConnectMessage();
    }.bind(this),
    disconnect: function() {
      logger.debug('Disconnected from', this.SERVER_CONNECT_CHANNEL);
    }.bind(this),
    reconnect: function() {
      logger.debug('Reconnected to', this.SERVER_CONNECT_CHANNEL);
    }.bind(this),
    error: this.onError.bind(this),
  });
};

Client.prototype.connect = function() {
  this.onDisconnect();
  this.subscribeToPrivateChannel();
};

Client.prototype.pong = function(message) {
  if (this.pongHook) {
    this.pongHook(message);
  }
};

Client.prototype.disconnectAllChannels = function() {
  this.pubnub.unsubscribe({
    channel: [this.SERVER_CHANNEL, this.SERVER_CONNECT_CHANNEL]
  });
};

// Button Actions
Client.prototype.onDisconnect = function() {
  this.publish(this.CLIENT_CHANNEL, 'disconnect', {});
  this.disconnectAllChannels();
};

Client.prototype.onConnect = function() {
  this.connect();
};

Client.prototype.onCount = function() {
  this.publish(this.CLIENT_CHANNEL, 'count', {});
};
// Init

Client.prototype.getPubNubArgs = function(uuid) {
  /* jshint camelcase: false */
  var config = {
    subscribe_key: CONFIG.SUBSCRIBE_KEY,
    publish_key: CONFIG.PUBLISH_KEY,
    ssl: true,
  };
  if (uuid) {
    config.uuid = uuid;
  }
  return config;
};

Client.prototype.connected = function(message) {
  if (this.connectedHook) {
    this.connectedHook(message);
  }
};

Client.showOutput = function() {
  return undefined;
};

module.exports = Client;
