// FILE: src/components/SEO.tsx
// PURPOSE: <title>, meta, canonical and JSON-LD for the SPA.

import { useEffect } from 'react'

/** Set VITE_SITE_URL in production (e.g. https://safeapply.ai); used for canonical and OG URLs. */
export const SITE_URL = String(import.meta.env.VITE_SITE_URL || 'https://safeapply.ai').replace(/\/+$/, '')
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

function removeMeta(attr: 'name' | 'property', key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove()
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

function upsertJsonLd(data: object | object[] | null) {
  const id = 'page-jsonld'
  let el = document.getElementById(id)
  if (!data) {
    el?.remove()
    return
  }
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
  image,
  publishedTime,
  modifiedTime,
  author,
  tags,
  noindex = false,
  jsonLd,
}: SEOProps) {
  const tagKey = (tags || []).join('|')
  const ldKey = jsonLd ? JSON.stringify(jsonLd) : ''

  useEffect(() => {
    const url = `${SITE_URL}${path}`
    const img = image ? (image.startsWith('http') ? image : `${SITE_URL}${image}`) : ''

    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
    upsertCanonical(url)

    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', url)
    if (img) upsertMeta('property', 'og:image', img)
    else removeMeta('property', 'og:image')

    upsertMeta('name', 'twitter:card', img ? 'summary_large_image' : 'summary')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    if (img) upsertMeta('name', 'twitter:image', img)
    else removeMeta('name', 'twitter:image')

    if (type === 'article') {
      if (publishedTime) upsertMeta('property', 'article:published_time', publishedTime)
      if (modifiedTime) upsertMeta('property', 'article:modified_time', modifiedTime)
      if (author) upsertMeta('property', 'article:author', author)
      tagKey.split('|').filter(Boolean).forEach((t, i) => upsertMeta('property', `article:tag:${i}`, t))
    }

    upsertJsonLd(ldKey ? (JSON.parse(ldKey) as object) : null)
  }, [title, description, path, type, image, publishedTime, modifiedTime, author, tagKey, noindex, ldKey])

  return null
}
