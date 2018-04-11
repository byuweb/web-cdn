#!/bin/sh

if [ "$#" -lt 7 ]; then
  echo "usage: deploy-environment.sh cdn-name env root-dns account-stack certificate-arn config-github-repo config-github-branch [extra-tags]"
  exit 1
fi

cdnName=$1
env=$2
rootDns=$3
accountStack=$4
certificateArn=$5
configGithubRepo=$6
configGithubBranch=$7

extraTags=$8

echo "Deploying ${cdnName}@${env} to ${rootDns}"

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

templateDataFile=/tmp/template-data-$now.json

echo '{ "aliasResolver": { "sha": "'${alias_resolver_hash}'" } }' > ${templateDataFile}

renderedCfnFile=${here}/environment-template-rendered.yml

mustache ${templateDataFile} ${here}/environment-template.mustache.yml > ${renderedCfnFile}

stagingBucket=`getStackOutput ${accountStack} AccountBucketName`
stagingBucketPrefix=`getStackOutput ${accountStack} AccountBucketCfnPrefix`

packaged=/tmp/cdn-packaged-infrastructure-$now.yml

aws cloudformation validate-template \
    --template-body file://${renderedCfnFile} || exit 1

echo Packaging to s3://${stagingBucket}/${stagingBucketPrefix}

aws cloudformation package \
    --template-file ${renderedCfnFile} \
    --s3-bucket ${stagingBucket} \
    --s3-prefix ${stagingBucketPrefix} \
    --output-template-file ${packaged} || exit 1

stackname=${cdnName}-${env}

echo "extra tags: ${extraTags}"

tags="app=${cdnName} env=${env} ${extraTags}"
parameters="CDNName=${cdnName}
 Environment=${env}
 RootDNS=${rootDns}
 AccountStackName=${accountStack}
 CertificateArn=${certificateArn}
 ConfigurationGithubRepo=${configGithubRepo}
 ConfigurationGithubBranch=${configGithubBranch}
 AliasResolverFunctionHash=${alias_resolver_hash}"

echo "Deploying ${stackname} with parameters ${parameters} and tags ${tags}"

if aws cloudformation deploy \
    --template-file ${packaged} \
    --stack-name ${stackname} \
    --tags ${tags} \
    --parameter-overrides ${parameters} \
      ApplyDns=true 2>/tmp/cfn-error.txt; then
  echo "Deployment Finished"
  rm ${packaged}
elif grep "The submitted information didn't contain changes" /tmp/cfn-error.txt; then
  echo "No changes"
else
  echo "Error running cloudformation:"
  cat /tmp/cfn-error.txt
  exit 2
fi

buildproj=`getStackOutput ${stackname} BuildProject`

echo "Running Assembler Build Project $buildproj@$configGithubBranch"

aws codebuild start-build --project-name ${buildproj} --source-version ${configGithubBranch}

echo "Pre-fetching cdn aliases list to warm lambdas"

curl "https://${rootDns}/manifest.json"
curl "https://${rootDns}/.cdn-meta/aliases.json"
