/*
 *  @license
 *    Copyright 2017 Brigham Young University
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/**
 * Created by ThatJoeMoore on 2/2/17
 */
"use strict";

const ipaddr = require('ipaddr.js');

const HttpError = require('../http-error');
const startPipeline = require('../start-pipeline');

const req = require('request-promise-native').defaults(require('../req-defaults'));

module.exports = function (options) {
    return function (req, resp, next) {
        let body = req.body;

        let eventBody = body.payload ? JSON.parse(body.payload) : body;

        let callerIp = req.ip;

        let eventType = req.headers['x-github-event'];
        let eventId = req.headers['x-github-delivery'];

        let repoName = eventBody.repository.full_name;

        console.log(`Received Github event '${eventType}' ${eventId} from ${callerIp} for repo ${repoName}`);

        handleEvent(eventBody, eventType, callerIp, req.cdnConfig, options)
            .then(result => resp.status(200).json(result))
            .catch(next);
    }
};

function handleEvent(event, eventType, callerIp, mainConfig, options) {
    let repoName = event.repository.full_name;

    if (eventType === 'ping') {
        console.log('Just got a ping; bailing');
        return Promise.resolve({ran: false, reason: 'eventType === ping'});
    } else if (eventType !== 'push') {
        console.log(`Skipping event of type ${eventType} because it isn't a 'push'`);
        return Promise.reject(new HttpError(400, 'Event was not a push event!'));
    }

    return validateGithubIp(callerIp, options)
        .then(() => {
            console.log('running with CDN config', mainConfig);

            let repoIsRegistered = Object.getOwnPropertyNames(mainConfig)
                .map(k => mainConfig[k])
                .some(value => value.source === 'github:' + repoName);

            if (!repoIsRegistered) {
                throw new HttpError(400, `Repository ${repoName} is not in CDN config`);
            }

            return startPipeline(options.assemblerPipelineName)
                .then(executionId => {
                    return {running: true, executionId: executionId};
                });
        });

}

function validateGithubIp(ip, options) {
    if (options.skipCallerValidation) {
        return Promise.resolve();
    }
    return req('https://api.github.com/meta')
        .then(resp => {
            let hookCidrs = resp.hooks;
            console.log(`Checking if caller ip ${ip} is in github cidr range ${hookCidrs}`);
            let parsedIp = ipaddr.parse(ip);
            let inRange = hookCidrs.some(cidr => parsedIp.match(ipaddr.parseCIDR(cidr)));

            if (!inRange) {
                throw new HttpError(403, `Caller IP ${ip} is not a Github Webhook caller!`);
            }
        });
}
