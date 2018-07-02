#!/bin/sh

echo "=========== Building Sorter Lambda ==========="

set -e

yarn

yarn build

rm -rf node_modules

yarn --production

zip -r9 packaged.zip lib node_modules
