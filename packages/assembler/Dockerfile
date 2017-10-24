FROM node:8-alpine

RUN apk --no-cache add py-pip git && \
    pip install --no-cache-dir awscli

ENV ASSEMBLER_HOME=/usr/src/assembler/

RUN mkdir -p /usr/src/assembler

WORKDIR /usr/src/assembler

ADD package.json package-lock.json ./

RUN npm install --production \
    && npm cache clean --force

ADD . ./

RUN npm link

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app
