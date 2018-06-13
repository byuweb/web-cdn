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

const {html, oneLine} = require('common-tags');
const {URL} = require('url');
const mime = require('mime');

module.exports = function processBasicUsage(usage, baseUrl) {
    if (!usage) {
        return undefined;
    }
    let {head, body} = usage;
    if (!head && !body) {
        return undefined;
    }
    return {head: processHead(head, baseUrl), body}
};

function processHead(head, baseUrl) {
    if (!head) {
        return undefined;
    }
    if (typeof head === 'string') {
        return head;
    }

    const {meta = [], preload = [], styles = [], scripts = []} = head;

    const sections = [
        renderPreload(preload),
        renderMeta(meta),
        renderStyles(styles),
        renderScripts(scripts)
    ];

    return html`
        ${sections.join('\n\n')}
    `;

    function renderMeta(meta) {
        if (!meta || !meta.length) {
            return '';
        }
        return html`
        <!-- Meta -->
        ${meta.map(m => html`<meta name="${m.name}" content="${m.content}">`)}
        `;
    }

    function renderPreload(preload) {
        if (!preload || !preload.length) {
            return '';
        }
        const mapped = preload.map(p => {
            if (typeof p === 'string') {
                p = {href: p};
            }
            const {type, as: computedAs} = computeTypeInfo(p.href);
            let {href, as = computedAs, crossorigin, media} = p;
            let tag = `<link rel="preload" href="${resolve(href)}" as="${as}" type="${type}"`;

            if (as === 'font' && !crossorigin) {
                crossorigin = 'anonymous';
            }
            if (crossorigin) {
                tag += ` crossorigin="${crossorigin}"`;
            }
            if (media) {
                tag += ` media="${media}"`;
            }

            tag += '>';

            return tag;
        });
        return html`
            <!-- Preload Resources -->
            ${mapped}
        `;
    }

    function renderStyles(tags) {
        if (!tags || !tags.length) {
            return '';
        }
        const mapped = tags.map(href => html`<link rel="stylesheet" href="${resolve(href)}" type="text/css">`);
        return html`
            <!-- Stylesheets -->
            ${mapped}
        `;
    }

    function renderScripts(tags) {
        if (!tags || !tags.length) {
            return '';
        }

        const mapped = tags.map(tag => {
            if (typeof tag === 'string') {
                tag = {src: tag};
            }
            let {
                src,
                type = 'application/javascript',
                async = false,
                crossorigin,
                defer = false,
                integrity,
                nomodule = false,
            } = tag;

            if (async && defer) {
                async = false;
            }
            const open = oneLine`
                <script src="${resolve(src)}"
                    ${async ? 'async' : ''}
                    ${defer ? 'defer': ''}
                    ${nomodule ? `nomodule` : ''}
                    type="${type}"
                    ${crossorigin ? `crossorigin="${crossorigin}"` : ''}
                    ${integrity ? `integrity="${integrity}"` : ''}
            `;
            return open + '></script>';
        });

        return html`
            <!-- Scripts -->
            ${mapped}
        `;
    }

    function resolve(link) {
        return new URL(link, baseUrl).toString();
    }
}

function computeTypeInfo(href) {
    const type = mime.getType(href);
    if (!type) {
        return undefined;
    }
    return {type, as: preloadAs(type)};
}

function preloadAs(type) {
    if (type.includes('javascript')) {
        return 'script';
    } else if (type === 'text/css') {
        return 'stylesheet';
    } else if (type.startsWith('font/') || type.startsWith('application/font-')) {
        return 'font';
    } else if (type.startsWith('image/')) {
        return 'image';
    } else if (type.startsWith('video/')) {
        return 'video';
    }
    return null;
}

