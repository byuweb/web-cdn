FROM node:8-alpine

## Install python (for AWS CLI) and git
RUN apk --no-cache add python3 git

## Install AWS CLI
RUN apk --no-cache add curl && \
    curl "https://s3.amazonaws.com/aws-cli/awscli-bundle.zip" -o "/tmp/awscli-bundle.zip" && \
    unzip /tmp/awscli-bundle.zip -d /tmp && \
    python3 /tmp/awscli-bundle/install -i /usr/local/aws -b /usr/local/bin/aws && \
    apk --no-cache del curl && \
    rm -rf /tmp/awscli-bundle*

ENV ASSEMBLER_HOME=/usr/src/assembler/

RUN mkdir -p /usr/src/assembler

WORKDIR /usr/src/assembler

ADD package.json yarn.lock ./

RUN yarn install --production \
    && yarn cache clean

ADD . ./

RUN chmod a+x bin/cdn-assembler.js && yarn link

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app
