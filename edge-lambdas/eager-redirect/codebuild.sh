#!/bin/sh

echo "=========== Building alias-resolver-lambda ==========="

set -e

yarn test
rm -rf node_modules

yarn install --production

if [ -z "$ROOT_DNS" ]; then
  echo "No ROOT_DNS value set; not generating config file";
else
  echo "Writing config file with rootDns = $ROOT_DNS";
  echo "{\"rootDns\": \"$ROOT_DNS\"}" > ./config.json;
  touch ./config.json
fi

