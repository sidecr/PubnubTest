var Getopt = require('node-getopt');
var Pubnub = require('pubnub');
var StatsD = require('node-statsd');
var YAML   = require('yamljs');
var logger = require('./lib/logger');

var pubnub             = null; // Global pubnub ref
var heartbeats_per_sec = 0;    // Actual count of heartbeats per sec
var running_latencies  = 0;    // Running total of latencies in a second

function main() {
  var args = process_commandline_args();
  config   = load_config_file(args.config);

  init();

  var channel       = construct_channel_name(args);
  var metric_prefix = construct_statsd_metric_prefix(config);

  stats_timeout_id = setTimeout(send_subscribe_stats, 1000, metric_prefix);

  pubnub.subscribe({
    channel:  channel,
    callback: on_message
  });
}

function construct_channel_name(args) {
  return 'pubnub-mon.src.' + config.src   + '.dst.' + config.dst + '.heartbeats';
}

function construct_statsd_metric_prefix(config) {
  return 'pubnub-mon.src.' + config.src   + '.dst.' + config.dst;
}

function send_subscribe_stats(prefix) {
  var avg_latency = 0.0;

  if (heartbeats_per_sec === 0) { avg_latency = 0.0;                                      }
  else                          { avg_latency = (running_latencies / heartbeats_per_sec); }

  statsd_client.gauge(prefix + '.received_heartbeats_per_sec', heartbeats_per_sec);
  statsd_client.gauge(prefix + '.avg_latency',                 avg_latency);

  // Reset the metrics
  heartbeats_per_sec = 0;
  running_latencies  = 0;

  // Schedule the next stats transmission 1 second from now
  stats_timeout_id = setTimeout(send_subscribe_stats, 1000, prefix);
}

function on_message(message) {
  var now = Date.now();

  running_latencies  += (now - message.heartbeat_timestamp);
  heartbeats_per_sec += 1;
}

function init() {
  // Install the interrupt handlers
  process.on('SIGINT',  gracefulExit);
  process.on('SIGTERM', gracefulExit);

  logger.info('-------------------');
  logger.info('Initializing PubNub Subscriber');

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
