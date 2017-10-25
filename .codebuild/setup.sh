#!/bin/sh

#echo "Building Node image"
#
#docker build -t local-node -f .codebuild/node.dockerfile .codebuild/
#
#echo "Making sure permissions are correct"
#
#chmod a+x .codebuild/bin/*
#
#echo "Adding custom bin to path"
#export PATH=$PATH:$PWD/.codebuild/bin

echo "Installing Nodejs and Yarn"

curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

curl -sL https://deb.nodesource.com/setup_8.x | bash -

apt-get update && apt-get install -y nodejs yarn

