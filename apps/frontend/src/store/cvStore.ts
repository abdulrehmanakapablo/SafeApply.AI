// FILE: src/store/cvStore.ts
// PURPOSE: Persistent CV state shared between CVMatch and CVBuilder.
// Everything here survives page navigation, page reloads, and even
// closing the tab — until the user clicks Clear All or the store is
// manually reset.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CVData, CVMatchResult } from '../api/cv'

// ─── Empty CV shape ───────────────────────────────────────
export const DEFAULT_CV: CVData = {
  personal: {
    full_name: '',
    job_title: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    summary: '',
  },
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
}

export function isDefaultCV(cv: CVData): boolean {
  return (
    !cv.personal.full_name &&
    !cv.personal.email &&
    !cv.personal.summary &&
    cv.experience.length === 0 &&
    cv.education.length === 0 &&
    cv.skills.length === 0 &&
    cv.projects.length === 0 &&
    cv.certifications.length === 0
  )
}

export type CVTab = 'analysis' | 'build'

type CVUpdater = CVData | ((prev: CVData) => CVData)

interface CVStore {
  // ── CVMatch raw inputs ────────────────────────────────
  cvText: string
  jdText: string
  uploadedFileName: string

  // ── CVMatch analysis ──────────────────────────────────
  matchResult: CVMatchResult | null
  acceptedIndices: number[]
  skippedIndices: number[]
  activeCvTab: CVTab

  // ── CV data — one slot per editor variant ─────────────
  builderCV: CVData
  matchCV: CVData
  hasBuilt: boolean

  // ── Actions: inputs ───────────────────────────────────
  setCvText: (text: string) => void
  setJdText: (text: string) => void
  setUploadedFileName: (name: string) => void

  // ── Actions: analysis ─────────────────────────────────
  setMatchResult: (result: CVMatchResult | null) => void
  acceptRewrite: (idx: number) => void
  skipRewrite: (idx: number) => void
  setActiveCvTab: (tab: CVTab) => void

  // ── Actions: CV data ──────────────────────────────────
  setBuilderCV: (updater: CVUpdater) => void
  setMatchCV: (updater: CVUpdater) => void
  setHasBuilt: (v: boolean) => void

  // ── Bulk reset ────────────────────────────────────────
  /** Wipe only CVMatch analysis + built CV. Keeps raw inputs. */
  resetAnalysis: () => void
  /** Wipe absolutely everything. Used by "Clear All". */
  resetAll: () => void
}

export const useCVStore = create<CVStore>()(
  persist(
    (set) => ({
      cvText: '',
      jdText: '',
      uploadedFileName: '',
      matchResult: null,
      acceptedIndices: [],
      skippedIndices: [],
      activeCvTab: 'analysis',
      builderCV: DEFAULT_CV,
      matchCV: DEFAULT_CV,
      hasBuilt: false,

      setCvText: (text) => set({ cvText: text }),
      setJdText: (text) => set({ jdText: text }),
      setUploadedFileName: (name) => set({ uploadedFileName: name }),

      setMatchResult: (result) =>
        set({
          matchResult: result,
          acceptedIndices: [],
          skippedIndices: [],
          matchCV: DEFAULT_CV,
          hasBuilt: false,
          activeCvTab: 'analysis',
        }),

      acceptRewrite: (idx) =>
        set((s) => ({
          acceptedIndices: s.acceptedIndices.includes(idx)
            ? s.acceptedIndices
            : [...s.acceptedIndices, idx],
          skippedIndices: s.skippedIndices.filter((i) => i !== idx),
        })),

      skipRewrite: (idx) =>
        set((s) => ({
          skippedIndices: s.skippedIndices.includes(idx)
            ? s.skippedIndices
            : [...s.skippedIndices, idx],
          acceptedIndices: s.acceptedIndices.filter((i) => i !== idx),
        })),

      setActiveCvTab: (tab) => set({ activeCvTab: tab }),

      setBuilderCV: (updater) =>
        set((s) => ({
          builderCV:
            typeof updater === 'function' ? updater(s.builderCV) : updater,
        })),

      setMatchCV: (updater) =>
        set((s) => ({
          matchCV:
            typeof updater === 'function' ? updater(s.matchCV) : updater,
        })),

      setHasBuilt: (v) => set({ hasBuilt: v }),

      resetAnalysis: () =>
        set({
          matchResult: null,
          acceptedIndices: [],
          skippedIndices: [],
          matchCV: DEFAULT_CV,
          hasBuilt: false,
          activeCvTab: 'analysis',
        }),

      resetAll: () =>
        set({
          cvText: '',
          jdText: '',
          uploadedFileName: '',
          matchResult: null,
          acceptedIndices: [],
          skippedIndices: [],
          activeCvTab: 'analysis',
          builderCV: DEFAULT_CV,
          matchCV: DEFAULT_CV,
          hasBuilt: false,
        }),
    }),
    {
      name: 'safeapply-cv-store',
    },
  ),
)