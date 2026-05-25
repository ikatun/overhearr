'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { ArtistAlbumsResponse } from '@/types/lidarr'
import type { RequestResult, SearchResult } from '@/types/lidarr'

type ArtistAlbumsPageProps = {
  artistId: string
  artistName?: string
  backHref: string
}

async function fetchArtistAlbums(artistId: string, artistName?: string) {
  const url = new URL(`/api/artists/${encodeURIComponent(artistId)}/albums`, window.location.origin)

  if (artistName) {
    url.searchParams.set('name', artistName)
  }

  const response = await fetch(`${url.pathname}${url.search}`)

  if (!response.ok) {
    throw new Error('Could not load artist albums.')
  }

  return (await response.json()) as ArtistAlbumsResponse
}

async function requestArtist(artist: SearchResult) {
  const response = await fetch('/api/requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'artist',
      payload: artist.payload
    })
  })

  if (!response.ok) {
    throw new Error('Request failed. Check the music service connection.')
  }

  return (await response.json()) as RequestResult
}

async function requestAlbum(album: SearchResult) {
  const response = await fetch('/api/requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'album',
      payload: album.payload
    })
  })

  if (!response.ok) {
    throw new Error('Request failed. Check the music service connection.')
  }

  return (await response.json()) as RequestResult
}

function albumStatusLabel(status: SearchResult['status']) {
  if (status === 'available') return 'Available'
  if (status === 'partial') return 'Partially Available'
  if (status === 'requested') return 'Requested'

  return 'Missing'
}

function albumStatusClass(status: SearchResult['status']) {
  if (status === 'available') return 'border-green-300/30 bg-green-400 text-green-950'
  if (status === 'partial') return 'border-amber-300/30 bg-amber-400 text-amber-950'
  if (status === 'requested') return 'border-violet-300/30 bg-violet-400 text-violet-950'

  return 'border-slate-500/30 bg-slate-700 text-slate-200'
}

function albumStatusDescription(status: SearchResult['status']) {
  if (status === 'available') return 'Ready to play'
  if (status === 'partial') return 'Some tracks are present'
  if (status === 'requested') return 'Requested, not available yet'

  return 'Can be requested'
}

function albumStatusPriority(status: SearchResult['status']) {
  if (status === 'available') return 0
  if (status === 'requested') return 1
  if (status === 'partial') return 2

  return 3
}

function albumDetailsHref(album: SearchResult, fromHref: string) {
  const params = new URLSearchParams()

  params.set('title', album.title)
  params.set('artist', album.artist?.name ?? album.subtitle ?? '')
  params.set('from', fromHref)

  return `/albums/${encodeURIComponent(album.id)}?${params.toString()}`
}

function canRequestAlbum(album: SearchResult) {
  return album.status === 'requestable' || album.status === 'partial'
}

