#!/usr/bin/env bash -e

cd ../webhooks

npm install

cd ../infrastructure

aws cloudformation validate-template --template-body file://webhooks.yml

aws cloudformation package --template-file webhooks.yml --s3-bucket byu-web-community-cfn-staging-$1 \
    --output-template-file packaged-webhooks.yml

aws cloudformation deploy --template-file packaged-webhooks.yml --stack-name web-community-cdn-webhooks-$1

