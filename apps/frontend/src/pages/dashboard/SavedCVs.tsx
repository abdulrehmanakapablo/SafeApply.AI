// FILE: src/pages/dashboard/SavedCVs.tsx
// ROUTE: /dashboard/cv-builder/saved
// BACKEND: GET /api/cv/saved, DELETE /api/cv/saved/:id

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import SEO from '../../components/SEO'
import { normalizeCVData } from '../../components/cv/CVEditor'
import { deleteSavedCV, getSavedCVs, type SavedCV } from '../../api/cv'
import { Alert, Badge, ButtonLink, Card, ConfirmDialog, EmptyState, Icon, PageContainer, PageHeader, Skeleton, formatDate, relativeDays } from '../../components/ui'
import { apiError } from '../../lib/axios'

function completeness(item: SavedCV): number {
  const d = normalizeCVData(item.cv_data)
  let n = 0
  if (d.personal.full_name && d.personal.email) n += 20
  if (d.personal.summary.length >= 100) n += 15
  if (d.experience.length) n += 25
  if (d.education.length) n += 15
  if (d.skills.length >= 5) n += 15
  if (d.personal.linkedin || d.personal.github) n += 5
  if (d.projects.length || d.certifications.length) n += 5
  return Math.min(100, n)
}

export default function SavedCVs() {
  const reduce = useReducedMotion()
  const [items, setItems] = useState<SavedCV[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<SavedCV | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getSavedCVs()
      if (res.success && Array.isArray(res.data)) setItems([...res.data].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)))
      else setError(res.error || 'Couldn’t load your saved CVs.')
    } catch (e) {
      setError(apiError(e, 'Couldn’t load your saved CVs.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => {
      const d = normalizeCVData(i.cv_data)
      return [i.name, d.personal.full_name, d.personal.job_title].some((x) => x.toLowerCase().includes(q))
    })
  }, [items, query])

  async function confirmDelete() {
    if (!pending) return
    setDeleting(true)
    try {
      await deleteSavedCV(pending.id)
      setItems((p) => p.filter((x) => x.id !== pending.id))
      toast.success('CV deleted')
      setPending(null)
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t delete the CV.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <SEO title="Saved CVs | SafeApply.AI" description="Your saved CVs." path="/dashboard/cv-builder/saved" noindex />
      <PageContainer>
        <PageHeader
          title="Saved CVs"
          description={loading ? ' ' : items.length ? `${items.length} saved. Open one to edit or export it.` : 'Versions you save from the CV builder appear here.'}
          back={{ to: '/dashboard/cv-builder', label: 'CV builder' }}
          actions={
            <ButtonLink to="/dashboard/cv-builder" icon="add">
              New CV
            </ButtonLink>
          }
        />

        {error && (
          <Alert title="Something went wrong">
            {error}{' '}
            <button type="button" onClick={load} className="underline underline-offset-2">
              Try again
            </button>
          </Alert>
        )}

        {items.length > 3 && (
          <div className="relative max-w-sm">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or title"
              aria-label="Search saved CVs"
              className="w-full h-10 pl-9 pr-3 rounded-[var(--radius-input)] bg-surface border border-line text-sm placeholder:text-muted/80 focus:outline-none focus:border-accent"
            />
          </div>
        )}

        {loading ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="flex flex-col gap-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-1.5 w-full mt-4" />
                <Skeleton className="h-9 w-full mt-2" />
              </Card>
            ))}
          </div>
        ) : items.length === 0 && !error ? (
          <Card padded={false}>
            <EmptyState
              icon="folder_open"
              title="No saved CVs"
              body="Fill in the required fields in the CV builder and press Save CV. Each save is kept as a separate version."
              action={<ButtonLink to="/dashboard/cv-builder">Open the CV builder</ButtonLink>}
            />
          </Card>
        ) : shown.length === 0 && query ? (
          <Card padded={false}>
            <EmptyState icon="search_off" title={`Nothing matches “${query}”`} body="Try a name or job title." />
          </Card>
        ) : (
          <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence initial={false}>
              {shown.map((item) => {
                const d = normalizeCVData(item.cv_data)
                const score = completeness(item)
                return (
                  <motion.li
                    key={item.id}
                    layout={!reduce}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                    className="bg-surface border border-line rounded-[var(--radius-card)] p-5 flex flex-col gap-4 hover:border-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{d.personal.full_name || item.name}</p>
                        <p className="text-sm text-muted truncate">{d.personal.job_title || 'No title'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPending(item)}
                        aria-label={`Delete ${item.name}`}
                        className="w-8 h-8 -mr-2 -mt-1 rounded-[8px] flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                      >
                        <Icon name="delete" className="text-[18px]" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge>
                        {d.experience.length} job{d.experience.length === 1 ? '' : 's'}
                      </Badge>
                      <Badge>{d.education.length} education</Badge>
                      <Badge>
                        {d.skills.length} skill{d.skills.length === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted">Completeness</span>
                        <span className="tabular">{score}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-line overflow-hidden">
                        <div className={score >= 80 ? 'h-full bg-accent' : score >= 50 ? 'h-full bg-warn' : 'h-full bg-danger'} style={{ width: `${score}%` }} />
                      </div>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                      <time dateTime={item.updated_at} title={formatDate(item.updated_at)} className="text-xs text-muted">
                        {relativeDays(item.updated_at)}
                      </time>
                      <ButtonLink to={`/dashboard/cv-builder?load=${encodeURIComponent(item.id)}`} size="sm" variant="secondary" iconRight="arrow_forward">
                        Open
                      </ButtonLink>
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}

        <ConfirmDialog
          open={Boolean(pending)}
          onClose={() => !deleting && setPending(null)}
          onConfirm={confirmDelete}
          loading={deleting}
          title="Delete this CV?"
          body={pending ? `“${pending.name}” is removed for good.` : undefined}
        />
      </PageContainer>
    </>
  )
}
