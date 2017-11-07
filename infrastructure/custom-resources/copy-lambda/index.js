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
"use strict";

const AWS = require('aws-sdk');
const response = require('cfn-response');
const fetch = require('node-fetch');

exports.handler = function handler(event, context, callback) {
    console.log('Incoming event:', event);

    let lambdaWest = new AWS.Lambda();
    let lambdaEast = new AWS.Lambda({region: 'us-east-1'});

    let physicalId = event.PhysicalResourceId;

    let functionName = event.ResourceProperties.LambdaFunctionName;
    let nonce = event.ResourceProperties.Nonce;

    let promise;

    switch (event.RequestType) {
        case 'Create':
        case 'Update':
            promise = doCreateOrUpdate();
            break;
        case 'Delete':
            promise = doDelete();
            break;
        default:
            throw new Error("Invalid request type");
    }

    promise.then(result => {
        console.log('Responding with Success:', JSON.stringify(result, null, 2));
        response.send(event, context, response.SUCCESS, result.attributes, result.id);
    }).catch(err => {
        console.error('got error', err);
        response.send(event, context, response.FAILED, {}, physicalId);
    });

    function doDelete() {
        return lambdaEast.deleteFunction({FunctionName: physicalId}).promise()
            .catch(err => {
                if (err.name === 'ResourceNotFoundException') {
                    return null;
                }
                throw err;
            }).then(() => {
                return {
                    id: physicalId,
                    attributes: {}
                }
            });
    }

    function doCreateOrUpdate() {
        let getTarget = lambdaEast.getFunction({FunctionName: functionName}).promise()
            .catch(err => null);

        let getSource = lambdaWest.getFunction({FunctionName: functionName}).promise();

        return Promise.all([getTarget, getSource]).then(([target, source]) => {
            let newConfig = copyConfig(source.Configuration);

            if (target) {
                return updateTarget(source, target, newConfig);
            } else {
                return createTarget(source, newConfig);
            }
        }).then(updateResult => {
            let newConfig = updateResult.config;

            let versionPromise;

            if (updateResult.publish) {
                versionPromise = lambdaEast.publishVersion({
                    FunctionName: newConfig.FunctionName,
                    CodeSha256: newConfig.CodeSha256
                }).promise().then(result => {
                    return Number(result.Version)
                });
            } else {
                versionPromise = getLatestEastVersion(functionName);
            }

            return versionPromise.then(version => {
                return {
                    id: newConfig.FunctionArn,
                    attributes: {
                        FunctionName: newConfig.FunctionName,
                        FunctionArn: newConfig.FunctionArn,
                        Version: version,
                        VersionArn: newConfig.FunctionArn + ':' + version
                    }
                };
            })
        });
    }

    function copyConfig(srcCfg) {
        return {
            Description: srcCfg.Description,
            FunctionName: srcCfg.FunctionName,
            Handler: srcCfg.Handler,
            MemorySize: srcCfg.MemorySize,
            Role: srcCfg.Role,
            Runtime: srcCfg.Runtime,
            Timeout: srcCfg.Timeout
        };
    }

    function configIsDifferent(source, target) {
        return source.Description !== target.Description ||
            source.Handler !== target.Handler ||
            source.MemorySize !== target.MemorySize ||
            source.Role !== target.Role ||
            source.Runtime !== target.Runtime ||
            source.Timeout !== target.Timeout
    }

    function createTarget(source, newConfig) {
        console.log(`creating ${newConfig.FunctionName} in us-east-1`);

        return fetch(source.Code.Location).then(resp => resp.buffer())
            .then(zip => {
                newConfig.Code = {ZipFile: zip};
                newConfig.Publish = true;
                return lambdaEast.createFunction(newConfig).promise()
                    .then(cfg => {
                        return {
                            publish: false, //We're publishing as part of the create
                            config: cfg,
                        }
                    })
            });
    }

    function updateTarget(source, target, newConfig) {
        console.log('updateTarget', source);

        return lambdaEast.updateFunctionConfiguration(newConfig).promise()
            .then(result => {
                if (source.Configuration.CodeSha256 === target.Configuration.CodeSha256) {
                    return {
                        publish: configIsDifferent(source, target),
                        config: result
                    };
                }

                return fetch(source.Code.Location).then(resp => resp.buffer())
                    .then(zip => {
                        return lambdaEast.updateFunctionCode({
                            FunctionName: newConfig.FunctionName,
                            Publish: true,
                            ZipFile: zip
                        }).promise();
                    }).then(cfg => {
                        return {
                            publish: false, //We're publishing as part of the code update
                            config: cfg,
                        }
                    });
            });
    }

    function getLatestEastVersion(functionName) {
        return makeCall(null, []).then(versions => {
            let versionNumbers = versions.map(it => Number(it.Version))
                .filter(it => !isNaN(it));//Filter out non-numeric versions, like '$LATEST'

            return String(versionNumbers.reduce((acc, cur) => Math.max(acc, cur)));
        });

        function makeCall(marker, previousResult) {
            return lambdaEast.listVersionsByFunction({
                FunctionName: functionName,
                Marker: marker,
                MaxItems: '100'
            }).promise().then(data => {
                let result = previousResult.concat(data.Versions);
                if (data.NextMarker) {
                    return makeCall(data.NextMarker, result)
                } else {
                    return result;
                }
            });
        }
    }
};
