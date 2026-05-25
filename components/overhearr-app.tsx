'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'

import type { PublicUser } from '@/types/auth'
import type { BulkArtistResult, RequestResult, SearchKind, SearchResult } from '@/types/lidarr'

type SearchResponse = {
  results: SearchResult[]
}

type RequestResponse = RequestResult

type BulkResponse = {
  results: BulkArtistResult[]
}

type SettingsResponse = {
  app: {
    url: {
      origin: string
      host: string
      protocol: string
    }
  }
  plex: {
    url: {
      origin: string
      host: string
      protocol: string
    }
    clientIdentifier: string
  }
  musicService: {
    url: {
      origin: string
      host: string
      protocol: string
    }
  }
}

const filters: { label: string; value: SearchKind }[] = [
  { label: 'All', value: 'all' },
  { label: 'Artists', value: 'artist' },
  { label: 'Albums', value: 'album' }
]

function badgeLabel(result: SearchResult) {
  if (result.status === 'available') return 'Available'
  if (result.status === 'partial') return 'Partial'
  if (result.status === 'requested') return 'Requested'
  if (result.type === 'artist') return 'Request all albums'
  return 'Request'
}

function canRequest(result: SearchResult) {
  return result.status === 'requestable'
}

function statusBadgeClass(status: SearchResult['status']) {
  if (status === 'available') return 'bg-green-400 text-green-950'
  if (status === 'partial') return 'bg-amber-400 text-amber-950'
  if (status === 'requested') return 'bg-violet-400 text-violet-950'

  return 'bg-slate-700 text-slate-200'
}

function statusIcon(status: SearchResult['status']) {
  if (status === 'available') return '✓'
  if (status === 'partial') return '◐'
  if (status === 'requested') return '…'

  return '−'
}

function typeLabel(result: SearchResult) {
  if (result.type === 'artist') return 'Artist'
  return 'Album'
}

function resultKey(result: SearchResult) {
  return `${result.type}-${result.id}`
}

type ActiveTab = 'search' | 'requests' | 'bulk' | 'settings'

function withFromParam(href: string, fromHref: string) {
  const [pathname, search = ''] = href.split('?')
  const params = new URLSearchParams(search)

  params.set('from', fromHref)

  return `${pathname}?${params.toString()}`
}

function artistAlbumsHref(result: SearchResult, fromHref: string) {
  const artistId = result.artist?.id ?? result.artist?.foreignArtistId

  if (!artistId) {
    return undefined
  }

  return withFromParam(
    `/artists/${encodeURIComponent(String(artistId))}/albums?name=${encodeURIComponent(result.artist?.name ?? result.title)}`,
    fromHref
  )
}

function albumDetailsHref(result: SearchResult, fromHref: string) {
  if (result.type !== 'album') {
    return undefined
  }

  const params = new URLSearchParams()

  params.set('title', result.title)

  if (result.artist?.name || result.subtitle) {
    params.set('artist', result.artist?.name ?? result.subtitle ?? '')
  }

  return withFromParam(`/albums/${encodeURIComponent(result.id)}?${params.toString()}`, fromHref)
}

async function fetchSearchResults(query: string, filter: SearchKind) {
  const response = await fetch(`/api/search?query=${encodeURIComponent(query)}&type=${filter}`)

  if (!response.ok) {
    throw new Error('Search failed. Check the music service connection.')
  }

  const data = (await response.json()) as SearchResponse

  return data.results
}

async function createRequest(result: SearchResult) {
  const response = await fetch('/api/requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: result.type === 'album' ? 'album' : 'artist',
      payload: result.payload
    })
  })

  if (!response.ok) {
    throw new Error('Request failed. Check the music service connection.')
  }

  return (await response.json()) as RequestResponse
}

async function addBulkArtistRequests(artists: string[]) {
  const response = await fetch('/api/bulk-artists', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ artists })
  })

  if (!response.ok) {
    throw new Error('Bulk add failed. Check the music service connection.')
  }

  return (await response.json()) as BulkResponse
}

async function fetchSettings() {
  const response = await fetch('/api/settings')

  if (!response.ok) {
    throw new Error('Could not load settings.')
  }

  return (await response.json()) as SettingsResponse
}

