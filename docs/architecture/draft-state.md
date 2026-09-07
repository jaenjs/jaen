# The shared draft: jaen's editing state lives on a jaen service, not in one browser

Owner (Florian), 2026-09-07: "it would make sense putting all of it in the
jaen agent pylon. It does make sense to commit everything to the
repository, but committing is fast, building is slow, and just committing
the jaen data does not take a great amount of time, it is the build that
does. The same concept applies for publishing in general: we already have
a system that supports a temporary data state in editing mode, but
unfortunately it is only in local storage and not shared. A saved state
would make sense, but it is important that it is jaen native, not an
add-on from an app. It would fix a major flaw that currently exists in
jaen."

## Today

The CMS keeps every unpublished change in a redux store persisted to
`localStorage` (`packages/jaen/src/redux/persist-state.ts`), so a change
exists in exactly one browser until it is published. Publishing writes the
jaen data to the site's repository and starts the build, which takes
minutes, so an editor who only wants a colleague to see a draft, or a
picture in the media library on a second device, has to publish and
wait. Media uploads reach the storage gateway at once, but their entries
(`media_nodes`) are page data and follow the same path.

## Target

**One jaen service, the jaen agent, a Pylon of jaen's own.** It holds the
draft of every site it serves: the same shape the redux store holds today
(pages, fields, media nodes, the site's settings), keyed by site and kept
with a revision per change. It is jaen native: `packages/jaen-agent` in
this repository, configured on a site through one plugin option
(`agent: {url}`), with no knowledge of any app.

**Three verbs instead of one.**

- **Save** (automatic, on every change, debounced): the CMS writes the
  change to the agent, and every other editor's CMS receives it (a poll
  while the CMS is open, or a subscription where the host offers one).
  `localStorage` stays as the offline queue and the cache, nothing else.
  The last writer wins per field, with the field's revision and author
  shown where two editors touched the same field.
- **Commit** (a button, fast): the agent writes the site's jaen data into
  the repository as one commit by the editor's name, through the GitHub
  API the publish uses today, without building. The draft is unchanged,
  the commit is the history.
- **Publish** (the button that exists): commit if needed, then the build,
  as today.

**Media without a build.** The media library reads its nodes from the
draft, so a picture uploaded on one device appears in the library on
every device at once, and a page that uses it shows it after the next
publish, as before. The app folders of the taxi platform stay where they
are (its own pylon), the agent is not an app store.

**Identity.** The agent trusts the same identity server the site uses
(Zitadel, the site's own organisation), introspects the CMS's token
through the identity facade where one exists, and lets `jaen:admin` of
that site read and write its draft, nobody else. One agent can serve
many sites, each draft scoped by the site's id from the token's audience
or a site key in the plugin option.

**Where it runs.** A Cloudflare Worker with D1 per agent (the drafts are
small JSON documents, D1 keeps revisions cheaply) beside the taxi pylons in
the same account, deployed with the same script family, or on the
photonq cluster the way the identity facade runs, whichever the build
phase finds simpler to operate. One instance `agent.jaen.netsnek.com`
for every site of the estate is the goal, with limosen.at and booklimo.at
as the first two.

## Acceptance

- Two browser contexts signed in as two admins of booklimo.at: a text
  change in the first appears in the second's CMS within ten seconds
  without a publish; a picture uploaded in the first's media library
  appears in the second's library within ten seconds.
- Commit writes one commit to the site's repository with the jaen data
  and no build starts; publish starts the build as before.
- The agent refuses a token of another site's admin and an anonymous
  call; it answers the draft of booklimo.at only to booklimo's admins.
- A browser offline keeps editing, and the queue drains when it is back.
- Nothing about this lives in `gatsby-jaen-app`; the taxi platform only
  gains the plugin option in its two site configs.
