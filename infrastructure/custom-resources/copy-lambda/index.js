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
        console.log('Deleting');
        return lambdaEast.deleteFunction({FunctionName: physicalId}).promise()
            .catch(err => {
                console.log('Error while deleting lambda, ignoring', err);
                return {
                    id: physicalId,
                    attributes: {},
                    message: `Error while deleting lambda: ${err.name}; you may need to manually delete the copied lambda.`
                };
            }).then(() => {
                return {
                    id: physicalId,
                    attributes: {}
                }
            });
    }

    function doCreateOrUpdate() {
        console.log('creating or updating');
        let getTarget = lambdaEast.getFunction({FunctionName: functionName}).promise()
            .catch(err => null);

        let getSource = lambdaWest.getFunction({FunctionName: functionName}).promise();

        return Promise.all([getTarget, getSource]).then(([target, source]) => {
            console.log('Got source config:', JSON.stringify(source, null, 2));
            console.log('Got target config:', JSON.stringify(target, null, 2));
            let newConfig = copyConfig(source.Configuration);

            console.log('Config should match', JSON.stringify(newConfig, null, 2));

            let promise;

            if (target) {
                promise = updateTarget(source, target, newConfig);
            } else {
                promise = createTarget(source, newConfig);
            }
            return promise.then(result => {
                return copyTags(source.Configuration.FunctionArn, result.id).then(() => result);
            });
        }).then(updateResult => {
            console.log('Finished update or create with result', JSON.stringify(updateResult, null, 2));
            let newConfig = updateResult.config;

            console.log('Publishing new version');
            let versionPromise = lambdaEast.publishVersion({
                FunctionName: newConfig.FunctionName,
                CodeSha256: newConfig.CodeSha256
            }).promise().then(result => {
                console.log('Published new version', result.Version);
                return Number(result.Version)
            });

            return versionPromise.then(version => {
                let arn = cleanFunctionArn(updateResult.id);
                return {
                    id: arn,
                    attributes: {
                        FunctionName: newConfig.FunctionName,
                        FunctionArn: arn,
                        Version: version,
                        VersionArn: arn + ':' + version
                    }
                };
            })
        });
    }

    function cleanFunctionArn(arn) {
        return arn.replace(/:(\d+|\$LATEST)$/, ''); //strip off version number
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

    function createTarget(source, newConfig) {
        console.log(`creating ${newConfig.FunctionName} in us-east-1`);

        return fetch(source.Code.Location).then(resp => resp.buffer())
            .then(zip => {
                newConfig.Code = {ZipFile: zip};
                newConfig.Publish = false;
                return lambdaEast.createFunction(newConfig).promise()
                    .then(cfg => {
                        console.log('Created new function', cfg);
                        return {
                            config: cfg,
                            id: cfg.FunctionArn
                        }
                    })
            });
    }

    function updateTarget(source, target, newConfig) {
        console.log('updating target');

        return lambdaEast.updateFunctionConfiguration(newConfig).promise()
            .then(result => {
                console.log('Finished updating function configuration');
                if (source.Configuration.CodeSha256 === target.Configuration.CodeSha256) {
                    console.log('Code hasn\'t changed');
                    return {
                        config: result,
                        id: result.FunctionArn
                    };
                }

                console.log('Updating Code');

                return fetch(source.Code.Location).then(resp => resp.buffer())
                    .then(zip => {
                        return lambdaEast.updateFunctionCode({
                            FunctionName: newConfig.FunctionName,
                            ZipFile: zip
                        }).promise();
                    }).then(cfg => {
                        console.log('Updated function code');
                        return {
                            config: cfg,
                            id: cfg.FunctionArn
                        }
                    });
            });
    }

    function copyTags(sourceArn, targetArn) {
        console.log(`Syncing tags from ${sourceArn} to ${targetArn}`);

        const sourcePromise = lambdaWest.listTags({Resource: sourceArn}).promise();
        const targetPromise = lambdaEast.listTags({Resource: targetArn}).promise();

        return Promise.all([sourcePromise, targetPromise]).then(([source, target]) => {
            const sourceTags = source.Tags;
            const targetTags = target.Tags;

            console.log('Source has tags', JSON.stringify(sourceTags, null, 2));
            console.log('Target has tags', JSON.stringify(targetTags, null, 2));

            const sourceKeys = Object.keys(sourceTags);
            const targetKeys = Object.keys(targetTags);

            const toDrop = targetKeys.filter(key => !sourceKeys.includes(key));
            const toSet = {};

            sourceKeys.forEach(key => {
                const value = sourceTags[key];
                const missingInTarget = !targetKeys.includes(key);
                const differentInTarget = targetKeys[key] !== value;

                if (missingInTarget || differentInTarget) {
                    toSet[key] = value;
                }
                if (differentInTarget) {
                    toDrop.push(key);
                }
            });

            console.log('Dropping keys', toDrop);
            console.log('Setting tags', JSON.stringify(toSet, null, 2));

            return lambdaEast.untagResource({
                Resource: targetArn,
                TagKeys: toDrop,
            }).promise().then(() => {
                if (Object.keys(toSet).length === 0) {
                    return;
                }
                return lambdaEast.tagResource({
                    Resource: targetArn,
                    Tags: toSet,
                }).promise();
            });
        });
    }

};
