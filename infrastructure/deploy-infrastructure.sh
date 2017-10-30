#!/bin/sh

env=$1

if [ ! -n "$env" ]; then
  echo "Usage is deploy-infrastructure.sh (environment)"
  exit 1
fi
dns_stack=web-community-cdn-dns-$env

if [ "$env" = "prod" ]; then
  dns_stack=WebCommunityCDN-dns
fi

packaged=/tmp/web-community-packaged-infrastructure-$(date +"%s").yml

staging_bucket_or=byu-web-community-cdn-infra-staging-$env-us-west-2
staging_bucket_va=byu-web-community-cdn-infra-staging-$env-us-east-1

if ! aws s3api head-bucket --bucket $staging_bucket_or; then
  echo "Bucket $staging_bucket_or does not exist; creating"
  aws s3api create-bucket \
    --bucket $staging_bucket_or \
    --acl private \
    --region us-west-2 \
    --create-bucket-configuration LocationConstraint=us-west-2
fi

if ! aws s3api head-bucket --bucket $staging_bucket_va; then
  echo "Bucket $staging_bucket_va does not exist; creating"
  aws s3api create-bucket \
    --bucket $staging_bucket_va \
    --acl private \
    --region us-east-1
fi

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

set -e

aws cloudformation validate-template \
    --template-body file://$here/infrastructure.yml

echo Packaging to s3://$staging_bucket_or

aws cloudformation package \
    --template-file $here/infrastructure.yml \
    --s3-bucket $staging_bucket_or \
    --output-template-file $packaged

aws cloudformation deploy \
    --template-file $packaged \
    --stack-name web-community-cdn-$env \
    --parameter-overrides \
      Environment=$env \
      DnsStackName=$dns_stack \
      ApplyDns=true

