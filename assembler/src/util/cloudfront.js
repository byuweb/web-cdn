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

const {CloudFront} = require('aws-sdk');
const {hash} = require('./util');

const log = require('winston');

module.exports = {
    getDistributionForAlias,
    invalidate,
};

async function invalidate(distroId, paths) {
    const cloudfront = new CloudFront();

    const ref = hash('sha256', Date.now() + JSON.stringify(paths)).hex;

    const params = {
        DistributionId: distroId,
        InvalidationBatch: {
            CallerReference: ref,
            Paths: {
                Quantity: paths.length,
                Items: paths,
            },
        },
    };

    log.info('--------------- Invalidating CloudFront Cache ---------------');
    log.debug('Distro:', distroId);
    log.debug('File Paths', paths);

    try {
        const result = await cloudfront.createInvalidation(params).promise();
        log.info('Created Invalidation', result.Invalidation.Id)
    } catch(err) {
        log.warn('Unable to create invalidation', err);
    }

}

async function getDistributionForAlias(
    alias
) {
    const cloudfront = new CloudFront();

    let marker = null;

    do {
        const params = {};
        if (marker) params.Marker = marker;

        const result = await cloudfront.listDistributions(params).promise();

        const list = result.DistributionList;

        let distro = list.Items.find(it => distributionHasAlias(it, alias));

        if (distro) {
            return distro;
        }

        marker = list.NextMarker;
    } while(marker);
    return null;
}

function distributionHasAlias(distro, alias) {
    return distro.Aliases && distro.Aliases.Items && distro.Aliases.Items.includes(alias);
}
