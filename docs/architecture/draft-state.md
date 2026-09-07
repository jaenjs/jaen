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

## Target, corrected by the owner the same evening

Owner: "I still want the jaen agent to store in git with git commits and
the jaen data structure like currently. I want it to retrieve that data
from GitHub as well, not a separate database."

**The repository is the store. There is no database.** The draft of a
site is the site's own jaen data in its own repository, in the structure
it has today (`jaen-data/`, the patches, the media nodes), and the jaen
agent is the one process that reads it from GitHub and writes it back as
git commits. What editors share is the repository's HEAD, not a copy of
it anywhere else.

**One jaen service, the jaen agent, a Pylon of jaen's own.** It is jaen
native: `packages/jaen-agent` in this repository, configured on a site
through one plugin option (`agent: {url, repository}`), with no knowledge
of any app. It holds no state of its own beyond a short cache of what it
last read from GitHub and a queue of commits in flight, both in memory or
in a KV of the Worker, never a database of record.

**Three verbs instead of one.**

- **Save** (automatic, on every change, debounced): the CMS sends the
  change to the agent, the agent reads the current jaen data of the
  repository, applies the change, and commits it to the repository in
  the editor's name, one commit per saved change or per debounced batch,
  through the GitHub API. Every other editor's CMS receives the new HEAD
  (a poll of the agent while the CMS is open). Committing is fast, that
  is the point. `localStorage` stays as the offline queue and the cache,
  nothing else. Two editors on one field: the later commit wins, and the
  CMS shows the field's last author and instant.
- **Publish** (the button that exists): the build, as today, from the
  repository's HEAD. Nothing is committed at publish time that was not
  committed at save time.
- There is no separate commit button: saving is committing.

**Media without a build.** The media library reads its nodes from the
repository's HEAD through the agent, so a picture uploaded on one device
(the file on the storage gateway, the node committed by the agent)
appears in the library on every device at once, and a page that uses it
shows it after the next publish, as before. The app folders of the taxi
platform stay where they are (its own pylon).

**Identity.** The agent trusts the same identity server the site uses
(Zitadel, the site's own organisation), introspects the CMS's token
through the identity facade where one exists, and lets `jaen:admin` of
that site read and write that site's repository, nobody else. The
repository credential is the agent's own (a GitHub App installation or a
fine-grained token per repository, held as a Worker secret), the editor's
identity goes into the commit's author line.

**Where it runs.** A Cloudflare Worker beside the taxi pylons in the same
account, deployed with the same script family, one instance
`agent.jaen.netsnek.com` for every site of the estate, limosen.at and
booklimo.at first. A KV namespace for the read cache and the in-flight
queue is allowed, D1 or any other database is not.

## Acceptance

- Two browser contexts signed in as two admins of booklimo.at: a text
  change in the first appears in the second's CMS within ten seconds
  without a publish; a picture uploaded in the first's media library
  appears in the second's library within ten seconds.
- Every saved change is one commit in the site's repository in the
  editor's name, readable with git log within ten seconds, and no build
  starts; publish starts the build as before. A second editor's CMS
  reads the change from the repository through the agent, not from any
  other store.
- The agent refuses a token of another site's admin and an anonymous
  call; it answers the draft of booklimo.at only to booklimo's admins.
- A browser offline keeps editing, and the queue drains when it is back.
- Nothing about this lives in `gatsby-jaen-app`; the taxi platform only
  gains the plugin option in its two site configs.
