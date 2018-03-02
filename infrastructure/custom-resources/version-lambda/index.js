/*
 *  @license
 *    Copyright 2018 Brigham Young University
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
"use strict";

const AWS = require('aws-sdk');
const response = require('cfn-responder');

exports.handler = function handler(event, context, callback) {

    console.log('Incoming event:', event);

    let lambda = new AWS.Lambda();

    let physicalId = event.PhysicalResourceId;

    console.log('physicalId:', physicalId);

    let functionName = event.ResourceProperties.LambdaFunctionName;
    let nonce = event.ResourceProperties.Nonce;

    let promise;

    switch (event.RequestType) {
        case 'Create':
        case 'Update':
            promise = doCreateOrUpdate();
            break;
        case 'Delete':
            succeed(physicalId, 'Cannot delete lambda versions');
            return;
        default:
            fail(physicalId, "Invalid request type: " + event.RequestType);
            return;
    }

    promise.then(result => {
        succeed(result.id, `Successfully created version ${result.attributes.Version}`, result.attributes);
    }).catch(err => {
        fail(physicalId, err);
    });

    function succeed(id, message, data) {
        console.log('Responding with Success:', message, id, JSON.stringify(data, null, 2));
        event.Reason = message;
        response.send(event, context, response.SUCCESS, data || {}, id);
    }

    function fail(id, messageOrError) {
        console.log('Failing build:', messageOrError);
        event.Reason = messageOrError.message || messageOrError;
        response.send(event, context, response.FAILED, {}, id);
    }

    function doCreateOrUpdate() {
        console.log('creating or updating');

        return lambda.getFunction({FunctionName: functionName}).promise()
            .then(func => {
                console.log('Got function config', JSON.stringify(func, null, 2));

                let codeSha = func.Configuration.CodeSha256;
                let arn = cleanFunctionArn(func.Configuration.FunctionArn);

                console.log('Publishing new version');
                return lambda.publishVersion({
                    FunctionName: func.Configuration.FunctionName,
                    CodeSha256: codeSha
                }).promise().then(result => {
                    let version = Number(result.Version);
                    console.log('Published new version', version);
                    return {
                        id: result.FunctionArn,
                        attributes: {
                            Version: version,
                            VersionArn: arn + ':' + version
                        }
                    }
                });
            });
    }

    function cleanFunctionArn(arn) {
        return arn.replace(/:(\d+|\$LATEST)$/, ''); //strip off version number
    }
};

