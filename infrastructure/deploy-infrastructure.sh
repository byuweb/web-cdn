#!/usr/bin/env bash -e

env=$1

dns_stack=web-community-cdn-dns-$env

if [ "$env" = "prod" ]; then
  dns_stack=WebCommunityCDN-dns
fi

#
#cd ../webhooks
#
#npm install
#
#cd ../infrastructure

aws cloudformation validate-template --template-body file://infrastructure.yml

aws cloudformation package --template-file infrastructure.yml --s3-bucket byu-web-community-infra-staging-$env \
    --output-template-file packaged-infrastructure.yml

aws cloudformation deploy --template-file packaged-infrastructure.yml \
    --stack-name web-community-cdn-$env \
    --parameter-overrides \
      Environment=$env \
      DnsStackName=$dns_stack \
      ApplyDns=true

