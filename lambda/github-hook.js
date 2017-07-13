/**
 * Created by ThatJoeMoore on 2/2/17
 */
"use strict";

require('babel-polyfill');

const ipaddr = require('ipaddr.js');

// const AWS = require('aws-sdk');
//
// const lambda = new AWS.Lambda();
//
// const BuildRequest = require('./build-request');

/**
 *
 * @returns {Promise}
 */
exports.handler = function githubTrigger(incoming, context, callback) {
    console.log('Incoming event', incoming);
    let {callerIp, eventType, eventId, eventBody} = incoming;

    let repoName = eventBody.repository.full_name;
    console.log(`Received Github event '${eventType}' ${eventId} from ${callerIp} for repo ${repoName}`);

    if (eventType === 'ping') {
        console.log('Just got a ping; bailing');
        callback(null, {ran: false, reason: 'eventType === ping'});
        return Promise.resolve();
    } else if (eventType !== 'push') {
        console.log(`Skipping event of type ${eventType} because it isn't a 'push'`);
        callback(null, {ran: false, reason: 'eventType !== push'});
        return Promise.resolve();
    }

    try {
        //Note: these requires are being delayed in the name of fast startup times.
        const yaml = require('node-yaml');
        const path = require('path');

        const util = require('../lib/util');

        _validateGithubIp(callerIp)
            .then(() => yaml.read(path.join(process.cwd(), 'main-config.yml')))
            .then(libs => {
                console.log('Running with libs config', libs);
                let repoIsRegistered = util.objectAsArray(libs).some(pair => {
                    let {key, value} = pair;
                    return value.source === 'github:' + repoName;
                });
                if (!repoIsRegistered) {
                    let message = `Repository ${repoName} is not included in config`;
                    console.log(message);
                    callback(null, {ran: false, reason: message});
                    return;
                }

                // let request = {
                //     source: BuildRequest.Source.GITHUB_PUSH,
                //     sourceRepo: repoName,
                //     commitSha: eventBody.head_commit.id
                // };
                //
                // lambda.invoke({
                //     FunctionName: process.env.BUILD_FUNCTION,
                //     InvocationType: 'Event',
                //
                // })

                const runner = require('../runner');

                return runner(libs)
                    .then(() => console.log('Finished run'))
                    .then(() => callback(null, {ran: true}));
            })
            .catch(err => {
                console.error('Execution error', err, err.stack);
                callback(err)
            });
    } catch (err) {
        console.error('error', err, err.stack);
        callback(err);
    }
};

function _validateGithubIp(ip) {
    return require('../lib/github/github-config').request
        .promise('https://api.github.com/meta')
        .then(resp => {
            let hookCidrs = resp.hooks;
            console.log(`Checking if caller ip ${ip} is in github cidr range ${hookCidrs}`);
            let parsedIp = ipaddr.parse(ip);
            let inRange = hookCidrs.some(cidr => parsedIp.match(ipaddr.parseCIDR(cidr)));

            if (!inRange) {
                throw new Error(`Caller IP ${ip} is not a Github Webhook caller!`);
            }
        })
}

