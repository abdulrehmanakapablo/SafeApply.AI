// FILE: src/pages/public/Blog.tsx
// ROUTE: /blog

import { Link } from 'react-router-dom'
import SEO, { SITE_URL } from '../../components/SEO'
import PublicLayout from '../../components/layout/PublicLayout'
import { Reveal } from '../../components/motion/Reveal'
import { Icon, formatDate } from '../../components/ui'
import { BLOG_POSTS } from '../../data/blogPosts'

export default function Blog() {
  const posts = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date))
  const [featured, ...rest] = posts

  return (
    <PublicLayout>
      <SEO
        title="Blog | SafeApply.AI"
        description="Practical guides on researching employers, writing CVs that screening software can read, spotting reposted jobs and tracking a search."
        path="/blog"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'SafeApply.AI Blog',
          url: `${SITE_URL}/blog`,
          blogPost: posts.map((p) => ({
            '@type': 'BlogPosting',
            headline: p.title,
            url: `${SITE_URL}/blog/${p.slug}`,
            datePublished: p.date,
            author: { '@type': 'Organization', name: p.author },
          })),
        }}
      />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-12">
        <Reveal>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.05]">Notes on job hunting</h1>
          <p className="mt-4 text-lg text-muted max-w-[52ch] leading-relaxed">
            How to research an employer, write for the screening software, and keep a search organised.
          </p>
        </Reveal>
      </section>

      {featured && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <Link
              to={`/blog/${featured.slug}`}
              className="group block rounded-[var(--radius-card)] border border-line bg-[radial-gradient(120%_140%_at_100%_0%,color-mix(in_srgb,var(--c-accent)_10%,transparent),transparent_55%),var(--c-surface)] p-6 sm:p-10 hover:border-muted/40 transition-colors"
            >
              <p className="text-sm text-muted">
                Latest · {formatDate(featured.date)} · {featured.readTime} min
              </p>
              <h2 className="mt-3 text-2xl sm:text-[34px] font-semibold tracking-tight leading-tight max-w-[28ch] group-hover:text-accent transition-colors">
                {featured.title}
              </h2>
              <p className="mt-4 text-muted leading-relaxed max-w-[64ch]">{featured.excerpt}</p>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-fg">
                Read it
                <Icon name="arrow_forward" className="text-[18px] transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </Reveal>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <ul className="divide-y divide-line border-y border-line">
          {rest.map((p, i) => (
            <Reveal as="li" key={p.slug} delay={i * 0.03}>
              <Link to={`/blog/${p.slug}`} className="group grid sm:grid-cols-[9rem_1fr_auto] gap-2 sm:gap-8 py-7 items-baseline">
                <time dateTime={p.date} className="text-sm text-muted tabular">
                  {formatDate(p.date)}
                </time>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold tracking-tight group-hover:text-accent transition-colors">{p.title}</h2>
                  <p className="mt-1.5 text-sm text-muted leading-relaxed line-clamp-2 max-w-[70ch]">{p.excerpt}</p>
                </div>
                <span className="hidden sm:inline text-sm text-muted tabular">{p.readTime} min</span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </section>
    </PublicLayout>
  )
}
