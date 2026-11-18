import { useEffect, useState } from 'react'
import { errorMessage, getRequest } from './http'

// Loads a list from the API once on mount, and again when refresh() is called.
// The panels that use it are remounted per workspace (key={workspaceId}), so a
// list never mixes rows from two workspaces.
//   loading:    true until the first load finishes (show a skeleton)
//   refreshing: true while refresh() runs (the old rows stay on screen)
export function useList<T>(url: string) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRequest<T[]>(url)
      .then(setRows)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [url])

  async function refresh() {
    setRefreshing(true)
    try {
      setRows(await getRequest<T[]>(url))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setRefreshing(false)
    }
  }

  return { rows, loading, refreshing, error, refresh }
}
