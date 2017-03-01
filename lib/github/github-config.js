/**
 * Created by ThatJoeMoore on 1/25/17.
 */
"use strict";

const httpClient = require('./../http/client');

if (!process.env.GITHUB_USER || !process.env.GITHUB_TOKEN) {
    throw new Error('Need to provide a GITHUB_USER and GITHUB_TOKEN value!');
}
let authz = 'Basic ' + new Buffer(process.env.GITHUB_USER + ':' + process.env.GITHUB_TOKEN).toString('base64');

module.exports = {
    request: httpClient({authorization: authz})
};

