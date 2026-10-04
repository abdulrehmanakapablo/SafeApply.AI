// FILE: src/pages/public/BlogPost.tsx
// Renders a single blog post by slug with full SEO metadata.
// 404 fallback if slug not found.

import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import SEO, { SITE_URL, SITE_NAME } from '../../components/SEO'
import PublicLayout from '../../components/layout/PublicLayout'
import { ButtonLink, Icon } from '../../components/ui'
import { BLOG_POSTS } from '../../data/blogPosts'

// ── Markdown-lite renderer ─────────────────────────────────
// Supports: paragraphs, ## H2, ### H3, - bullets, 1. numbered, > quotes
// Inline: **bold**, *italic*, `code`
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // Combined regex for bold, italic, code
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  const parts = text.split(regex)
  parts.forEach((part, i) => {
    if (!part) return
    const key = `${keyPrefix}-${i}`
    if (part.startsWith('**') && part.endsWith('**')) {
      nodes.push(<strong key={key} className="text-fg font-semibold">{part.slice(2, -2)}</strong>)
    } else if (part.startsWith('*') && part.endsWith('*')) {
      nodes.push(<em key={key}>{part.slice(1, -1)}</em>)
    } else if (part.startsWith('`') && part.endsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-line px-1.5 py-0.5 text-[0.9em] text-accent">
          {part.slice(1, -1)}
        </code>
      )
    } else {
      nodes.push(part)
    }
  })
  return nodes
}

function renderContent(content: string): ReactNode[] {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // Skip empty
    if (!line.trim()) {
      i++
      continue
    }

    // H2
    if (line.startsWith('## ')) {
      blocks.push(
        <h2 key={`h2-${key++}`} className="mt-14 mb-4 text-2xl font-semibold tracking-tight text-fg">
          {renderInline(line.slice(3), `h2i-${key}`)}
        </h2>
      )
      i++
      continue
    }

    // H3
    if (line.startsWith('### ')) {
      blocks.push(
        <h3 key={`h3-${key++}`} className="mt-8 mb-3 text-lg font-semibold text-fg">
          {renderInline(line.slice(4), `h3i-${key}`)}
        </h3>
      )
      i++
      continue
    }

    // Bullet list — consume consecutive `- ` lines
    if (line.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2))
        i++
      }
      blocks.push(
        <ul key={`ul-${key++}`} className="my-4 space-y-2 pl-6">
          {items.map((item, idx) => (
            <li key={idx} className="list-disc text-fg/80 leading-relaxed">
              {renderInline(item, `uli-${key}-${idx}`)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Numbered list — consume consecutive `N. ` lines
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''))
        i++
      }
      blocks.push(
        <ol key={`ol-${key++}`} className="my-4 space-y-2 pl-6">
          {items.map((item, idx) => (
            <li key={idx} className="list-decimal text-fg/80 leading-relaxed">
              {renderInline(item, `oli-${key}-${idx}`)}
            </li>
          ))}
        </ol>
      )
      continue
    }

    // Blockquote — consume consecutive `> ` lines
    if (line.startsWith('> ')) {
      const quotes: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quotes.push(lines[i].slice(2))
        i++
      }
      blocks.push(
        <blockquote
          key={`bq-${key++}`}
          className="my-6 border-l-2 border-accent bg-surface py-3 pl-5 pr-4 italic text-muted"
        >
          {quotes.map((q, idx) => (
            <p key={idx}>{renderInline(q, `bqi-${key}-${idx}`)}</p>
          ))}
        </blockquote>
      )
      continue
    }

    // Paragraph — consume until blank line or block marker
    const paraLines: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('## ') &&
      !lines[i].startsWith('### ') &&
      !lines[i].startsWith('- ') &&
      !lines[i].startsWith('> ') &&
      !/^\d+\.\s/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push(
      <p key={`p-${key++}`} className="my-5 text-[17px] leading-[1.75] text-fg/80">
        {renderInline(paraLines.join(' '), `pi-${key}`)}
      </p>
    )
  }

  return blocks
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const post = BLOG_POSTS.find((p) => p.slug === slug)

  // 404 fallback — no SEO, no content
  if (!post) {
    return (
      <PublicLayout>
        <SEO
          title="Post not found | SafeApply.AI"
          description="The requested blog post could not be found."
          path="/blog"
          noindex
        />
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">That post isn’t here</h1>
          <p className="mt-4 text-muted">It may have been renamed or removed.</p>
          <ButtonLink to="/blog" className="mt-8">
            All posts
          </ButtonLink>
        </div>
      </PublicLayout>
    )
  }

  // Related posts — same tag, exclude current, take up to 3
  const related = BLOG_POSTS.filter(
    (p) => p.slug !== post.slug && p.tags.some((t) => post.tags.includes(t))
  ).slice(0, 3)

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    url: `${SITE_URL}/blog/${post.slug}`,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}` },
    keywords: post.tags.join(', '),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE_URL}/blog/${post.slug}` },
    ],
  }

  return (
    <PublicLayout>
      <SEO
        title={`${post.title} | ${SITE_NAME}`}
        description={post.excerpt}
        path={`/blog/${post.slug}`}
        type="article"
        publishedTime={post.date}
        modifiedTime={post.date}
        author={post.author}
        tags={post.tags}
        jsonLd={[articleJsonLd, breadcrumbJsonLd]}
      />

      <article className="mx-auto max-w-[44rem] px-4 sm:px-6 pt-12 sm:pt-16 pb-20">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-muted">
          <Link to="/" className="hover:text-fg transition-colors">Home</Link>
          <Icon name="chevron_right" className="text-[14px] mx-1 align-middle" />
          <Link to="/blog" className="hover:text-fg transition-colors">Blog</Link>
        </nav>

        {/* Header */}
        <header className="border-b border-line pb-8">
          <h1 className="text-3xl font-semibold tracking-[-0.025em] leading-[1.12] sm:text-[42px]">
            {post.title}
          </h1>
          <p className="mt-5 text-lg text-muted leading-relaxed">{post.excerpt}</p>
          <div className="mt-6 flex items-center gap-3 text-sm text-muted">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden>·</span>
            <span>{post.readTime} min read</span>
          </div>
        </header>

        {/* Content */}
        <div className="mt-2">{renderContent(post.content)}</div>

        {/* Divider */}
        <div className="my-12 h-px bg-line" />

        {/* CTA */}
        <div className="rounded-[16px] border border-line bg-surface p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Run this check automatically</h2>
            <p className="mt-1.5 text-sm text-muted max-w-[44ch]">Paste a job post and get news, code activity and repeat postings in one report.</p>
          </div>
          <ButtonLink to="/signup" iconRight="arrow_forward" className="shrink-0">
            Start free
          </ButtonLink>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 text-xl font-semibold">Keep reading</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  to={`/blog/${p.slug}`}
                  className="group rounded-[16px] border border-line bg-surface p-5 transition-colors hover:border-accent"
                >
                  <h3 className="text-sm font-semibold leading-snug group-hover:text-accent">
                    {p.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-xs text-muted">{p.excerpt}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Back to blog */}
        <div className="mt-12 text-center">
          <Link
            to="/blog"
            className="text-sm text-muted transition-colors hover:text-fg"
          >
            All posts
          </Link>
        </div>
      </article>
    </PublicLayout>
  )
}