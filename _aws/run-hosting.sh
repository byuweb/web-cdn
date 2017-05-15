#!/usr/bin/env bash

set -e

aws cloudformation validate-template --template-body file://./hosting.yml --profile trn-admin

aws cloudformation deploy --template-file hosting.yml --profile trn-admin --stack-name WebCommunityCDN-hosting-dev --parameter-overrides Environment=dev RolesStackName=WebCommunityCDN-roles-dev GithubOauthToken=9bb5b56248dc8d14bc9a48a9d5bafeeb98936c98


