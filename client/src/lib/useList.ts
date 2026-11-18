import { useEffect, useRef, useState } from 'react'
import { errorMessage, getRequest } from './http'
import type { Page } from '../types'

// Loads a paged list (server/src/lib/pagination.ts): the first page on mount
// and whenever `url` changes, more with loadMore(), and the first page again
// with refresh(). The panels that use it are remounted per workspace
// (key={workspaceId}), so a list never mixes rows from two workspaces.
//   loading:     true until the first page arrives (show a skeleton)
//   refreshing:  true while refresh() runs (the old rows stay on screen)
//   loadingMore: true while loadMore() runs
//   total:       how many rows the server has. setTotal lets a panel adjust it
//                after its own upload or delete.
export function usePagedList<T extends { id: string }>(url: string) {
  const [rows, setRows] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The url the rows on screen belong to. A page that arrives after the url
  // changed (e.g. "Failed only" toggled mid-request) is dropped.
  const currentUrl = useRef(url)

  function showFirstPage(page: Page<T>) {
    setRows(page.items)
    setTotal(page.total ?? page.items.length)
    setNextCursor(page.nextCursor)
    setError(null)
  }

  useEffect(() => {
    currentUrl.current = url
    // A new url is a different list (e.g. "Failed only"): don't show the old rows under the skeleton.
    setRows([])
    setNextCursor(null)
    setLoading(true)
    getRequest<Page<T>>(url)
      .then((page) => {
        if (currentUrl.current === url) showFirstPage(page)
      })
      .catch((e) => {
        if (currentUrl.current === url) setError(errorMessage(e))
      })
      .finally(() => {
        if (currentUrl.current === url) setLoading(false)
      })
  }, [url])

  async function refresh() {
    setRefreshing(true)
    try {
      const page = await getRequest<Page<T>>(url)
      if (currentUrl.current === url) showFirstPage(page)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setRefreshing(false)
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await getRequest<Page<T>>(withParam(url, 'cursor', nextCursor))
      if (currentUrl.current !== url) return
      // Skip rows already shown: a panel may have moved one to the top itself
      // (e.g. re-uploading an older document), and the server sends it again here.
      setRows((list) => [...list, ...page.items.filter((row) => !list.some((r) => r.id === row.id))])
      setNextCursor(page.nextCursor)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }

  return {
    rows,
    setRows,
    total,
    setTotal,
    hasMore: nextCursor !== null,
    loading,
    refreshing,
    loadingMore,
    error,
    refresh,
    loadMore,
  }
}

function withParam(url: string, name: string, value: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${name}=${encodeURIComponent(value)}`
}
