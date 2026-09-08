# tests: the jaen notebook verification suite

A Jupyter test suite for the jaen monorepo. **One notebook per concern**, every
notebook records a list of named checks through [`jaen_testkit.py`](jaen_testkit.py),
and every check comes out as PASS, FAIL, SKIP or WARN with the evidence attached.

The suite is written in Python on purpose. The implementation is TypeScript;
the tests judge what a build actually produced — compiled artifacts, generated
pages, `sitemap.xml`, GraphQL schemas — instead of shortcutting through the
implementation's own internals.

Building is allowed, deploying is not: notebooks may install and build the
working copies, but anything that publishes (push, deploy, send real mail)
belongs in a **markdown** cell for a human to run.

## The notebooks

| Notebook                     | Verifies                                                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `00-preflight.ipynb`         | toolchain, working copies, workspace layout                                                                                                                                   |
| `01-build.ipynb`             | package builds: jaen, gatsby-plugin-jaen, gatsby-source-jaen, gatsby-jaen-emailwerk                                                                                           |
| `02-cms-i18n.ipynb`          | CMS locale dictionaries: completeness across all locales, ICU syntax, locale resolution order                                                                                 |
| `03-pages-i18n.ipynb`        | the fixture site build: localized page variants, `<html lang>`, canonical links                                                                                               |
| `04-sitemap.ipynb`           | `sitemap.xml`: well-formed, absolute URLs, full reciprocal hreflang matrix + x-default, exclusions, `robots.txt`                                                              |
| `05-emailwerk.ipynb`         | emailwerk API parity with the jaen client's expectations                                                                                                                      |
| `06-zitadel-gql.ipynb`       | zitadel-gql client/SDL conformance; no legacy REST usergrant calls                                                                                                            |
| `07-public-send.ipynb`       | emailwerk's anonymous `sendTemplateMail`: no REST route, the allowlist, what the gate still refuses without credentials                                                       |
| `08-theme.ipynb`             | the Chakra v3 system: tokens, semantic tokens, recipes and the shadow contract                                                                                                |
| `09-editing-latency.ipynb`   | what one field blur costs: the store's size off booklimo's own draft, the writes and milliseconds per blur in node and in chromium, and the blur to paint gap in the real CMS |
| `10-draft-persistence.ipynb` | that an edit is never lost: the payload, a reload, a hidden tab, an offline queue, a poll mid-edit, discard, the no-agent escape, and the four the browser has to answer      |

## Install

```bash
cd tests
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

The testkit itself needs nothing but the Python standard library. The
requirements file exists for Jupyter and papermill.

## Run

Interactively:

```bash
source .venv/bin/activate
jupyter lab
```

Headless:

```bash
source .venv/bin/activate
papermill 04-sitemap.ipynb out/04-sitemap-output.ipynb
```

## Configuration

Everything is overridable through the environment (see `CONFIG` in the
testkit): `JAEN_ROOT` (monorepo root), `JAEN_SITE_DIR` (the netsnek.com
checkout used as the end-to-end fixture), `JAEN_EMAILWERK_DIR`,
`JAEN_IAM_SDL`, `JAEN_EMAILWERK_URL`, `JAEN_ZITADEL_GQL_URL`,
`JAEN_SITE_LOCALES`, `JAEN_SITE_DEFAULT_LOCALE`, `JAEN_CMS_LOCALES`.
Checks whose preconditions are missing SKIP with a reason instead of failing.

`09-editing-latency.ipynb` and `10-draft-persistence.ipynb` are the two
notebooks of `docs/architecture/editing-performance.md`. They read booklimo's
own `jaen-data/` through `JAEN_SITE_BUILD` (the booklimo.at checkout, whose
`public/` is also the build their browser halves serve), drive
`packages/jaen/src/redux` in node through `support/editing-harness.ts`, and use
the playwright interpreter named by `JAEN_PLAYWRIGHT_PYTHON` (the taxi suite's
virtualenv by default) for their browser halves, which SKIP when it, the build
or the booklimo human admin's credentials are missing. Their browser halves
write on booklimo and set what they wrote back; nothing runs on limosen.
Until the change the plan describes is made, both notebooks are expected to end
red: their acceptance checks are written against the target, not against the
code as it stands.

`07-public-send.ipynb` adds two of its own: `JAEN_ALLOW_LIVE_MAIL=1` opts
into the one check that sends a real mail through the deployed instance (it
SKIPs otherwise), and `JAEN_EMAILWERK_CONTACT_TEMPLATE` pins the template id
that check uses instead of discovering it.
