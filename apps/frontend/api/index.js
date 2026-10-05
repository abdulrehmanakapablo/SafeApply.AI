// FILE: apps/frontend/api/index.js
// PURPOSE: The one Vercel function. vercel.json rewrites every /api/* request
//          here as /api/index?__p=<rest of path>; this rebuilds the original
//          URL (/api/<rest>?<original query>) and hands it to Express.
//          (Catch-all file names like [...path].js only match one segment
//          outside Next.js, which is why /api/auth/signup returned 404.)

import compiled from '../../backend/dist/app.js'

const app = compiled.default ?? compiled

export default function handler(req, res) {
  const url = new URL(req.url || '/', 'http://local')
  const rest = url.searchParams.get('__p')
  if (rest !== null) {
    url.searchParams.delete('__p')
    url.pathname = `/api/${rest}`
  }
  req.url = url.pathname + url.search
  return app(req, res)
}
