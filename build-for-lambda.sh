#!/usr/bin/env bash -e

mkdir -p dist/

cp -R lib dist/
cp -R lambda dist/
cp runner.js dist/

cp -R _aws dist/
cp package.json main-config.yml dist/

cd dist

npm install

cd _aws

aws cloudformation package --template-file hosting.yml --s3-bucket cdn-byu-edu-cloudformation-temp \
    --output-template-file packaged-webhooks.yml --profile $1

aws cloudformation deploy --parameter-overrides Environment=prod --template-file packaged-webhooks.yml --stack-name WebCommunityCDN-Hosting-Prod --profile $1
