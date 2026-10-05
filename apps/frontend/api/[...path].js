// FILE: apps/frontend/api/[...path].js
// PURPOSE: Serves the whole Express backend as one Vercel Function, on the
//          same domain as the frontend (so the SameSite=Strict login cookie
//          works and no proxy is needed). The backend is compiled to
//          apps/backend/dist during the Vercel build (see vercel.json).
// Every /api/* request lands here with its original path; Express routes it.

import compiled from '../../backend/dist/app.js'

const app = compiled.default ?? compiled

export default function handler(req, res) {
  // Vercel adds the catch-all segment to the query string (?path=...).
  // Strip it so the backend sees exactly what the browser sent.
  const url = new URL(req.url || '/', 'http://local')
  url.searchParams.delete('path')
  url.searchParams.delete('...path')
  req.url = url.pathname + url.search
  return app(req, res)
}
