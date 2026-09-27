// FILE: src/pages/public/BlogPost.tsx
// Renders a single blog post by slug with full SEO metadata.
// 404 fallback if slug not found.

import { Link, useParams } from 'react-router-dom'
import SEO, { SITE_URL, SITE_NAME } from '../../components/SEO'
import { BLOG_POSTS } from '../../data/blogPosts'

// ── Markdown-lite renderer ─────────────────────────────────
// Supports: paragraphs, ## H2, ### H3, - bullets, 1. numbered, > quotes
// Inline: **bold**, *italic*, `code`
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Combined regex for bold, italic, code
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  const parts = text.split(regex)
  parts.forEach((part, i) => {
    if (!part) return
    const key = `${keyPrefix}-${i}`
    if (part.startsWith('**') && part.endsWith('**')) {
      nodes.push(<strong key={key} className="text-white font-semibold">{part.slice(2, -2)}</strong>)
    } else if (part.startsWith('*') && part.endsWith('*')) {
      nodes.push(<em key={key}>{part.slice(1, -1)}</em>)
    } else if (part.startsWith('`') && part.endsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-[#1A1A1A] px-1.5 py-0.5 text-[0.9em] text-[#22C55E]">
          {part.slice(1, -1)}
        </code>
      )
    } else {
      nodes.push(part)
    }
  })
  return nodes
}

function renderContent(content: string): React.ReactNode[] {
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []
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
        <h2 key={`h2-${key++}`} className="mt-12 mb-4 text-2xl font-bold tracking-tight text-white">
          {renderInline(line.slice(3), `h2i-${key}`)}
        </h2>
      )
      i++
      continue
    }

    // H3
    if (line.startsWith('### ')) {
      blocks.push(
        <h3 key={`h3-${key++}`} className="mt-8 mb-3 text-lg font-semibold text-white">
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
            <li key={idx} className="list-disc text-[#737373] leading-relaxed">
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
            <li key={idx} className="list-decimal text-[#737373] leading-relaxed">
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
          className="my-6 border-l-2 border-[#22C55E] bg-[#0D0D0D] py-3 pl-5 pr-4 italic text-[#737373]"
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
      <p key={`p-${key++}`} className="my-4 text-base leading-relaxed text-[#737373]">
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
      <div className="min-h-screen bg-black text-white">
        <SEO
          title="Post not found | SafeApply.AI"
          description="The requested blog post could not be found."
          path="/blog"
          noindex
        />
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Post not found</h1>
          <p className="mt-4 text-[#737373]">
            This article does not exist or has been moved.
          </p>
          <Link
            to="/blog"
            className="mt-8 inline-block rounded-lg bg-[#22C55E] px-6 py-3 font-medium text-black transition-colors hover:bg-[#16A34A]"
          >
            Back to blog
          </Link>
        </div>
      </div>
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
    <div className="min-h-screen bg-black text-white">
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

      <article className="mx-auto max-w-3xl px-6 py-16">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-[#737373]">
          <Link to="/" className="hover:text-white transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-white transition-colors">Blog</Link>
        </nav>

        {/* Header */}
        <header className="border-b border-[#1A1A1A] pb-8">
          <div className="mb-4 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-[#1A1A1A] px-2.5 py-0.5 text-xs text-[#737373]"
              >
                {t}
              </span>
            ))}
          </div>
          <h1 className="text-3xl font-bold tracking-tight leading-tight sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg text-[#737373] leading-relaxed">{post.excerpt}</p>
          <div className="mt-6 flex items-center gap-3 text-sm text-[#737373]">
            <span>{post.author}</span>
            <span className="text-white/20">•</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span className="text-white/20">•</span>
            <span>{post.readTime} min read</span>
          </div>
        </header>

        {/* Content */}
        <div className="mt-2">{renderContent(post.content)}</div>

        {/* Divider */}
        <div className="my-12 h-px bg-[#1A1A1A]" />

        {/* CTA */}
        <div className="rounded-[16px] border border-[#22C55E]/30 bg-[#0D0D0D] p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Research before you apply</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-[#737373]">
            Paste one job description and see what a cited company report looks like. Free, no
            credit card.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-block rounded-lg bg-[#22C55E] px-6 py-3 font-medium text-black transition-colors hover:bg-[#16A34A]"
          >
            Get started free
          </Link>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 text-xl font-semibold">Related reading</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  to={`/blog/${p.slug}`}
                  className="group rounded-[16px] border border-[#1A1A1A] bg-[#0D0D0D] p-5 transition-colors hover:border-[#22C55E]"
                >
                  <h3 className="text-sm font-semibold leading-snug group-hover:text-[#22C55E]">
                    {p.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-xs text-[#737373]">{p.excerpt}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Back to blog */}
        <div className="mt-12 text-center">
          <Link
            to="/blog"
            className="text-sm text-[#737373] transition-colors hover:text-white"
          >
            ← Back to all posts
          </Link>
        </div>
      </article>
    </div>
  )
}