type OverhearrAppProps = {
  initialFilter: SearchKind
  initialQuery: string
  initialTab: ActiveTab
  user: PublicUser
}

export function OverhearrApp({ initialFilter, initialQuery, initialTab, user }: OverhearrAppProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState<SearchKind>(initialFilter)
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab)
  const [notice, setNotice] = useState<string | null>(null)
  const [bulkText, setBulkText] = useState('')
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [selectedResultKey, setSelectedResultKey] = useState<string | null>(null)
  const searchQuery = useQuery({
    queryKey: ['search', query.trim(), filter],
    queryFn: () => fetchSearchResults(query.trim(), filter),
    staleTime: 30_000
  })
  const requestMutation = useMutation({
    mutationFn: createRequest,
    onSuccess: async data => {
      setNotice(data.message)
      setSelectedResultKey(null)
      await queryClient.invalidateQueries({ queryKey: ['search'] })
    },
    onError: error => {
      setNotice(error instanceof Error ? error.message : 'Request failed.')
    }
  })
  const bulkMutation = useMutation({
    mutationFn: addBulkArtistRequests,
    onSuccess: async data => {
      setNotice(null)
      await queryClient.invalidateQueries({ queryKey: ['search'] })
      return data
    },
    onError: error => {
      setNotice(error instanceof Error ? error.message : 'Bulk add failed.')
    }
  })
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    enabled: activeTab === 'settings'
  })
  const results = searchQuery.data ?? []
  const bulkResults = bulkMutation.data?.results ?? []
  const currentHomeHref = useMemo(() => {
    const params = new URLSearchParams()

    if (query.trim()) {
      params.set('q', query.trim())
    }

    if (filter !== 'all') {
      params.set('type', filter)
    }

    if (activeTab !== 'search') {
      params.set('tab', activeTab)
    }

    const search = params.toString()

    return search ? `/?${search}` : '/'
  }, [activeTab, filter, query])

  const artistCount = useMemo(() => {
    return bulkText
      .split(/\n|,/)
      .map(value => value.trim())
      .filter(Boolean).length
  }, [bulkText])

  useEffect(() => {
    router.replace(currentHomeHref, { scroll: false })
  }, [currentHomeHref, router])

  async function search(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setNotice(null)
    await searchQuery.refetch()
  }

  async function requestResult(result: SearchResult) {
    setNotice(null)
    requestMutation.mutate(result)
  }

  function toggleResultActions(result: SearchResult) {
    const key = resultKey(result)

    setSelectedResultKey(selectedKey => (selectedKey === key ? null : key))
  }

  async function addBulkArtists() {
    const artists = bulkText
      .split(/\n|,/)
      .map(value => value.trim())
      .filter(Boolean)

    if (!artists.length) return

    setNotice(null)
    bulkMutation.mutate(artists)
  }

  return (
    <main className="min-h-screen bg-[#0f131d] text-slate-100">
      <div className="min-h-screen md:grid md:grid-cols-[15.25rem_minmax(0,1fr)]">
        <aside className="border-b border-slate-700/60 bg-[#171c28] md:min-h-screen md:border-b-0 md:border-r">
          <div className="flex h-20 items-center gap-3 px-4 md:h-24 md:px-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-400 via-indigo-500 to-violet-700 shadow-lg shadow-violet-950/40">
              <div className="h-6 w-6 rounded-full border-[6px] border-[#111827] border-t-white/90" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-semibold tracking-tight">overhearr</h1>
              <p className="text-xs font-medium text-slate-400">Music for Plex</p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto px-3 pb-4 md:mt-8 md:grid md:grid-cols-1 md:px-4 md:pb-0">
            <button
              className={`flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition md:w-full ${
                activeTab === 'search'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/40'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
              onClick={() => setActiveTab('search')}
              type="button"
            >
              <span className="w-5 text-center text-lg">✧</span>
              Discover
            </button>
            <button
              className={`flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition md:w-full ${
                activeTab === 'requests'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/40'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
              onClick={() => setActiveTab('requests')}
              type="button"
            >
              <span className="w-5 text-center">◷</span>
              Requests
            </button>
            <button
              className={`flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition md:w-full ${
                activeTab === 'bulk'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/40'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
              onClick={() => setActiveTab('bulk')}
              type="button"
            >
              <span className="w-5 text-center">＋</span>
              Bulk Add
            </button>
            <button
              className={`flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition md:w-full ${
                activeTab === 'settings'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/40'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
              onClick={() => setActiveTab('settings')}
              type="button"
            >
              <span className="w-5 text-center">⚙</span>
              Settings
            </button>
          </nav>
        </aside>

        <section className="min-w-0 bg-[#111722]">
          <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#111722]/95 px-4 py-3 backdrop-blur md:px-5">
            <div className="flex items-center gap-3">
              <form className="flex flex-1 items-center gap-3" onSubmit={search}>
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
                  <input
                    className="h-12 w-full rounded-full border border-slate-700 bg-[#121723] px-11 text-base font-medium text-white outline-none ring-violet-400/70 placeholder:text-slate-400 focus:border-slate-600 focus:ring-2"
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Search Artists & Albums"
                    type="search"
                    value={query}
                  />
                </div>
                <button
                  className="h-12 rounded-full bg-violet-600 px-5 text-sm font-bold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={searchQuery.isFetching}
                  type="submit"
                >
                  {searchQuery.isFetching ? 'Searching' : 'Search'}
                </button>
              </form>
              <div className="relative">
                <button
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="menu"
                  className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-stone-500 text-lg font-semibold text-stone-100 ring-violet-400/70 transition hover:ring-2"
                  onClick={() => setIsUserMenuOpen(open => !open)}
                  title={user.username}
                  type="button"
                >
                  {user.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-full w-full object-cover" src={user.thumb} />
                  ) : (
                    user.username.slice(0, 1).toUpperCase()
                  )}
                </button>

                {isUserMenuOpen ? (
                  <div
                    className="absolute right-0 top-14 z-30 w-64 overflow-hidden rounded-md border border-slate-700 bg-slate-800 shadow-2xl shadow-black/50"
                    role="menu"
                  >
                    <div className="border-b border-slate-700 px-4 py-3">
                      <p className="truncate text-sm font-bold text-white">{user.username}</p>
                      {user.email ? <p className="mt-1 truncate text-xs text-slate-400">{user.email}</p> : null}
                    </div>
                    <form action="/api/auth/logout" method="post">
                      <button
                        className="flex h-11 w-full items-center gap-3 px-4 text-left text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
                        role="menuitem"
                        type="submit"
                      >
                        <span className="text-base">↪</span>
                        Sign out
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="px-4 py-5 md:px-5" onClick={() => setSelectedResultKey(null)}>
            {notice ? (
              <div className="mb-5 rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100">
                {notice}
              </div>
            ) : null}

            {searchQuery.isError ? (
              <div className="mb-5 rounded-md border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-100">
                {searchQuery.error instanceof Error ? searchQuery.error.message : 'Search failed.'}
              </div>
            ) : null}

            {activeTab === 'search' ? (
              <div className="space-y-8">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {filters.map(item => (
                    <button
                      className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
                        filter === item.value
                          ? 'bg-violet-600 text-white'
                          : 'border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                      }`}
                      key={item.value}
                      onClick={() => setFilter(item.value)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <h2 className="text-2xl font-bold tracking-tight">
                      {results.length ? 'Search Results' : 'Discover Music'}
                    </h2>
                    <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-500 text-xs text-slate-300">
                      ›
                    </span>
                  </div>

                  {searchQuery.isLoading ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                      {Array.from({ length: 18 }).map((_, index) => (
                        <div className="min-w-0" key={index}>
                          <div className="aspect-[2/3] animate-pulse rounded-lg bg-slate-800" />
                          <div className="mt-3 h-4 animate-pulse rounded bg-slate-800" />
                          <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-slate-800" />
                        </div>
                      ))}
                    </div>
                  ) : results.length ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                      {results.map(result => {
                        const albumsHref = artistAlbumsHref(result, currentHomeHref)
                        const albumHref = albumDetailsHref(result, currentHomeHref)

                        return (
                          <article className="group min-w-0" key={resultKey(result)}>
                            <div
                              className="relative block aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-lg border border-slate-700/80 bg-slate-800 text-left shadow-xl shadow-black/30 outline-none ring-violet-400/70 transition hover:border-slate-500 focus:ring-2"
                              onKeyDown={event => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  toggleResultActions(result)
                                }
                              }}
                              onClick={event => {
                                event.stopPropagation()
                                toggleResultActions(result)
                              }}
                              role="button"
                              tabIndex={0}
                            >
                              {result.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  alt=""
                                  className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                                  src={result.imageUrl}
                                />
                              ) : (
                                <div className="grid h-full place-items-center bg-gradient-to-br from-slate-700 to-slate-900 text-6xl font-bold text-white/10">
                                  {result.title.slice(0, 1)}
                                </div>
                              )}
                              <div className="absolute left-2 top-2 rounded-md bg-blue-600 px-2 py-1 text-[0.68rem] font-bold uppercase text-white shadow">
                                {typeLabel(result)}
                              </div>
                              <div
                                className={`absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full text-xs font-black ${statusBadgeClass(result.status)}`}
                              >
                                {statusIcon(result.status)}
                              </div>

                              {selectedResultKey === resultKey(result) ? (
                                <div className="absolute inset-0 flex flex-col justify-end bg-slate-950/82 p-3 backdrop-blur-sm">
                                  <button
                                    aria-label="Close actions"
                                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-slate-800 text-sm font-bold text-slate-200 transition hover:bg-slate-700"
                                    onClick={event => {
                                      event.stopPropagation()
                                      setSelectedResultKey(null)
                                    }}
                                    type="button"
                                  >
                                    ×
                                  </button>
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-violet-300">
                                      {typeLabel(result)}
                                    </p>
                                    {result.type === 'artist' && albumsHref ? (
                                      <Link
                                        className="mt-1 block line-clamp-2 text-sm font-bold text-white transition hover:text-violet-200"
                                        href={albumsHref}
                                        onClick={event => event.stopPropagation()}
                                      >
                                        {result.title}
                                      </Link>
                                    ) : result.type === 'album' && albumHref ? (
                                      <Link
                                        className="mt-1 block line-clamp-2 text-sm font-bold text-white transition hover:text-violet-200"
                                        href={albumHref}
                                        onClick={event => event.stopPropagation()}
                                      >
                                        {result.title}
                                      </Link>
                                    ) : (
                                      <p className="mt-1 line-clamp-2 text-sm font-bold text-white">{result.title}</p>
                                    )}
                                    {result.subtitle && result.type === 'artist' && albumsHref ? (
                                      <Link
                                        className="mt-1 block line-clamp-1 text-xs text-slate-300 transition hover:text-violet-200"
                                        href={albumsHref}
                                        onClick={event => event.stopPropagation()}
                                      >
                                        {result.subtitle}
                                      </Link>
                                    ) : result.subtitle && result.type === 'album' && albumHref ? (
                                      <Link
                                        className="mt-1 block line-clamp-1 text-xs text-slate-300 transition hover:text-violet-200"
                                        href={albumHref}
                                        onClick={event => event.stopPropagation()}
                                      >
                                        {result.subtitle}
                                      </Link>
                                    ) : result.subtitle ? (
                                      <p className="mt-1 line-clamp-1 text-xs text-slate-300">{result.subtitle}</p>
                                    ) : null}
                                    {canRequest(result) ? (
                                      <button
                                        className="mt-3 h-10 w-full rounded-md bg-violet-600 px-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                                        disabled={
                                          requestMutation.isPending && requestMutation.variables?.id === result.id
                                        }
                                        onClick={event => {
                                          event.stopPropagation()
                                          requestResult(result)
                                        }}
                                        type="button"
                                      >
                                        {requestMutation.isPending && requestMutation.variables?.id === result.id
                                          ? 'Requesting'
                                          : badgeLabel(result)}
                                      </button>
                                    ) : (
                                      <div
                                        className={`mt-3 h-10 rounded-md px-3 py-2 text-center text-sm font-bold ${statusBadgeClass(result.status)}`}
                                      >
                                        {badgeLabel(result)}
                                      </div>
                                    )}
                                    {result.type === 'artist' && albumsHref ? (
                                      <Link
                                        className="mt-2 block h-10 rounded-md bg-slate-800 px-3 py-2 text-center text-sm font-bold text-slate-100 transition hover:bg-slate-700"
                                        href={albumsHref}
                                        onClick={event => event.stopPropagation()}
                                      >
                                        View albums
                                      </Link>
                                    ) : result.type === 'album' && albumHref ? (
                                      <Link
                                        className="mt-2 block h-10 rounded-md bg-slate-800 px-3 py-2 text-center text-sm font-bold text-slate-100 transition hover:bg-slate-700"
                                        href={albumHref}
                                        onClick={event => event.stopPropagation()}
                                      >
                                        View album
                                      </Link>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            <div className="mt-2 min-h-14">
                              {result.type === 'artist' && albumsHref ? (
                                <Link
                                  className="line-clamp-2 text-sm font-semibold leading-5 text-slate-100 transition hover:text-violet-200"
                                  href={albumsHref}
                                  onClick={event => event.stopPropagation()}
                                >
                                  {result.title}
                                </Link>
                              ) : result.type === 'album' && albumHref ? (
                                <Link
                                  className="line-clamp-2 text-sm font-semibold leading-5 text-slate-100 transition hover:text-violet-200"
                                  href={albumHref}
                                  onClick={event => event.stopPropagation()}
                                >
                                  {result.title}
                                </Link>
                              ) : (
                                <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-100">
                                  {result.title}
                                </h3>
                              )}
                              {result.subtitle && result.type === 'artist' && albumsHref ? (
                                <Link
                                  className="mt-1 block line-clamp-1 text-xs text-slate-400 transition hover:text-violet-200"
                                  href={albumsHref}
                                  onClick={event => event.stopPropagation()}
                                >
                                  {result.subtitle}
                                </Link>
                              ) : result.subtitle && result.type === 'album' && albumHref ? (
                                <Link
                                  className="mt-1 block line-clamp-1 text-xs text-slate-400 transition hover:text-violet-200"
                                  href={albumHref}
                                  onClick={event => event.stopPropagation()}
                                >
                                  {result.subtitle}
                                </Link>
                              ) : result.subtitle ? (
                                <p className="mt-1 line-clamp-1 text-xs text-slate-400">{result.subtitle}</p>
                              ) : null}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {['Search artists', 'Find albums', 'Request music', 'Bulk add'].map(item => (
                        <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-5" key={item}>
                          <div className="mb-8 h-8 w-8 rounded-full bg-violet-600/80" />
                          <h3 className="text-lg font-bold">{item}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            Requests are handled privately by Overhearr.
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : activeTab === 'requests' ? (
              <section>
                <div className="mb-5 flex items-center gap-2">
                  <h2 className="text-2xl font-bold tracking-tight">Recent Requests</h2>
                  <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-500 text-xs text-slate-300">
                    ›
                  </span>
                </div>
                {results.length ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {results.slice(0, 12).map(result => (
                      <article
                        className="relative h-36 overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900 shadow-xl shadow-black/20"
                        key={`request-${result.type}-${result.id}`}
                      >
                        {result.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover opacity-25"
                            src={result.imageUrl}
                          />
                        ) : null}
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/30" />
                        <div className="relative flex h-full justify-between gap-4 p-4">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-300">{result.year ?? typeLabel(result)}</p>
                            <h3 className="mt-1 line-clamp-1 text-lg font-bold">{result.title}</h3>
                            {result.subtitle ? (
                              <p className="mt-2 line-clamp-1 text-sm text-slate-400">{result.subtitle}</p>
                            ) : null}
                            <div className="mt-3 flex items-center gap-2 text-sm">
                              <span className="font-semibold text-slate-400">Status</span>
                              <span className="rounded-full bg-green-500 px-2 py-1 text-xs font-bold text-green-950">
                                Available
                              </span>
                            </div>
                          </div>
                          <div className="hidden aspect-[2/3] h-full overflow-hidden rounded-md bg-slate-800 sm:block">
                            {result.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img alt="" className="h-full w-full object-cover" src={result.imageUrl} />
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-700 px-6 py-12 text-center text-slate-400">
                    Recent requests will appear here.
                  </div>
                )}
              </section>
            ) : activeTab === 'settings' ? (
              <section className="max-w-5xl">
                <div className="mb-5 flex items-center gap-2">
                  <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                  <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-500 text-xs text-slate-300">
                    ›
                  </span>
                </div>

                {settingsQuery.isLoading ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-5" key={index}>
                        <div className="h-4 w-24 animate-pulse rounded bg-slate-800" />
                        <div className="mt-5 h-6 w-2/3 animate-pulse rounded bg-slate-800" />
                        <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-slate-800" />
                      </div>
                    ))}
                  </div>
                ) : settingsQuery.isError ? (
                  <div className="rounded-md border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-100">
                    {settingsQuery.error instanceof Error ? settingsQuery.error.message : 'Could not load settings.'}
                  </div>
                ) : settingsQuery.data ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Plex Server</p>
                      <h3 className="mt-2 truncate text-xl font-bold">{settingsQuery.data.plex.url.host}</h3>
                      <p className="mt-2 break-all text-sm text-slate-400">{settingsQuery.data.plex.url.origin}</p>
                      <div className="mt-4 inline-flex rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-green-950">
                        {settingsQuery.data.plex.url.protocol.toUpperCase()}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Music Service</p>
                      <h3 className="mt-2 truncate text-xl font-bold">{settingsQuery.data.musicService.url.host}</h3>
                      <p className="mt-2 break-all text-sm text-slate-400">
                        {settingsQuery.data.musicService.url.origin}
                      </p>
                      <div className="mt-4 inline-flex rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-blue-950">
                        Server-side only
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Application URL</p>
                      <h3 className="mt-2 truncate text-xl font-bold">{settingsQuery.data.app.url.host}</h3>
                      <p className="mt-2 break-all text-sm text-slate-400">{settingsQuery.data.app.url.origin}</p>
                    </div>

                    <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Plex Client Identifier</p>
                      <h3 className="mt-2 truncate text-xl font-bold">{settingsQuery.data.plex.clientIdentifier}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Used for Plex sign-in. Secrets, tokens, and API keys are intentionally hidden.
                      </p>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
                <section className="rounded-lg border border-slate-700/80 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold">Bulk Add Artists</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Paste one artist per line or separate names with commas.
                    </p>
                  </div>
                  <textarea
                    className="min-h-80 w-full resize-y rounded-md border border-slate-700 bg-[#111722] p-4 text-base leading-7 text-white outline-none ring-violet-400/70 placeholder:text-slate-500 focus:ring-2"
                    id="bulk-artists"
                    onChange={event => setBulkText(event.target.value)}
                    placeholder={'Boards of Canada\nMassive Attack\nPortishead'}
                    value={bulkText}
                  />
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-400">
                      {artistCount} artist{artistCount === 1 ? '' : 's'} ready
                    </p>
                    <button
                      className="h-11 rounded-md bg-violet-600 px-5 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!artistCount || bulkMutation.isPending}
                      onClick={addBulkArtists}
                      type="button"
                    >
                      {bulkMutation.isPending ? 'Adding...' : 'Add all'}
                    </button>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-700/80 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
                  <h3 className="text-xl font-bold">Results</h3>
                  <div className="mt-4 space-y-2">
                    {bulkResults.map(item => (
                      <div className="rounded-md bg-slate-800/80 px-3 py-3" key={item.name}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{item.name}</p>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-bold ${
                              item.result.ok ? 'bg-green-500 text-green-950' : 'bg-rose-500 text-rose-950'
                            }`}
                          >
                            {item.result.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-5 text-slate-400">{item.result.message}</p>
                      </div>
                    ))}
                    {!bulkResults.length ? (
                      <p className="text-sm leading-6 text-slate-400">Bulk add results will appear here.</p>
                    ) : null}
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
