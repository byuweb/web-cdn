#!/bin/sh

echo "Installing Nodejs, Yarn, jq, and yq"

apt-get update -q
apt-get install -yq apt-transport-https

curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

curl -sL https://deb.nodesource.com/setup_8.x | bash -

apt-get update -q && apt-get install -yq nodejs yarn #jq

#pip install yq

echo "Installing lerna"

yarn global add lerna

yarn global add mustache

