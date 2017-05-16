/**
 * Created by ThatJoeMoore on 1/25/17.
 */
"use strict";

const aws = require('aws-sdk');

const ssm = new aws.SSM({region: 'us-west-2'});

const constants = require('../constants');

const PARAM_PREFIX = `web-community-cdn.${constants.ENVIRONMENT}.`;

const GITHUB_TOKEN_PARAM = PARAM_PREFIX + 'github.token';
const GITHUB_USER_PARAM = PARAM_PREFIX + 'github.user';

module.exports = function getAuthenticationHeaders() {
    if (process.env.GITHUB_USER && process.env.GITHUB_TOKEN) {
        return Promise.resolve(computeHeader(process.env.GITHUB_USER, process.env.GITHUB_TOKEN));
    }

    return new Promise((resolve, reject) => {
        ssm.getParameters({
            Names: [
                GITHUB_TOKEN_PARAM,
                GITHUB_USER_PARAM
            ],
            WithDecryption: true
        }, (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            let user = data.Parameters.find(val => val.Name === GITHUB_USER_PARAM);
            let token = data.Parameters.find(val => val.Name === GITHUB_TOKEN_PARAM);

            resolve(computeHeader(user.Value, token.Value));
        });
    });
};


function computeHeader(user, token) {
    return 'Basic ' + new Buffer(user + ':' + token).toString('base64');
}
