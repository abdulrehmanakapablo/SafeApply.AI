// FILE: src/pages/recruiter/Reviews.tsx
// ROUTE: /recruiter/reviews
// PURPOSE: Read reviews of your company and post one public reply each.
//          Companies can reply and edit their reply; they can never remove
//          or hide a review, and never see who wrote it.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import VerificationBanner from '../../components/recruiter/VerificationBanner'
import { useCompany } from './useCompany'
import { Stars } from '../../components/ui/Stars'
import { listCompanyReviews, replyToReview, type CompanyReviewItem } from '../../api/recruiter'
import { RELATIONSHIP_LABEL, type Relationship } from '../../api/reviews'
import { Alert, Button, Card, EmptyState, PageContainer, PageHeader, SkeletonRows, TextArea, formatDate } from '../../components/ui'
import { apiError } from '../../lib/axios'

export default function RecruiterReviews() {
  const { company, loading } = useCompany()
  const [items, setItems] = useState<CompanyReviewItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!company) return
    listCompanyReviews()
      .then((r) => setItems(r.data))
      .catch((e) => setError(apiError(e, 'Couldn’t load reviews.')))
  }, [company])

  const verified = company?.verification_status === 'verified'

  return (
    <>
      <SEO title="Reviews | Recruiter | SafeApply.AI" description="Reviews of your company." path="/recruiter/reviews" noindex />
      <PageContainer narrow>
        <PageHeader title="Reviews" description="Approved reviews of your company. Reply once to each; your reply is shown under the review." />
        {!loading && <VerificationBanner company={company} />}
        {error && <Alert>{error}</Alert>}
        {company &&
          (!items ? (
            <Card>
              <SkeletonRows rows={3} />
            </Card>
          ) : items.length === 0 ? (
            <Card padded={false}>
              <EmptyState icon="reviews" title="No reviews yet" body="Reviews appear here once they pass moderation." />
            </Card>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((r) => (
                <ReviewItem key={r.id} r={r} canReply={verified} onSaved={(body) => setItems((p) => (p ? p.map((x) => (x.id === r.id ? { ...x, reply: { body, updated_at: new Date().toISOString() } } : x)) : p))} />
              ))}
            </ul>
          ))}
      </PageContainer>
    </>
  )
}

function ReviewItem({ r, canReply, onSaved }: { r: CompanyReviewItem; canReply: boolean; onSaved: (body: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(r.reply?.body || '')
  const [busy, setBusy] = useState(false)

  async function save() {
    const body = draft.trim()
    if (body.length < 20) return toast.error('Replies need at least 20 characters.')
    setBusy(true)
    try {
      await replyToReview(r.id, body)
      onSaved(body)
      setEditing(false)
      toast.success('Reply published')
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t publish the reply.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="bg-surface border border-line rounded-[var(--radius-card)] p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{r.role_type}</p>
          <p className="text-xs text-muted">
            {RELATIONSHIP_LABEL[r.relationship as Relationship] || r.relationship} · {formatDate(r.created_at)}
          </p>
        </div>
        <Stars rating={r.overall_rating} />
      </div>
      <p className="text-sm text-muted leading-relaxed whitespace-pre-line break-words">{r.review_text}</p>

      {r.reply && !editing ? (
        <div className="mt-1 border-l-2 border-accent/50 pl-4">
          <p className="text-xs text-accent font-medium">Your reply</p>
          <p className="text-sm leading-relaxed whitespace-pre-line break-words mt-1">{r.reply.body}</p>
          {canReply && (
            <button type="button" onClick={() => setEditing(true)} className="mt-2 text-xs text-muted hover:text-fg underline underline-offset-4">
              Edit reply
            </button>
          )}
        </div>
      ) : canReply && editing ? (
        <div className="flex flex-col gap-2">
          <TextArea aria-label="Your reply" rows={4} value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 1500))} hint={`${draft.length} / 1,500. Be specific and calm; readers judge the reply as much as the review.`} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} loading={busy}>
              Publish reply
            </Button>
          </div>
        </div>
      ) : canReply ? (
        <Button size="sm" variant="secondary" icon="reply" onClick={() => setEditing(true)} className="self-start">
          Reply
        </Button>
      ) : null}
    </li>
  )
}
