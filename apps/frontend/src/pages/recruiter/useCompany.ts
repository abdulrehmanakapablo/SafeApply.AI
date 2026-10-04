// FILE: src/pages/recruiter/useCompany.ts
// PURPOSE: Load the recruiter's company once per page.

import { useCallback, useEffect, useState } from 'react'
import { getMyCompany, type Company } from '../../api/recruiter'
import { apiError } from '../../lib/axios'

export function useCompany() {
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getMyCompany()
      setCompany(res.data)
    } catch (e) {
      setError(apiError(e, 'Couldn’t load your company.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { company, setCompany, loading, error, reload }
}
