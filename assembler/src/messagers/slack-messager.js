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

const axios = require('axios');

const MessagerBase = require('./messager-base');

const COLOR_ERROR = '#B3041A';
const COLOR_WARNING = '#FCC015';

const COLOR_NEW = '#66B200';
const COLOR_UPDATED = '#5F7C9B';
const COLOR_REMOVED = '#C5C5C5';

class SlackMessager extends MessagerBase {

    constructor({webhookUrl, channel}) {
        super();
        this.webhookUrl = webhookUrl;
        this.channel = channel;
    }

    async sendError(buildContext, error) {
        console.log('!!!!!!!!!!!!!! Finished with error !!!!!!!!!!!!!!\n', error);

        const errorText = error.trace ? `\`\`\`\n${error.trace}\n\`\`\`` : '';

        await this._sendToSlack(buildContext, ':boom:', 'FAILED', [{
            fallback: 'Build Error:' + this._errors.join('; '),
            color: COLOR_ERROR,
            title: `:rotating_light: Fatal Error :rotating_light:`,
            text: `${error.message}\n${errorText}`
        }]);
    }

    async sendSuccess(buildContext) {
        super.sendToConsole(buildContext);

        const attachments = [];

        if (this._errors.length > 0) {
            attachments.push({
                fallback: 'Build Errors: ' + this._errors.join('; '),
                color: COLOR_ERROR,
                title: ':rotating_light: Build Errors :rotating_light:',
                text: this._errors.map(it => '• ' + it).join('\n')
            });
        }

        if (this._warnings.length > 0) {
            attachments.push({
                fallback: 'Warnings: ' + this._errors.join('; '),
                color: COLOR_WARNING,
                title: ':exclamation: Warnings :exclamation:',
                text: this._warnings.map(it => '• ' + it).join('\n')
            });
        }

        attachments.push(
            ...this._slackNewLibs(),
            ...this._slackUpdatedLibs(),
            ...this._slackRemovedLibs(),
        );

        await this._sendToSlack(buildContext, ':building_construction:', 'finished', attachments);
    }

    async _sendToSlack(buildContext, firstLineEmoji, result, attachments) {
        const suffix = buildContext.env === 'prod' ? '' : ` (${buildContext.env})`;

        let text = `${firstLineEmoji} ${buildContext.cdnHost} ${result} in ${this._getElapsedTime(buildContext.started)} seconds`;

        if (buildContext.dryRun) {
            text += '\nDry Run - No files were harmed in the running of this build';
        }
        if (buildContext.forceBuild) {
            text += '\nForce Build - All libs and versions have been reassembled.';
        }

        const slackMessage = {
            channel: this.channel,
            icon_url: 'https://beta.cdn.byu.edu/.cdn-infra/r2.jpg',
            username: 'CDN Build Bot' + suffix,
            text: text,
            attachments,
        };

        try {
            await
                axios.post(this.webhookUrl, slackMessage);
        } catch (err) {
            console.warn('Unable to send slack message')
        }
    }

    _slackNewLibs() {
        return this._newLibs.map(lib => {
            return this.__slackLibWithVersions(lib, COLOR_NEW, 'added')
        });
    }

    _slackUpdatedLibs() {
        return this._updatedLibs.map(lib => {
            return this.__slackLibWithVersions(lib, COLOR_UPDATED, 'updated')
        });
    }

    _slackRemovedLibs() {
        return this._removedLibs.map(({libId, libLink}) => {
            const title = libId + ' was removed';
            return {
                fallback: title,
                color: COLOR_REMOVED,
                title,
                title_link: libLink
            };
        });
    }

    __slackLibWithVersions({libId, libLink}, color, action) {
        const versions = [
            ...this._newVersions.filter(it => it.libId === libId)
                .map(it => `:tada: <${it.versionLink}|${it.versionId}>`),
            ...this._updatedVersions.filter(it => it.libId === libId)
                .map(it => `:pencil:️ <${it.versionLink}|${it.versionId}>`),
            ...this._removedVersions.filter(it => it.libId === libId)
                .map(it => `:wastebasket:️ <${it.versionLink}|${it.versionId}>`),
            ...this._updatedAliases.filter(it => it.libId === libId)
                .map(it => `:sparkles:  ${it.aliasName} → ${it.aliasTarget}`)
        ];

        const title = libId + ' was ' + action;

        return {
            fallback: title,
            color: color,
            title: title,
            title_link: libLink,
            text: versions.join('\n'),
        }
    }

}

module.exports = SlackMessager;

// const m = new SlackMessager({
//     channel: '@joseph_moore',
//     webhookUrl: 'https://hooks.slack.com/services/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',
// });
//
// m.addedLib({
//     libId: 'byu-theme-components',
//     name: 'BYU Theme Components',
//     libLink: 'https://github.com/byu-oit/byu-theme-components'
// });
// m.updatedLib({libId: 'something-else', name: 'stuff', libLink: 'https://example.com'});
//
// m.newVersion({libId: 'byu-theme-components', versionId: 'new-branch', versionLink: 'https://example.com'});
// m.newVersion({libId: 'byu-theme-components', versionId: '1.0.0', versionLink: 'https://example.com'});
//
// m.newVersion({libId: 'something-else', versionId: 'some-branch', versionLink: 'https://example.com'});
//
// m.updatedVersion({libId: 'byu-theme-components', versionId: 'updated', versionLink: 'https://example.com'});
//
// m.removedVersion({libId: 'byu-theme-components', versionId: 'stale-branch', versionLink: 'https://example.com'});
//
// m.updatedAlias({libId: 'byu-theme-components', aliasName: 'latest', aliasTarget: '1.0.0'});
// m.updatedAlias({libId: 'byu-theme-components', aliasName: '1.x.x', aliasTarget: '1.0.0'});
// m.updatedAlias({libId: 'byu-theme-components', aliasName: '1.0.x', aliasTarget: '1.0.0'});
//
// m.deletedLib({libId: 'old-lib', libLink: 'https://example.com'});
//
// m.error({message: 'some error'});
// m.warning({message: 'some warning'});
//
// const started = new Date();
// started.setTime(Date.now() - 2500);
//
// (async () => {
//     await m.send({started, env: 'local', cdnHost: 'fake.cdn.byu.edu'});
// })();

