var curry     = require('curry');
var Getopt    = require('node-getopt');
var StatsD    = require('node-statsd');
var Pubnub    = require('pubnub');
var util      = require('util');
var YAML      = require('yamljs');
var heartbeat = require('./lib/heartbeat');
var logger    = require('./lib/logger');

var pubnub                 = null; // Global pubnub ref
var heartbeats_per_sec     = 0;    // Actual count of heartbeats per sec
var publish_errors_per_sec = 0;    // # of publish errors per sec
var publish_timeout_id     = null; // Ref to setTimeout interval
var stats_timeout_id       = null; // Ref to setTimeout interval
var config                 = null; // Config file hash
var statsd_client          = null; // Global Statsd ref

function main() {
  var args = process_commandline_args();
  config   = load_config_file(args.config);

  init();

  var channel       = construct_channel_name(config);
  var metric_prefix = construct_statsd_metric_prefix(config);

  logger.info('Scheduling Heartbeat Transmissions Every ' + config.transmit_delay + ' milliseconds.');

  stats_timeout_id   = setTimeout(send_publish_stats, 1000, metric_prefix);
  publish_timeout_id = setTimeout(transmit_heartbeat, config.transmit_delay, channel);
}

function construct_channel_name(config) {
  return 'pubnub-mon.src.' + config.src   + '.dst.' + config.dst + '.heartbeats';
}

function construct_statsd_metric_prefix(config) {
  return 'pubnub-mon.src.' + config.src   + '.dst.' + config.dst;
}

function send_publish_stats(prefix) {
  statsd_client.gauge(prefix + '.published_heartbeats_per_sec', heartbeats_per_sec);
  statsd_client.gauge(prefix + '.publish_errors_per_sec',       publish_errors_per_sec);

  // Reset the metrics
  heartbeats_per_sec     = 0;
  publish_errors_per_sec = 0;

  // Schedule the next stats transmission 1 second from now
  stats_timeout_id = setTimeout(send_publish_stats, 1000, prefix);
}

function transmit_heartbeat(channel) {
  var payload = heartbeat.generate();

  pubnub.publish({
    channel:  channel,
    message:  payload,
    callback: curry(success_callback)(channel),
    error:    curry(error_callback)(channel)
  });
}

/*
 * Unfortunately a success_callback does not accurately indicate
 * that a PubNub message was successfully transmited.
 *
 * Pubnub invokes this callback even in the event of exception such
 * as 'Invalid Key' or 'Channel quota exceeded'.
 *
 * So it's important to process the result array to accurately determine
 * if the message transmission went through ok.
 */
function success_callback(channel, result) {
  if ( pubnub_send_succeeded(result) ) {
    heartbeats_per_sec += 1;
  }

  if ( pubnub_send_failed(result) ) {
    publish_errors_per_sec += 1;
    logger.error('Publish Error: ' + JSON.stringify(result));
  }

  // Schedule the next transmission
  publish_timeout_id = setTimeout(transmit_heartbeat, config.transmit_delay, channel);
};

function error_callback(channel, error) {
  // Turn all args into a true arguments array
  var args = Array.prototype.slice.call(arguments);

  publish_errors_per_sec += 1;
  logger.error('Error Callback: ' + JSON.stringify(args));

  // Schedule the next transmission
  publish_timeout_id = setTimeout(transmit_heartbeat, config.transmit_delay, channel);
};

function pubnub_send_succeeded(result) {
  if ( util.isArray(result)  &&
       result[0] === 1       && 
       result[1] === 'Sent' ) {
      return true;
  }

  return false;
};

function pubnub_send_failed(result) {
  return !pubnub_send_succeeded(result);
}


function init() {
  // Install the interrupt handlers
  process.on('SIGINT',  gracefulExit);
  process.on('SIGTERM', gracefulExit);

  logger.info('-------------------');
  logger.info('Initializing PubNub Publisher');

  statsd_client = new StatsD({
    host: config.statsd.host,
    port: config.statsd.port
  });

  pubnub = pubnub_init();
}

function pubnub_init() {
  return Pubnub({
    publish_key:   process.env.PUBNUB_PUBLISHER_KEY,
    subscribe_key: process.env.PUBNUB_SUBSCRIBER_KEY,
    ssl:           true
  });
}

function load_config_file(config_file) {
  return YAML.load(config_file);
}

function gracefulExit() {
  logger.info('Shutting down');
  logger.info('-------------------');
  process.exit(1);
}

function process_commandline_args() {
  var getopt = new Getopt([ ['c', 'config=ARG', 'path to YAML config file'] ]).bindHelp();
  var opts   = getopt.parseSystem().options;

  if (process.argv.length < 3 || opts.config === undefined) { 
    getopt.showHelp(); 
    process.exit(1); 
  }

  return opts;
}

main();
