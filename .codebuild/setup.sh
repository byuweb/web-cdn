#!/bin/sh

echo "Installing Nodejs and Yarn"

apt-get update
apt-get install apt-transport-https

curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

curl -sL https://deb.nodesource.com/setup_8.x | bash -

apt-get update && apt-get install -y nodejs yarn