export function ArtistAlbumsPage({ artistId, artistName, backHref }: ArtistAlbumsPageProps) {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null)
  const albumsQuery = useQuery({
    queryKey: ['artist-albums', artistId, artistName],
    queryFn: () => fetchArtistAlbums(artistId, artistName)
  })
  const requestMutation = useMutation({
    mutationFn: requestArtist,
    onSuccess: async data => {
      setNotice(data.message)
      setSelectedAlbumId(null)
      await queryClient.invalidateQueries({ queryKey: ['artist-albums', artistId, artistName] })
    },
    onError: error => {
      setNotice(error instanceof Error ? error.message : 'Request failed.')
    }
  })
  const albumRequestMutation = useMutation({
    mutationFn: requestAlbum,
    onSuccess: async data => {
      setNotice(data.message)
      await queryClient.invalidateQueries({ queryKey: ['artist-albums', artistId, artistName] })
    },
    onError: error => {
      setNotice(error instanceof Error ? error.message : 'Request failed.')
    }
  })
  const artist = albumsQuery.data?.artist
  const sortedAlbums = useMemo(() => {
    const albums = albumsQuery.data?.albums ?? []

    return [...albums].sort((left, right) => {
      const priorityDifference = albumStatusPriority(left.status) - albumStatusPriority(right.status)

      if (priorityDifference !== 0) {
        return priorityDifference
      }

      return (left.year ?? 0) - (right.year ?? 0) || left.title.localeCompare(right.title)
    })
  }, [albumsQuery.data?.albums])
  const availableAlbumCount = sortedAlbums.filter(album => album.status === 'available').length
  const totalAlbumCount = sortedAlbums.length
  const areAllAlbumsAvailable = totalAlbumCount > 0 && availableAlbumCount === totalAlbumCount
  const artistStatus = totalAlbumCount
    ? `${availableAlbumCount} of ${totalAlbumCount} albums available`
    : artist?.status === 'requestable'
      ? 'Requestable'
      : 'No album data'
  const currentPageHref = useMemo(() => {
    const params = new URLSearchParams()

    if (artistName) {
      params.set('name', artistName)
    }

    params.set('from', backHref)

    return `/artists/${encodeURIComponent(artistId)}/albums?${params.toString()}`
  }, [artistId, artistName, backHref])

  return (
    <main className="min-h-screen bg-[#111722] text-slate-100" onClick={() => setSelectedAlbumId(null)}>
      <header className="border-b border-slate-800/80 bg-[#111722]/95 px-4 py-4 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link className="text-sm font-bold text-violet-300 transition hover:text-violet-200" href={backHref}>
            ← Back
          </Link>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Albums</p>
            <h1 className="text-xl font-bold">{artist?.title ?? 'Artist'}</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {notice ? (
          <div className="mb-5 rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100">
            {notice}
          </div>
        ) : null}

        {artist ? (
          <div className="mb-8 grid gap-5 rounded-lg border border-slate-700/80 bg-slate-900/70 p-4 shadow-xl shadow-black/20 md:grid-cols-[auto_minmax(0,1fr)_260px] md:items-center">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-800">
              {artist.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="h-full w-full object-cover" src={artist.imageUrl} />
              ) : null}
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">{artist.title}</h2>
              {artist.overview ? (
                <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-400">{artist.overview}</p>
              ) : null}
            </div>
            <div className="rounded-lg border border-slate-700 bg-[#111722] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Status</p>
              <div
                className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-bold ${
                  areAllAlbumsAvailable ? 'bg-green-500 text-green-950' : 'bg-violet-500 text-violet-950'
                }`}
              >
                {artistStatus}
              </div>
              <button
                className="mt-4 h-14 w-full rounded-md bg-violet-600 px-4 text-base font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                disabled={areAllAlbumsAvailable || requestMutation.isPending}
                onClick={() => requestMutation.mutate(artist)}
                type="button"
              >
                {areAllAlbumsAvailable
                  ? 'All albums available'
                  : requestMutation.isPending
                    ? 'Requesting...'
                    : 'Request all albums'}
              </button>
            </div>
          </div>
        ) : null}

        {albumsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div className="min-w-0" key={index}>
                <div className="aspect-[2/3] animate-pulse rounded-lg bg-slate-800" />
                <div className="mt-3 h-4 animate-pulse rounded bg-slate-800" />
                <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-slate-800" />
              </div>
            ))}
          </div>
        ) : albumsQuery.isError ? (
          <div className="rounded-md border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-100">
            {albumsQuery.error instanceof Error ? albumsQuery.error.message : 'Could not load artist albums.'}
          </div>
        ) : sortedAlbums.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {sortedAlbums.map(album => (
              <article className="min-w-0" key={album.id}>
                <div
                  aria-label={`View ${album.title}`}
                  className="relative block aspect-[2/3] cursor-pointer overflow-hidden rounded-lg border border-slate-700/80 bg-slate-800 shadow-xl shadow-black/30 outline-none ring-violet-400/70 transition hover:border-slate-500 focus:ring-2"
                  onClick={event => {
                    event.stopPropagation()
                    setSelectedAlbumId(current => (current === album.id ? null : album.id))
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedAlbumId(current => (current === album.id ? null : album.id))
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {album.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="h-full w-full object-cover transition duration-200 hover:scale-105"
                      src={album.imageUrl}
                    />
                  ) : (
                    <div className="grid h-full place-items-center bg-gradient-to-br from-slate-700 to-slate-900 text-6xl font-bold text-white/10">
                      {album.title.slice(0, 1)}
                    </div>
                  )}
                  <div className="absolute left-2 top-2 rounded-md bg-blue-600 px-2 py-1 text-[0.68rem] font-bold uppercase text-white shadow">
                    Album
                  </div>
                  <div
                    className={`absolute inset-x-2 bottom-2 rounded-md border px-3 py-2 shadow-xl shadow-black/30 ${albumStatusClass(album.status)}`}
                    title={albumStatusLabel(album.status)}
                  >
                    <p className="text-xs font-black uppercase tracking-wide">{albumStatusLabel(album.status)}</p>
                    <p className="mt-0.5 text-[0.68rem] font-bold opacity-80">{albumStatusDescription(album.status)}</p>
                  </div>

                  {selectedAlbumId === album.id ? (
                    <div className="absolute inset-0 flex flex-col justify-end bg-slate-950/82 p-3 backdrop-blur-sm">
                      <button
                        aria-label="Close actions"
                        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-slate-800 text-sm font-bold text-slate-200 transition hover:bg-slate-700"
                        onClick={event => {
                          event.stopPropagation()
                          setSelectedAlbumId(null)
                        }}
                        type="button"
                      >
                        ×
                      </button>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-violet-300">Album</p>
                        <Link
                          className="mt-1 block line-clamp-2 text-sm font-bold text-white transition hover:text-violet-200"
                          href={albumDetailsHref(album, currentPageHref)}
                          onClick={event => event.stopPropagation()}
                        >
                          {album.title}
                        </Link>
                        <p className="mt-1 line-clamp-1 text-xs text-slate-300">
                          {[album.year, albumStatusLabel(album.status)].filter(Boolean).join(' · ')}
                        </p>
                        <Link
                          className="mt-3 block h-10 rounded-md bg-slate-800 px-3 py-2 text-center text-sm font-bold text-slate-100 transition hover:bg-slate-700"
                          href={albumDetailsHref(album, currentPageHref)}
                          onClick={event => event.stopPropagation()}
                        >
                          View details
                        </Link>
                        {canRequestAlbum(album) ? (
                          <button
                            className="mt-2 h-10 w-full rounded-md bg-violet-600 px-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                            disabled={albumRequestMutation.isPending && albumRequestMutation.variables?.id === album.id}
                            onClick={event => {
                              event.stopPropagation()
                              albumRequestMutation.mutate(album)
                            }}
                            type="button"
                          >
                            {albumRequestMutation.isPending && albumRequestMutation.variables?.id === album.id
                              ? 'Requesting'
                              : 'Request album'}
                          </button>
                        ) : (
                          <div
                            className={`mt-2 h-10 rounded-md px-3 py-2 text-center text-sm font-bold ${albumStatusClass(album.status)}`}
                          >
                            {albumStatusLabel(album.status)}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 min-h-14">
                  <Link
                    className="line-clamp-2 text-sm font-semibold leading-5 text-slate-100 transition hover:text-violet-200"
                    onClick={event => event.stopPropagation()}
                    href={albumDetailsHref(album, currentPageHref)}
                  >
                    {album.title}
                  </Link>
                  <Link
                    className="mt-1 block text-xs text-slate-400 transition hover:text-violet-200"
                    onClick={event => event.stopPropagation()}
                    href={albumDetailsHref(album, currentPageHref)}
                  >
                    {[album.year, albumStatusLabel(album.status)].filter(Boolean).join(' · ')}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-700 px-6 py-12 text-center text-slate-400">
            No albums found for this artist.
          </div>
        )}
      </section>
    </main>
  )
}
