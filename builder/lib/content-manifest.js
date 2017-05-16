/**
 * Created by ThatJoeMoore on 1/25/17.
 */
"use strict";

/**
 * @typedef {{}} RepoConfig
 * @property {string} name
 * @property {string} description
 * @property {string} docs
 * @property {Array.<string|{src: string, dest: string}>} resources
 * @property {Object.<string, string>} entrypoints
 */

/**
 * @typedef {object} Manifest
 * @property {string} $cdn-version
 * @property {string} $built
 * @property {Object.<string, ManifestLib>} libraries
 */

/**
 * @typedef {object} ManifestLib
 * @property {string} name
 * @property {string} description
 * @property {string} docs_url
 * @property {string} source
 * @property {Object.<string, string>} aliases
 * @property {ManifestVersion[]} versions
 */

/**
 * @typedef {object} ManifestVersion
 * @property {string} name
 * @property {string} ref
 * @property {string} tarball_url
 * @property {string} git_sha
 * @property {string} link
 * @property {Object.<string, ManifestResource>} resources
 */

/**
 * @typedef {object} ManifestResource
 * @property {boolean} entrypoint
 * @property {?string} description
 * @property {int} size
 * @property {int} gzipped_size
 */
