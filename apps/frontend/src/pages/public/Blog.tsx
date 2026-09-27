// FILE: src/pages/public/Blog.tsx
// ROUTE: /blog (public)

import { Link } from 'react-router-dom';
import SEO, { SITE_URL } from '../../components/SEO';
import Logo from '../../components/ui/Logo';
import { BLOG_POSTS } from '../../data/blogPosts';

const BLOG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: 'SafeApply.AI Blog',
  url: `${SITE_URL}/blog`,
  description:
    'Actionable guides on company research, ATS resume optimization, ghost job detection, and job search analytics.',
  blogPost: BLOG_POSTS.map((p) => ({
    '@type': 'BlogPosting',
    headline: p.title,
    url: `${SITE_URL}/blog/${p.slug}`,
    datePublished: p.date,
    author: { '@type': 'Organization', name: p.author },
  })),
};

export default function Blog() {
  const [featured, ...posts] = BLOG_POSTS;

  return (
    <div className="min-h-screen bg-black text-white">
      <SEO
        title="SafeApply.AI Blog — Company Research & Job Search Guides"
        description="Actionable guides on researching companies before applying, beating ATS parsers, spotting ghost job postings, and running a job search with data instead of guesswork."
        path="/blog"
        jsonLd={BLOG_JSONLD}
      />

      {/* Header — logo left, back to website right */}
      <header className="w-full max-w-[80rem] mx-auto px-6 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Logo className="h-8 w-auto" />
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1 text-[#737373] hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to website
        </Link>
      </header>

      {/* Header */}
      <section className="border-b border-[#1A1A1A]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-[#22C55E]">Blog</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Job search intelligence</h1>
          <p className="mt-4 max-w-2xl text-lg text-[#737373]">
            Guides on company due diligence, ATS resume optimization, ghost job detection,
            and running a search with evidence instead of hope. No fluff, no listicles — methods.
          </p>
        </div>
      </section>

      {/* Featured post */}
      <section className="border-b border-[#1A1A1A]">
        <Link
          to={`/blog/${featured.slug}`}
          className="mx-auto block max-w-5xl px-6 py-10 transition-colors hover:bg-[#0D0D0D]"
        >
          <article>
            <p className="text-xs font-medium uppercase tracking-widest text-[#22C55E]">
              Featured — {featured.readTime} min read
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold leading-tight">{featured.title}</h2>
            <p className="mt-3 max-w-2xl text-[#737373]">{featured.excerpt}</p>
            <p className="mt-4 text-sm text-[#737373]">
              {new Date(featured.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </article>
        </Link>
      </section>

      {/* Post grid */}
      <section>
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link
                key={p.slug}
                to={`/blog/${p.slug}`}
                className="group rounded-[16px] border border-[#1A1A1A] bg-[#0D0D0D] p-6 transition-colors hover:border-[#22C55E]"
              >
                <article>
                  <div className="flex flex-wrap gap-2">
                    {p.tags.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-[#1A1A1A] px-2.5 py-0.5 text-xs text-[#737373]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <h2 className="mt-4 text-lg font-semibold leading-snug group-hover:text-[#22C55E]">
                    {p.title}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm text-[#737373]">{p.excerpt}</p>
                  <p className="mt-4 text-xs text-[#737373]">
                    {new Date(p.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    · {p.readTime} min read
                  </p>
                </article>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}