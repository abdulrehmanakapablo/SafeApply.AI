// ============================================================
// FILE: apps/backend/src/services/glassdoor.service.ts
// PURPOSE: Glassdoor company data fetch (STUB)
// The official Glassdoor API is pending approval — this returns
// null gracefully so the report pipeline continues without it.
// ============================================================

export interface GlassdoorData {
  overallRating: number | null
  cultureRating: number | null
  interviewRating: number | null
  reviewCount: number | null
  pros: string[]
  cons: string[]
}

/**
 * Fetch Glassdoor data for a company.
 *
 * Currently a stub — returns null until the official Glassdoor API
 * application is approved. When that happens, replace the body with
 * the real fetch and keep the same return shape so reportQueue.ts
 * needs no changes.
 */
export async function fetchGlassdoorData(
  _companyName: string,
): Promise<GlassdoorData | null> {
  // TODO: Replace with real Glassdoor API call once approved
  return null
}