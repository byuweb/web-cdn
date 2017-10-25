#!/bin/sh

echo "Building Node image"

docker build -t local-node -f .codebuild/node.dockerfile .codebuild/

echo "Making sure permissions are correct"

chmod a+x .codebuild/bin/*

echo "Adding custom bin to path"
export PATH=$PATH:$PWD/.codebuild/bin

