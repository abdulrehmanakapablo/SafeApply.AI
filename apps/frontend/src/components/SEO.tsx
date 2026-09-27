// FILE: src/components/SEO.tsx
// Manages <title>, meta tags, canonical link and JSON-LD structured data for the SPA.
// Update SITE_URL to your production domain before deploying.

import { useEffect } from 'react'

export const SITE_URL = 'https://safeapply.ai' // TODO: replace with real domain
export const SITE_NAME = 'SafeApply.AI'

interface SEOProps {
  title: string
  description: string
  path?: string
  type?: 'website' | 'article'
  image?: string
  publishedTime?: string
  modifiedTime?: string
  author?: string
  tags?: string[]
  noindex?: boolean
  jsonLd?: object | object[]
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function upsertJsonLd(data: object | object[]) {
  const id = 'page-jsonld'
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('script')
    el.id = id
    el.setAttribute('type', 'application/ld+json')
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

export default function SEO({
  title,
  description,
  path = '/',
  type = 'website',
  image = '/og-image.png',
  publishedTime,
  modifiedTime,
  author,
  tags = [],
  noindex = false,
  jsonLd,
}: SEOProps) {
  useEffect(() => {
    const url = `${SITE_URL}${path}`
    const img = image.startsWith('http') ? image : `${SITE_URL}${image}`

    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
    upsertCanonical(url)

    // Open Graph
    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:image', img)

    // Twitter
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', img)

    // Article extras
    if (type === 'article') {
      if (publishedTime) upsertMeta('property', 'article:published_time', publishedTime)
      if (modifiedTime) upsertMeta('property', 'article:modified_time', modifiedTime)
      if (author) upsertMeta('property', 'article:author', author)
      tags.forEach((t, i) => upsertMeta('property', `article:tag:${i}`, t))
    }

    if (jsonLd) upsertJsonLd(jsonLd)
  }, [title, description, path, type, image, publishedTime, modifiedTime, author, tags, noindex, jsonLd])

  return null
}