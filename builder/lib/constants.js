/**
 * Created by jmooreoa on 1/25/17.
 */
"use strict";

const freezer = require('deep-freeze-node');
const packageVersion = require('./../package.json').version;

const env = process.env.BUILD_ENV;

module.exports = freezer({
    ENVIRONMENT: env,
    ENVIRONMENT_NAMES: {
        PROD: 'prod',
        STAGE: 'stg',
        DEV: 'dev'
    },
    SOURCE_KEYS: {
        GITHUB: 'github',
        NPM: 'npm'
    },
    REF_TYPES: {
        BRANCH: 'branch',
        TAG: 'tag'
    },
    VERSION_ALIASES: {
        MASTER: 'unstable',
        LATEST: 'latest',
        EXPERIMENTAL_PREFIX: 'experimental'
    },
    CDN: {
        VERSION: packageVersion,
        GITHUB_ORG: 'byuweb',
        GITHUB_REPO: 'web-cdn',
        CONTENT_BRANCH: 'content',
        USER_AGENT: 'BYU-Web-Community-CDN-Builder ' + packageVersion
    },
    S3: {
        BUCKET: process.env.DESTINATION_S3_BUCKET
    },
    RULES: {
        EXPERIMENTAL_DURATION: {
            days: 60
        }
    }
});


