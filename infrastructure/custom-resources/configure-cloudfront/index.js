/*
 * Copyright 2017 Brigham Young University
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
"use strict";

/*
 * This file is intended for use inside a lambda function to set IsIPV6Enabled and Edge Lambda settings on a Cloudfront Distribution.
 * TODO: Get rid of this once Cloudformation supports setting these values natively.
 */

const AWS = require('aws-sdk');
const response = require('cfn-response');

const EVENT_TYPE = 'origin-request';

exports.handler = function handler(event, context, callback) {
    let cloudfront = new AWS.CloudFront({apiVersion: '2017-03-25'});
    let distroId = event.ResourceProperties.DistributionId;
    let lambdaVersionArn = event.ResourceProperties.LambdaVersionArn;

    console.log(`--- got request to update distribution ${distroId} ---`);
    cloudfront.getDistributionConfig({
        Id: distroId
    }).promise().then(data => {
        console.log('Got distro config:', JSON.stringify(data, null, 2));
        let config = data.DistributionConfig;
        let etag = data.ETag;

        if (event.RequestType === 'Delete') {
            return doDelete(distroId, config, etag);
        } else {
            return doCreateOrUpdate(distroId, config, etag, lambdaVersionArn);
        }
    }).then(() => {
        console.log('Success!');
        response.send(event, context, response.SUCCESS, {}, distroId);
    }).catch(error => {
            console.log(`--- error updating distribution ${distroId} ---`, error);
            response.send(event, context, response.FAILED, {}, distroId);
        }
    );

    function doDelete(distroId, distroConfig, etag) {
        if (!distroConfig.LambdaFunctionAssociations) {
            console.log(`--- no changes needed for distribution ${distroId} ---`);
            return Promise.resolve();
        }
        delete distroConfig.LambdaFunctionAssociations;
        return runUpdate(distroId, distroConfig, etag);
    }

    function doCreateOrUpdate(distroId, distroConfig, etag, lambdaVersionArn) {
        let modified = false;
        if (distroConfig.IsIPV6Enabled) {
            console.log(`--- distribution ${distroId} already had IsIPV6Enabled = true---`);
        } else {
            console.log('Setting IsIPV6Enabled to true');
            distroConfig.IsIPV6Enabled = true;
            modified = true;
        }

        if (needsLambdaChanges(distroConfig, lambdaVersionArn)) {
            console.log('Updating lambda config');
            distroConfig.DefaultCacheBehavior.LambdaFunctionAssociations = {
                Quantity: 1,
                Items: [
                    {
                        LambdaFunctionARN: lambdaVersionArn,
                        EventType: EVENT_TYPE
                    }
                ]
            };
            modified = true;
        }

        if (!modified) {
            console.log(`--- no changes needed for distribution ${distroId} ---`);
            return Promise.resolve();
        }

        return runUpdate(distroId, distroConfig, etag);
    }

    function runUpdate(distroId, config, etag) {
        let update = {
            Id: distroId,
            IfMatch: etag,
            DistributionConfig: config,
        };
        console.log(`Updating ${distroId} with:`, JSON.stringify(update, null, 2));
        return cloudfront.updateDistribution(update).promise().then(data => {
            console.log(`--- updated distribution ${distroId} ---`);
        });
    }
};

function needsLambdaChanges(distroConfig, lambdaVersionArn) {
    if (!distroConfig.DefaultCacheBehavior.LambdaFunctionAssociations) {
        console.log('No Lambda associations configured');
        return true;
    }
    let lambdaAssocs = distroConfig.DefaultCacheBehavior.LambdaFunctionAssociations;
    if (lambdaAssocs.Quantity !== 1) {
        console.log('More lambda configs than expected');
        return true;
    }

    let lambdaConfig = lambdaAssocs.Items[0];

    if (lambdaConfig.LambdaFunctionARN !== lambdaVersionArn) {
        console.log('Lambda version has changed');
        return true;
    }
    if (lambdaConfig.EventType !== EVENT_TYPE) {
        console.log('Wrong lambda event type:', lambdaConfig.EventType);
        return true;
    }
    console.log('No changes needed to lambda config');
    return false;
}
