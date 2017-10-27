#!/bin/sh


env=$1

dns_stack=web-community-cdn-dns-$env

if [ "$env" = "prod" ]; then
  dns_stack=WebCommunityCDN-dns
fi

packaged=/tmp/web-community-packaged-infrastructure-$(date +"%s").yml

here="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

set -e

aws cloudformation validate-template \
    --template-body file://$here/infrastructure.yml

aws cloudformation package \
    --template-file $here/infrastructure.yml \
    --s3-bucket byu-web-community-infra-staging-$env \
    --output-template-file $packaged

aws cloudformation deploy \
    --template-file $packaged \
    --stack-name web-community-cdn-$env \
    --parameter-overrides \
      Environment=$env \
      DnsStackName=$dns_stack \
      ApplyDns=true

