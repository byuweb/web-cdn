"use strict";

const req = require('request');
const reqp = require('request-promise-native');

const constants = require('./../constants');

const defaultHeaders = {
    'User-Agent': constants.CDN.USER_AGENT
};


module.exports = function createHttpClient(opts) {
    let headers = Object.assign({}, defaultHeaders);
    let {authorization} = (opts || {});

    if (authorization) {
        headers['Authorization'] = authorization;
    }

    return {
        async: req.defaults({
            headers: headers,
            json: true
        }),
        promise: reqp.defaults({
            headers: headers,
            json: true
        })
    };
};