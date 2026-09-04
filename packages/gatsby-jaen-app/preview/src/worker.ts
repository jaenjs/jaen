import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";

type Bindings = {
  ASSETS: Fetcher;
  /**
   * Basic Auth for the preview deployment, as Worker secrets.
   *
   * These two were hardcoded here in plain text, which put a live credential
   * into every copy of this package, including a backup tarball. Set them with
   * `wrangler secret put PREVIEW_USER` and `wrangler secret put PREVIEW_PASS`,
   * and rotate the old pair, because it has been sitting in a working tree.
   */
  PREVIEW_USER: string;
  PREVIEW_PASS: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Protect all routes with Basic Auth
app.use("*", async (c, next) =>
  basicAuth({
    username: c.env.PREVIEW_USER,
    password: c.env.PREVIEW_PASS
  })(c, next)
);

// Serve static assets for all other routes (after auth)
// SPA fallback: if the asset is not found, serve index.html
app.get("*", async (c) => {
  const response = await c.env.ASSETS.fetch(c.req.raw);
  if (response.status === 404) {
    // SPA fallback: serve index.html for client-side routes
    const url = new URL(c.req.url);
    url.pathname = "/index.html";
    const fallback = await c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
    return new Response(fallback.body, {
      status: 200,
      headers: fallback.headers,
    });
  }
  return response;
});

export default app;
