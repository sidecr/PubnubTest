"use strict";
var Heartbeat = function() {};

Heartbeat.prototype.generate = function() {
  var timestamp = Date.now();

  var payload = {
    heartbeat_timestamp: timestamp
  };

  return payload;
}

module.exports = new Heartbeat();
