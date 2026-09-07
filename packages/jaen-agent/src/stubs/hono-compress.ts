/**
 * No-op replacement for `hono/compress` in the Workers bundle.
 *
 * Pylon registers `app.use('*', compress())` for every deployment. Under Node
 * that is useful. On Cloudflare it breaks every response: the middleware
 * gzips the body and sets `Content-Encoding: gzip`, Cloudflare's edge -- which
 * does its own compression and assumes an identity response from the origin --
 * drops that header on the way out, and the client receives gzip bytes it has
 * been told are plain JSON. `curl https://osg.netsnek.com/ping` returned
 * binary until this stub existed.
 *
 * Cloudflare compresses responses on its own, so nothing is lost by removing
 * it here. Hono's own documentation says not to use this middleware on
 * Workers for exactly this reason.
 */
import type {MiddlewareHandler} from 'hono'

export const compress = (): MiddlewareHandler => async (_c, next) => {
  await next()
}

export default compress
