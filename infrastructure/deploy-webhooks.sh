#!/usr/bin/env bash -e

cd webhooks

npm install

cd ../infrastructure

aws cloudformation package --template-file webhooks.yml --s3-bucket byu-web-community-cfn-staging-dev \
    --output-template-file packaged-webhooks.yml --profile $1

aws cloudformation deploy --parameter-overrides Environment=prod --template-file packaged-webhooks.yml --stack-name WebCommunityCDN-Hosting-Prod --profile $1