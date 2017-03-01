/**
 * Created by jmooreoa on 1/25/17.
 */
"use strict";

const freezer = require('deep-freeze-node');
const packageVersion = require('./../package.json').version;

module.exports = freezer({
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
        BRANCH_PREFIX: 'development_'
    },
    CDN: {
        VERSION: packageVersion,
        GITHUB_ORG: 'byuweb',
        GITHUB_REPO: 'web-cdn',
        CONTENT_BRANCH: 'content',
        USER_AGENT: 'BYU-Web-Community-CDN ' + packageVersion
    },
    S3: {
        BUCKET: {
            PROD: 'cdn.byu.edu'
        }
    },
    RULES: {
        EXPERIMENTAL_DURATION: {
            days: 60
        }
    }
});


