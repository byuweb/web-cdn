#!/usr/bin/env bash

aws cloudformation deploy --template-file roles.yml --profile trn-admin --capabilities CAPABILITY_IAM --stack-name WebCommunityCDN-roles-dev

