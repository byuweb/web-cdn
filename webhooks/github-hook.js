/**
 * Created by ThatJoeMoore on 2/2/17
 */
"use strict";

const MAIN_CONFIG_BRANCH = 'aws-codebuild';

const ipaddr = require('ipaddr.js');
const fs = require('fs');

const packageVersion = require('./package.json').version;
const yaml = require('node-yaml');
const path = require('path');

let req = require('request-promise-native').defaults({
    headers: {
        'User-Agent': 'BYU-Web-Community-CDN-Hooks ' + packageVersion
    },
    json: true
});

const AWS = require('aws-sdk');
const Pipeline = new AWS.CodePipeline();

const CODE_PIPELINE_NAME = process.env.BUILDER_PIPELINE_NAME;
if (!CODE_PIPELINE_NAME) {
    throw 'Invalid configuration; please define BUILDER_PIPELINE_NAME';
}

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
        callback({ran: false, errorMessage: 'Event was not a push event!'});
        return Promise.resolve();
    }

    try {
        _validateGithubIp(callerIp)
            .then(() => getMainConfig())
            .then(libs => {
                console.log('Running with libs config', libs);
                let repoIsRegistered = Object.getOwnPropertyNames(libs)
                    .map(k => libs[k])
                    .some(value => value.source === 'github:' + repoName);
                if (!repoIsRegistered) {
                    let message = `Repository ${repoName} is not included in config`;
                    console.log(message);
                    callback(null, {ran: false, reason: message});
                    return;
                }

                Pipeline.startPipelineExecution({
                    name: CODE_PIPELINE_NAME
                }, (error, data) => {
                    if (error) callback(error);
                    else callback(null, {running: true, executionId: data.pipelineExecutionId});
                });
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

function _validateGithubIp(ip, cb) {
    return req('https://api.github.com/meta')
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

function getMainConfig() {
    let localPath = path.join(process.cwd(), '..', 'main-config.yml');
    if (fs.existsSync(localPath)) {
        return yaml.read(localPath);
    }
    return req({
        url: `https://raw.githubusercontent.com/byuweb/web-cdn/${MAIN_CONFIG_BRANCH}/main-config.yml`,
        json: false
    }).then(response => {
        return yaml.parse(response);
    });
}

