#!/bin/sh

echo "Pulling Node image"

docker pull node:8-alpine

echo "Making sure permissions are correct"

chmod a+x .codebuild/bin/*

echo "Adding custom bin to path"
export PATH=$PATH:$PWD/.codebuild/bin

