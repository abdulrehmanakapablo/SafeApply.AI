// FILE: src/pages/admin/Budget.tsx
// ROUTE: /admin/budget
// PURPOSE: See this month's AI + search spend (estimated, slightly high on
//          purpose) and set the two limits: free users pause at the first,
//          everything stops at the second.

import { useEffect, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { adminGetBudget, adminSetBudget, type BudgetInfo } from '../../api/billing'
import { Alert, Button, Card, CardHeader, Field, PageContainer, PageHeader, Skeleton, Stat, cn } from '../../components/ui'
import { apiError } from '../../lib/axios'

const usd = (n: number) => `$${Number(n).toFixed(2)}`

export default function AdminBudget() {
  const [b, setB] = useState<BudgetInfo | null>(null)
  const [free, setFree] = useState('')
  const [hard, setHard] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    adminGetBudget()
      .then((r) => {
        setB(r.data)
        setFree(String(r.data.free_usd))
        setHard(String(r.data.hard_usd))
      })
      .catch((e) => toast.error(apiError(e, 'Couldn’t load the budget.')))
  }, [])

  async function save(e: FormEvent) {
    e.preventDefault()
    const f = Number(free)
    const h = Number(hard)
    if (!(f >= 0) || !(h >= 0)) return toast.error('Use numbers of 0 or more.')
    if (h < f) return toast.error('The hard limit must be at least the free-user limit.')
    setBusy(true)
    try {
      const r = await adminSetBudget(f, h)
      setB((cur) => (cur ? { ...cur, ...r.data } : cur))
      toast.success('Budget saved')
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t save the budget.'))
    } finally {
      setBusy(false)
    }
  }

  const pct = b ? Math.min(100, Math.round((b.spent / Math.max(b.hard_usd, 0.01)) * 100)) : 0

  return (
    <>
      <SEO title="Budget | Admin | SafeApply.AI" description="Spending limits." path="/admin/budget" noindex />
      <PageContainer>
        <PageHeader title="Spending budget" description="Estimated cost of AI and web searches this month. While you’re on free tiers the real bill is $0; the estimate still protects you when you upgrade." />
        {b?.hardStopped && <Alert>The hard limit is reached. AI and searches are off for everyone until next month or until you raise it.</Alert>}
        {!b?.hardStopped && b?.freePaused && <Alert tone="warn">Free users’ AI is paused for the rest of the month. Pro users are unaffected.</Alert>}

        <Card>
          {!b ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <Stat label={`Spent in ${b.month}`} value={usd(b.spent)} hint={`${pct}% of the hard limit`} />
                <Stat label="AI" value={usd(b.ai_usd)} hint={`${b.ai_calls.toLocaleString()} calls`} />
                <Stat label="Searches" value={usd(b.search_usd)} hint={`${b.searches.toLocaleString()} searches`} />
                <Stat label="Limits" value={`${usd(b.free_usd)} / ${usd(b.hard_usd)}`} hint="free users / everyone" />
              </div>
              <div className="mt-6 h-2 rounded-full bg-line overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Share of the hard limit used">
                <div className={cn('h-full rounded-full', b.hardStopped ? 'bg-danger' : b.freePaused ? 'bg-warn' : 'bg-accent')} style={{ width: `${pct}%` }} />
              </div>
            </>
          )}
        </Card>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <Card>
            <CardHeader title="Limits" description="Set the free-user limit below your monthly Pro income so free usage is always covered." />
            <form onSubmit={save} noValidate className="flex flex-col gap-4">
              <Field label="Pause free users at (USD)" inputMode="decimal" value={free} onChange={(e) => setFree(e.target.value)} />
              <Field label="Stop everything at (USD)" inputMode="decimal" value={hard} onChange={(e) => setHard(e.target.value)} />
              <Button type="submit" loading={busy} className="self-start">
                Save limits
              </Button>
            </form>
          </Card>
          <Card padded={false}>
            <div className="px-5 h-12 flex items-center border-b border-line text-[15px] font-semibold">Last 12 months</div>
            {!b ? (
              <div className="p-5">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : b.history.length === 0 ? (
              <p className="p-5 text-sm text-muted">No spend recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-line">
                    <th scope="col" className="font-medium px-5 py-2.5">Month</th>
                    <th scope="col" className="font-medium px-3 py-2.5 text-right">AI</th>
                    <th scope="col" className="font-medium px-5 py-2.5 text-right">Search</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular">
                  {b.history.map((h) => (
                    <tr key={h.month}>
                      <td className="px-5 py-2.5">{h.month}</td>
                      <td className="px-3 py-2.5 text-right">{usd(h.ai_usd)}</td>
                      <td className="px-5 py-2.5 text-right">{usd(h.search_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </PageContainer>
    </>
  )
}
