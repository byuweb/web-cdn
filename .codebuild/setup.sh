#!/bin/sh

echo "Installing Nodejs and Yarn"

apt-get update -q
apt-get install -yq apt-transport-https

curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

curl -sL https://deb.nodesource.com/setup_8.x | bash -

apt-get update -q && apt-get install -yq nodejs yarn

echo "Installing lerna"

yarn global add lerna

