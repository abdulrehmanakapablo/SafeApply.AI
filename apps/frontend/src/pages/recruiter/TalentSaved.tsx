// FILE: src/pages/recruiter/TalentSaved.tsx
// ROUTE: /recruiter/talent/saved
// PURPOSE: The team's talent folders. People who later hide their profile
//          drop out of every folder automatically.

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import TalentCard from '../../components/recruiter/TalentCard'
import { createFolder, deleteFolder, getFolder, listFolders, removeFromFolder, type Folder, type FolderDetail } from '../../api/teams'
import { apiError } from '../../lib/axios'
import { Alert, Button, ButtonLink, Card, ConfirmDialog, EmptyState, Icon, PageContainer, PageHeader, Skeleton, SkeletonRows, cn } from '../../components/ui'

export default function TalentSaved() {
  const [params, setParams] = useSearchParams()
  const [folders, setFolders] = useState<Folder[] | null>(null)
  const [detail, setDetail] = useState<FolderDetail | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const active = params.get('folder') || folders?.[0]?.id || ''

  const loadFolders = useCallback(async () => {
    try {
      setFolders((await listFolders()).data)
    } catch (e) {
      setError(apiError(e, 'Couldn’t load folders.'))
      setFolders([])
    }
  }, [])
  useEffect(() => {
    void loadFolders()
  }, [loadFolders])

  useEffect(() => {
    if (!active) return setDetail(null)
    let cancelled = false
    setDetail(null)
    getFolder(active)
      .then((r) => !cancelled && setDetail(r.data))
      .catch((e) => !cancelled && toast.error(apiError(e, 'Couldn’t load the folder.')))
    return () => {
      cancelled = true
    }
  }, [active])

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      const f = (await createFolder(name.trim())).data
      setName('')
      await loadFolders()
      setParams({ folder: f.id }, { replace: true })
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t create the folder.'))
    } finally {
      setBusy(false)
    }
  }

  async function removeFolder() {
    if (!detail) return
    setBusy(true)
    try {
      await deleteFolder(detail.id)
      setConfirmDelete(false)
      setParams({}, { replace: true })
      await loadFolders()
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t delete the folder.'))
    } finally {
      setBusy(false)
    }
  }

  async function unsave(talentId: string) {
    if (!detail) return
    try {
      await removeFromFolder(detail.id, talentId)
      setDetail({ ...detail, items: detail.items.filter((i) => i.id !== talentId) })
      setFolders((fs) => fs?.map((f) => (f.id === detail.id ? { ...f, count: Math.max(0, f.count - 1) } : f)) || fs)
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t remove.'))
    }
  }

  return (
    <>
      <SEO title="Saved talent | Recruiter | SafeApply.AI" description="Saved talent folders." path="/recruiter/talent/saved" noindex />
      <PageContainer>
        <PageHeader back={{ to: '/recruiter/talent', label: 'Find talent' }} title="Saved talent" description="Folders are shared with your whole hiring team." />
        {error && <Alert>{error}</Alert>}
        <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
          <Card padded={false} as="aside">
            {!folders ? (
              <div className="p-4">
                <SkeletonRows rows={3} />
              </div>
            ) : (
              <nav aria-label="Folders" className="p-2">
                {folders.length === 0 && <p className="px-3 py-2 text-sm text-muted">No folders yet.</p>}
                {folders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setParams({ folder: f.id }, { replace: true })}
                    aria-current={f.id === active ? 'page' : undefined}
                    className={cn('w-full flex items-center gap-2 px-3 h-9 rounded-[8px] text-sm text-left transition-colors', f.id === active ? 'bg-line text-fg' : 'text-muted hover:text-fg hover:bg-line/50')}
                  >
                    <Icon name="folder" className="text-[18px]" />
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-xs tabular">{f.count}</span>
                  </button>
                ))}
                <form onSubmit={create} className="mt-2 pt-2 border-t border-line flex gap-1.5 px-1">
                  <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder="New folder" aria-label="New folder name" className="flex-1 min-w-0 h-8 px-2.5 rounded-[var(--radius-input)] bg-ink border border-line text-sm focus:outline-none focus:border-accent" />
                  <Button type="submit" size="sm" variant="ghost" loading={busy} disabled={!name.trim()} aria-label="Create folder" icon="add" />
                </form>
              </nav>
            )}
          </Card>

          <section className="min-w-0 flex flex-col gap-4">
            {folders && folders.length === 0 ? (
              <Card padded={false}>
                <EmptyState icon="bookmarks" title="Nothing saved yet" body="Save people from talent search into folders, like “Backend shortlist”." action={<ButtonLink to="/recruiter/talent">Find talent</ButtonLink>} />
              </Card>
            ) : !detail ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Skeleton className="h-36 rounded-[16px]" />
                <Skeleton className="h-36 rounded-[16px]" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold truncate">{detail.name}</h2>
                  <Button size="sm" variant="ghost" icon="delete" onClick={() => setConfirmDelete(true)}>
                    Delete folder
                  </Button>
                </div>
                {detail.hidden_count > 0 && <p className="text-xs text-muted">{detail.hidden_count} saved {detail.hidden_count === 1 ? 'person has' : 'people have'} since hidden their profile.</p>}
                {detail.items.length === 0 ? (
                  <Card padded={false}>
                    <EmptyState icon="folder_open" title="This folder is empty" body="Open a profile in talent search and save it here." />
                  </Card>
                ) : (
                  <ul className="grid gap-3 md:grid-cols-2">
                    {detail.items.map((t) => (
                      <li key={t.id} className="relative">
                        <TalentCard t={t} extra={t.note ? <p className="mt-3 text-xs text-muted border-t border-line pt-3 break-words">{t.note}</p> : undefined} />
                        <button
                          type="button"
                          onClick={() => unsave(t.id)}
                          aria-label={`Remove ${t.full_name} from ${detail.name}`}
                          className="absolute bottom-4 right-4 w-8 h-8 grid place-items-center rounded-[8px] text-muted hover:text-danger hover:bg-line/60"
                        >
                          <Icon name="bookmark_remove" className="text-[18px]" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      </PageContainer>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={removeFolder}
        title={`Delete “${detail?.name}”?`}
        body="People stay findable in search. Only this folder goes."
        confirmLabel="Delete"
        loading={busy}
      />
    </>
  )
}
