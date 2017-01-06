# Wish List

* [ ] Email subscriptions for new version releases
* [ ] Server-side bundling of resources - possibly via Lambda?
* [ ] Run gulp/grunt builds/tests automatically
* [ ] Beta/unstable versions


# Notes

## Email subscriptions

In the UI, allow users to enter an email address to subscribe to update
notifications for libraries which they care about. Whenever we push
out an update to that library, we could send them an email letting them
know that it's there.  That way they can check and make sure that their
site isn't broken by the change or, if they have pegged themselves to
a specific version, they can update the version they reference.

If we want to limit this to BYU users, we could use OIT's OAuth Implicit
Grant implementation to provide for user login.

## Beta/unstable

It would be nice to allow users to test unstable/beta versions of
libraries. We would probably do this by sticking the current contents
of branches (following the normal build/inclusion rules) into an
`unstable/` directory, like
`https://web-cdn.byu.edu/my-lib/unstable/master`.
We could also filter out releases flagged as pre-release from the stable
directory and put them in `unstable/`. We would want to include a warning
that the refs in `unstable` may disappear at any time. We could also
make unstable branches optional, enabled by a flag (and possibly a
whitelist of branches/tags) in `.cdn-config.yml`


