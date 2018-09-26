# BYU Web Community CDN

Welcome the source of the BYU Web Community CDN!  This CDN aims to host all of the resources you need to use the
official BYU Look and Feel on your website.

# Adding Libraries to the CDN

See [the checklist](docs/adding-libraries.md)

# Usage

Go to [https://brand.byu.edu](https://brand.byu.edu) to learn about the BYU theme.

# How it works

The CDN is governed by the [main-config.yml](main-config.yml) file in this repository.  This file references other
repositories, from which we pull the contents for the CDN.
Whenever a change is pushed to this repo or any of the repositories it references, a rebuild of the CDN contents
will be triggered.

The CDN itself is hosted in Amazon S3 and served through Amazon Cloudfront. This allows us to have very high uptime
guarantees and grants us simplicity in deployment. It also give us great analytics about the usage of the CDN.

# CDN Layout

The basic URL pattern for hosted libraries is as follows:

`https://cdn.byu.edu/{libraryName}/{version}`

By default, a version will be created for each tag/release in the library's repository. In addition, versions
will be created for each major and minor version, to allow consumers to easily get updates to the libraries they consume.
Finally, a `latest` version will be included with a reference to the latest release/tag, as determined by semver rules.

Let's say that your project has the following tags/releases:

* 1.0.0
* 1.0.1
* 1.0.2
* 1.1.0
* 1.1.1
* 2.0.0

Here's what version paths will be created for your library:

* 1.0.0
* 1.0.1
* 1.0.2
* 1.1.0
* 1.1.1
* 2.0.0
* 1.x.x -> 1.1.1
* 1.0.x -> 1.0.2
* 1.1.x -> 1.1.1
* 2.x.x -> 2.0.0
* 2.0.x -> 2.0.0
* latest -> 2.0.0

This allows a consumer to decide how automatic they want updates to be for their dependencies. Most users should generally
use the major version - `1` or `2` in this case - to get all future non-breaking updates to a dependency. If a user
wants to be more cautious, they can reference a minor version - `1.1` - to get only bug fix updates, not new feature
updates.

Additional URL endpoints also exist to access git branches and tags. For that information you'll want to
[read about aliases](./docs/aliases.md).

# Criteria for hosting

In order for us to host code in this CDN, the code must either be built by the Web Community for use by campus, or
must be generally useful to a large number of campus sites.  In general, the following things must be true:

1. The code must be of high quality and relatively free of defects.
2. There must be a commitment on the part of the contributing department to oversee the maintenance and improvement of
the code indefinitely, including implementation of any future changes to the official BYU Look and Feel. Just because
the Web Community is hosting it doesn't mean that we have the time or resources to maintain your code!
3. For Javascript code, automated regression and unit tests must be included in the project, covering a reasonable percentage
of the project's use cases.
4. The code or resources must have clear documentation about how to consume them.

