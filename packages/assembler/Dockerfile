FROM node:8-alpine

RUN apk --no-cache add py-pip git && \
    pip install --no-cache-dir awscli

ENV ASSEMBLER_HOME=/usr/src/assembler/

RUN mkdir -p /usr/src/assembler

WORKDIR /usr/src/assembler

ADD package.json yarn.lock ./

RUN yarn install --production \
    && yarn cache clean

ADD . ./

RUN yarn link

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app
