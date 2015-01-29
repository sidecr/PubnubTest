#!/bin/bash

USER=ubuntu
GROUP=ubuntu
PROJECT_ROOT=/home/ubuntu/PubnubTest/monitor
LOG_DIR=/var/log/pubnub
LOG_FILE=$LOG_DIR/publisher.log

/usr/bin/sudo mkdir -p $LOG_DIR
sudo chown $USER:$GOUP $LOG_DIR

cd $PROJECT_ROOT

npm install > /dev/null 2>&1

source $PROJECT_ROOT/env/pubnub_keys.sh

exec nodejs publisher.js -c $PROJECT_ROOT/config/east-to-west.yml >> $LOG_FILE 2>&1
