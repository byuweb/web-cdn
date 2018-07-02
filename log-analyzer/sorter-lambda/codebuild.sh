#!/bin/sh

echo "=========== Building Sorter Lambda ==========="

set -e

yarn build

rm -rf node_modules

yarn --production
