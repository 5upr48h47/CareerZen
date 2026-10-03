#!/bin/sh
cd "$(dirname "$0")/.."
PORT=5009 NODE_ENV=development nohup node src/index.js > /tmp/cc-backend.log 2>&1 &
echo "started pid $!"