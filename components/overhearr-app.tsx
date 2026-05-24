'use client'

import { FormEvent, useMemo, useState } from 'react'

import type { BulkArtistResult, RequestResult, SearchKind, SearchResult } from '@/types/lidarr'

type SearchResponse = {
  results: SearchResult[]
}

type RequestResponse = RequestResult

type BulkResponse = {
  results: BulkArtistResult[]
}

const filters: { label: string; value: SearchKind }[] = [
  { label: 'All', value: 'all' },
  { label: 'Artists', value: 'artist' },
  { label: 'Albums', value: 'album' },
  { label: 'Songs', value: 'song' }
]

function badgeLabel(result: SearchResult) {
  if (result.status === 'available') return 'In Lidarr'
  if (result.type === 'song') return 'Request artist'
  return 'Request'
}

function typeLabel(result: SearchResult) {
  if (result.type === 'artist') return 'Artist'
  if (result.type === 'album') return 'Album'
  return 'Song'
}

export function OverhearrApp() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SearchKind>('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeTab, setActiveTab] = useState<'search' | 'bulk'>('search')
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [bulkText, setBulkText] = useState('')
  const [bulkResults, setBulkResults] = useState<BulkArtistResult[]>([])
  const [isBulkAdding, setIsBulkAdding] = useState(false)

  const artistCount = useMemo(() => {
    return bulkText
      .split(/\n|,/)
      .map(value => value.trim())
      .filter(Boolean).length
  }, [bulkText])

  async function search(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    if (query.trim().length < 2) {
      setResults([])
      return
    }

    setIsSearching(true)
    setNotice(null)

    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(query)}&type=${filter}`)
      const data = (await response.json()) as SearchResponse
      setResults(data.results)
    } catch {
      setNotice('Search failed. Check that Overhearr can reach Lidarr.')
    } finally {
      setIsSearching(false)
    }
  }

  async function requestResult(result: SearchResult) {
    if (result.type === 'song' && !result.artist?.name) {
      setNotice('This song result did not include an artist to request.')
      return
    }

    setRequestingId(result.id)
    setNotice(null)

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: result.type === 'album' ? 'album' : 'artist',
          payload:
            result.type === 'song'
              ? {
                  artistName: result.artist?.name,
                  foreignArtistId: result.artist?.foreignArtistId
                }
              : result.payload
        })
      })
      const data = (await response.json()) as RequestResponse
      setNotice(data.message)
      await search()
    } catch {
      setNotice('Request failed. Check the Lidarr connection and profiles.')
    } finally {
      setRequestingId(null)
    }
  }

  async function addBulkArtists() {
    const artists = bulkText
      .split(/\n|,/)
      .map(value => value.trim())
      .filter(Boolean)

    if (!artists.length) return

    setIsBulkAdding(true)
    setBulkResults([])
    setNotice(null)

    try {
      const response = await fetch('/api/bulk-artists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ artists })
      })
      const data = (await response.json()) as BulkResponse
      setBulkResults(data.results)
    } catch {
      setNotice('Bulk add failed. Check the Lidarr connection.')
    } finally {
      setIsBulkAdding(false)
    }
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
              className="flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold text-slate-500 md:w-full"
              disabled
              type="button"
            >
              <span className="w-5 text-center">◷</span>
              Requests
            </button>
            <button
              className="flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold text-slate-500 md:w-full"
              disabled
              type="button"
            >
              <span className="w-5 text-center">⚙</span>
              Settings
            </button>
          </nav>

          <div className="absolute bottom-4 left-4 right-4 hidden rounded-md bg-amber-400 px-3 py-3 text-sm font-semibold text-slate-950 md:block md:w-[13.25rem]">
            Overhearr Preview
            <span className="mt-1 block text-xs font-medium text-amber-950/80">Lidarr connected</span>
          </div>
        </aside>

        <section className="min-w-0 bg-[#111722]">
          <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#111722]/95 px-4 py-3 backdrop-blur md:px-5">
            <form onSubmit={search}>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
                  <input
                    className="h-12 w-full rounded-full border border-slate-700 bg-[#121723] px-11 text-base font-medium text-white outline-none ring-violet-400/70 placeholder:text-slate-400 focus:border-slate-600 focus:ring-2"
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Search Artists, Albums & Songs"
                    type="search"
                    value={query}
                  />
                </div>
                <button
                  className="h-12 rounded-full bg-violet-600 px-5 text-sm font-bold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSearching}
                  type="submit"
                >
                  {isSearching ? 'Searching' : 'Search'}
                </button>
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-stone-500 text-lg font-semibold text-stone-100">
                  I
                </div>
              </div>
            </form>
          </header>

          <div className="px-4 py-5 md:px-5">
            {notice ? (
              <div className="mb-5 rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100">
                {notice}
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

                  {results.length ? (
                    <div className="flex gap-4 overflow-x-auto pb-3">
                      {results.map(result => (
                        <article className="group w-40 shrink-0 sm:w-44" key={`${result.type}-${result.id}`}>
                          <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-slate-700/80 bg-slate-800 shadow-xl shadow-black/30">
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
                              className={`absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full text-xs font-black ${
                                result.status === 'available'
                                  ? 'bg-green-400 text-green-950'
                                  : 'bg-slate-700 text-slate-200'
                              }`}
                            >
                              {result.status === 'available' ? '✓' : '−'}
                            </div>
                          </div>
                          <div className="mt-2">
                            <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-100">
                              {result.title}
                            </h3>
                            {result.subtitle ? (
                              <p className="mt-1 line-clamp-1 text-xs text-slate-400">{result.subtitle}</p>
                            ) : null}
                            <button
                              className="mt-2 h-9 w-full rounded-md bg-violet-600 text-xs font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                              disabled={result.status === 'available' || requestingId === result.id}
                              onClick={() => requestResult(result)}
                              type="button"
                            >
                              {requestingId === result.id ? 'Requesting' : badgeLabel(result)}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {['Search artists', 'Find albums', 'Match songs', 'Bulk add'].map(item => (
                        <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-5" key={item}>
                          <div className="mb-8 h-8 w-8 rounded-full bg-violet-600/80" />
                          <h3 className="text-lg font-bold">{item}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            Requests are routed through Lidarr server-side.
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {results.length ? (
                  <section>
                    <div className="mb-4 flex items-center gap-2">
                      <h2 className="text-2xl font-bold tracking-tight">Recent Requests</h2>
                      <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-500 text-xs text-slate-300">
                        ›
                      </span>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-3">
                      {results.slice(0, 6).map(result => (
                        <article
                          className="relative h-36 w-80 shrink-0 overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900 shadow-xl shadow-black/20 sm:w-96"
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
                              <p className="text-xs font-bold text-slate-300">{result.year ?? 'Music'}</p>
                              <h3 className="mt-1 line-clamp-1 text-lg font-bold">{result.title}</h3>
                              {result.subtitle ? (
                                <p className="mt-2 line-clamp-1 text-sm text-slate-400">{result.subtitle}</p>
                              ) : null}
                              <div className="mt-3 flex items-center gap-2 text-sm">
                                <span className="font-semibold text-slate-400">Status</span>
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-bold ${
                                    result.status === 'available'
                                      ? 'bg-green-500 text-green-950'
                                      : 'bg-violet-500 text-violet-950'
                                  }`}
                                >
                                  {result.status === 'available' ? 'Available' : 'Requested'}
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
                  </section>
                ) : null}
              </div>
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
                      disabled={!artistCount || isBulkAdding}
                      onClick={addBulkArtists}
                      type="button"
                    >
                      {isBulkAdding ? 'Adding...' : 'Add all'}
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
