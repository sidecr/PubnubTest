#!/bin/bash

USER=ubuntu
GROUP=ubuntu
PUBNUB_MON_ROOT=/home/ubuntu/PubnubTest
STATSD_ROOT=/home/ubuntu/statsd
CONFIG_FILE=$PUBNUB_MON_ROOT/monitor/config/statsd/statsd-config.js
LOG_DIR=/var/log/statsd
LOG_FILE=$LOG_DIR/statsd.log

/usr/bin/sudo mkdir -p $LOG_DIR
sudo chown $USER:$GOUP $LOG_DIR

cd $STATSD_ROOT

npm install > /dev/null 2>&1
npm install statsd-librato-backend > /dev/null 2>&1

exec nodejs stats.js $CONFIG_FILE >> $LOG_FILE 2>&1
