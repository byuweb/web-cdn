# BYU Web Community CDN

Welcome the source of the BYU Web Community CDN!  This CDN aims to host all of the resources you need to use the
official BYU Look and Feel on your website.

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

# Criteria for hosting

In order for us to host code in this CDN, the code must either be built by the Web Community for use by campus, or
must be generally useful to a large number of campus sites.  In general, the following things must be true:

1. The code must be of high quality and relatively free of defects.
2. There must be a commitment one the part of the contributing department to oversee the maintenance and improvement of
the code indefinitely, including implementation of any future changes to the official BYU Look and Feel. Just because
the Web Community is hosting it doesn't mean that we have the time or resources to maintain your code!
3. For Javascript code, automated regression and unit tests must be included in the project, covering a reasonable percentage
of the project's use cases.
4. The code or resources must have clear documentation about how to consume them.

# Adding new repositories

If the above criteria are true, you can request that your project be hosted in the CDN.  Here's how:

1. Add a `.cdn-config.yml` file to your repository (see instructions and options below).
2. Fork this repository.
3. In your fork, add an entry for your repository to `main-config.yml` (see instructions below).
4. Open a Pull Request to merge your changes into the main repository. Be prepared to explain why the Web Community as
a whole should take on the burden of hosting your code. While we will most likely accept your contribution, we do want
to make sure that certain quality standards are upheld.

# `main-config.yml`

The `main-config.yml` file contains references to other projects/resources to include in the CDN. For now, we only
support referencing Github projects, though support for other references may be added in the future (Gitlab, pulling from
another open-source CDN, etc.).

Each entry in the YML file consists of two parts: the name by which the project will be referenced in the CDN, and the
source for the project.

The name determines what URL will be used to reference your project.  For example, if you name your project
`my-fancy-widget`, the URL to reference the latest version might be
`https://web-cdn.byu.edu/my-fancy-widget/latest/widget.js`

The source component tells the CDN from where to fetch your data. It consists of the prefix `github:`, followed by the
owner and repository names.

Put together, the entry for `my-fancy-widget`, hosted on Github in the my-department organization in the my-widget repo,
would look like this:

```yml
my-fancy-widget:
  source: github:my-department/my-widget
```

Other options may be added to `main-config.yml` as the need arises.

# `.cdn-config.yml`

This file belongs in the root of a repository that is referenced in `main-config.yml`. Only the version
of this file that is on the `master` branch of the repository is used to build the CDN. That isn't to say that only
the contents of `master` are hosted on the CDN; by default, the CDN will include pointers to all releases/tags and branches.

A sample `.cdn-config.yml` might look like this:

```yml
------
name: My Fancy Widget
description: A widget for being really, really fancy.
docs: https://example.com/my-widget-docs/
resources:
  - main.js
  - images/**
  - src: css/**
    dest: /
```

## `name` - Display Name

This is a user-friendly name for your library. It will be displayed in the CDN UI.

## `description` - Description

A brief, user-friendly description of your library, for display in the CDN UI. By default, this is pulled from the
Github repository description.

## `resources` - File Inclusion

The `resources` list tells the CDN what files should be served.  This can include glob patterns like `"dist/**.js"`, as well
as individual file paths.  All paths are resolved relative to the root directory. If there are multiple files or globs,
they will all be included.

By default, files are included as-is. For example, your project looks like this:

```
+ /
  + scripts/
    - helpful-script.js
  + other/
    - some-other-stuff.js
  - .gitignore
  - README.md
  - main.js
  - styles.css
```

And your configuration looks like this:

```yml
files:
  - scripts/**
  - main.js
  - styles.js
```

Then the following resources will be available under `https://web-cdn.byu.edu/my-widget/latest/`:

* scripts/helpful-script.js
* main.js
* styles.css

### `dest` - File Relocation

It may not be very user-friendly to make the CDN's directory structure match your project.  For example, it is a common
pattern to assemble Javascript using a tool such as Gulp or Grunt and place the output into the `dist/` directory.
It's kind of awkward to have the consumer reference `dist/` in the URL they use to load your resource, so we provide
file relocations to help with this.

The following config file will make everything in `dist/` available at the root of your project in the CDN:

```yml
files:
  - src: dist/**
    dest: /
```

**Note that the file name/glob must now be prefixed with `src: `!**

If multiple relocations map to the same destination, we will attempt to apply them all.  If two files would be relocated to the
same filename, the build will fail and the CDN maintainers will be alerted.

## `docs` - Documentation

By default, the build process will use the README file from your repository to generate a page explaining your library.
You should also have detailed documentation available about how to use your library/resources.  One easy way to distribute
such documentation is using [Github Pages](https://pages.github.com/). If the CDN detects a GH Pages site (by checking
if `https://your-user-or-org.github.io/your-project` exists), a link will be included in the CDN UI. Otherwise, you
must specify a documentation URL in your `.cdn-config.yml` file using the `docs` key, like so:

```yml
------
docs: https://example.com/my-widget-docs
```

