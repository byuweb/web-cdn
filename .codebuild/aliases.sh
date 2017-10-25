#!/bin/sh

echo "Pulling Node image"

docker pull node:8-alpine

echo "Aliasing yarn to Docker"

alias yarn="docker run --rm -i -v $PWD:/usr/src/app -w /usr/src/app node:8-alpine yarn";

echo "Aliasing npx to Docker"

alias yarn="docker run --rm -i -v $PWD:/usr/src/app -w /usr/src/app node:8-alpine npx";
