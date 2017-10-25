#!/bin/sh

echo "Pulling Node image"

docker pull node:8-alpine

echo "Adding custom bin to path"
export PATH=$PATH:$CWD/.codebuild/bin

