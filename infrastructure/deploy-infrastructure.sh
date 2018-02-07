#!/bin/sh

env=$1

if [ ! -n "$env" ]; then
  echo "Usage is deploy-infrastructure.sh (environment)"
  exit 1
fi
dns_stack=web-community-cdn-dns-$env
roles_stack=web-community-cdn-roles

if [ "$env" = "prod" ]; then
  dns_stack=WebCommunityCDN-DNS-Prod
fi

getStackOutput() {
  local stack=$1
  local key=$2

  local temp=`aws cloudformation describe-stacks --stack-name "$stack" --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue | [0]"`
  echo "$temp" | sed -e 's/^"//' -e 's/"$//'
}

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
working=$(pwd)

now=$(date +"%s")

echo "computing alias resolver shasum"
alias_resolver_hash=`find packages/alias-resolver-lambda -type f -print0 | sort -z | xargs -0 shasum | shasum | cut -d " " -f 1`
echo "Alias resolver hash is $alias_resolver_hash"

packaged=/tmp/web-community-packaged-infrastructure-$now.yml

staging_bucket_or=byu-web-community-cdn-infra-staging-$env-us-west-2

if ! aws s3api head-bucket --bucket $staging_bucket_or; then
  echo "Bucket $staging_bucket_or does not exist; creating"
  aws s3api create-bucket \
    --bucket $staging_bucket_or \
    --acl private \
    --region us-west-2 \
    --create-bucket-configuration LocationConstraint=us-west-2
fi

cd $here/custom-resources/copy-lambda && yarn || exit 1
cd $working

aws cloudformation validate-template \
    --template-body file://$here/infrastructure.yml

echo Packaging to s3://$staging_bucket_or

aws cloudformation package \
    --template-file $here/infrastructure.yml \
    --s3-bucket $staging_bucket_or \
    --output-template-file $packaged

stackname=web-community-cdn-$env

if aws cloudformation deploy \
    --template-file $packaged \
    --stack-name $stackname \
    --tags \
      app="Web Community CDN" \
      team=OIT_APP_DEV__STUDENT_LIFE_APPS \
      env=$env \
      data-sensitivity=public \
      if-questions-contact="Joseph Moore James Speirs Katria Lesser" \
    --parameter-overrides \
      Environment=$env \
      DnsStackName=$dns_stack \
      AliasResolverFunctionHash=$alias_resolver_hash \
      RolesStackName=$roles_stack \
      ApplyDns=true 2>/tmp/cfn-error.txt; then
  echo "Deployment Finished"
  rm $packaged
elif grep "The submitted information didn't contain changes" /tmp/cfn-error.txt; then
  echo "No changes"
else
  echo "Error running cloudformation:"
  cat /tmp/cfn-error.txt
  exit 2
fi

buildbranch=`getStackOutput ${stackname} BuildBranch`
buildproj=`getStackOutput ${stackname} BuildProject`

echo "Running Assembler Build Project $buildproj@$buildbranch"

aws codebuild start-build --project-name ${buildproj} --source-version ${buildbranch}