# Aliases

Most of the time, we want users to be able to automatically get updates to libraries without having to change
the URL they reference. For this reason, the CDN uses 'aliases'. Aliases are place in the URL in place of an explicit
version number: `https://cdn.byu.edu/my-library/{version or alias}/{file}`.

There are four alias patterns used by the CDN:

## `latest` - latest production release

`latest` always points to the latest stable release of your code. If you have published tags with Semantic Version names,
`latest` will always point to the highest version, as determined by Semver rules. Otherwise, `latest` will point to
the master branch of your repository.

## `unstable` - bleeding-edge code

`unstable` always points to the master branch of the repository.

## Major Version Aliases (1.x.x)

Major version aliases allow consumers to receive updates that do not change the major version of the library. These
aliases look like `{major version}.x.x`. For example, if the highest version number tag is `1.2.3`, `1.x.x` will resolve
to that version.

## Minor Version Aliases (1.0.x)

Minor version aliases are in the form of `{major version}.{minor version}.x`, and work much like major version aliases.

# Examples

Let's say that a library has the following tags and branches:

** Tags **

* v1.0.0
* 1.0.1
* 1.0.2
* 1.1.0
* 1.1.1
* 2.0.0
* not-a-semver-tag

** Branches **

* master
* my-new-feature

These paths that will be created for your library:

* 1.0.0 *(note the missing 'v')*
* 1.0.1
* 1.0.2
* 1.1.0
* 1.1.1
* 2.0.0
* not-a-semver-tag
* experimental/master
* experimental/my-new-feature

These alias will also be created:

* 1.x.x -> 1.1.1
* 1.0.x -> 1.0.2
* 1.1.x -> 1.1.1
* 2.x.x -> 2.0.0
* 2.0.x -> 2.0.0
* latest -> 2.0.0
* unstable -> experimental/master

# Implementation Notes

The most difficult part of implementing aliases is balancing the need to leverage long-term caches and the desire
to push bug fixes to users quickly. To maintain this balance, the CDN implements most aliases by using redirects.

## Redirected Aliases

When a user requests a file using an alias, the user will be redirected to a path which includes the resolved version.
The redirect will be returned with cache headers that will instruct the browser to cache the redirect for a short time
(hours). Then, the resolved version file will be served with very long caching headers 
(1 year, `immutable`).

### Example

Suppose that the versions from the above example are from a library named 'my-library' and the browser is requesting a 
script named `https://cdn.byu.edu/my-library/2.x.x/my-script.js`.

If the browser has never requested this resource before, two requests will be issued (actual headers will vary):

```http request
GET /my-library/2.x.x/my-script.js
Host: cdn.byu.edu
Accept: */*

HTTP/2 302
Location: /my-library/2.0.0/my-script.js
Cache-Control: max-age=3600
Content-Length: 0
```

```http request
GET /my-library/2.x.x/my-script.js
Host: cdn.byu.edu
Accept: */*


HTTP/2 200
Cache-Control: public, max-age=31557600, immutable
Content-Type: application/javascript
Content-Length: 28

console.log('hello, world!')
```

If the browser has previously loaded the resource within the duration of the redirect's cache (in this case, 1 hour),
no requests will be issued.

If the browser's cache of the redirect has expired, the browser will make a new request to the alias URL. If the alias
has not changed, the browser will then use its cached version of the actual file.

If the alias has changes, the next time the browser makes a request to the alias URL, it will be redirected to
the new version, and the browser will load the new version of the file.

## Disabling Redirects

> Make sure you understand the tradeoffs involved in disabling redirects before doing so!

In some cases, there are libraries which contain files which are functionally immutable.  A good example might
be a collection of icons. The icons themselves will not change, but new versions of the library may be created
which add more icons to the collection.  In this case, it's inefficient to have alias perform redirects.  For
these cases, libraries can add the following to their `.cdn-config.yml` file to disable redirects:

```yaml
aliases:
  redirect: false
  cache:
    immutable: true
```

This will instruct the CDN to serve alias files directly instead of redirecting, and to serve them with
'immutable' cache headers (`public, max-age=31557600, immutable`). This offers the most efficient loading experience
possible, but, if the files in the library ever change, any users who have already loaded them will see the old
version until they manually clear their cache.


