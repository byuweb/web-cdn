#!/usr/bin/env bash -e

cd ../alias-resolver-lambda

npm install

cd ../infrastructure

aws cloudformation validate-template --template-body file://alias-resolver-lambda.yml --region us-east-1

aws cloudformation package --template-file alias-resolver-lambda.yml --s3-bucket byu-web-community-edge-staging-$1 \
    --output-template-file packaged-alias-resolver-lambda.yml --region us-east-1

aws cloudformation deploy --template-file packaged-alias-resolver-lambda.yml --stack-name web-community-cdn-$1-alias-resolver --region us-east-1

