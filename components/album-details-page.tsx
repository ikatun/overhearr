'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'

import type { AlbumDetailsResponse, LidarrTrack, RequestResult, SearchResult } from '@/types/lidarr'

type AlbumDetailsPageProps = {
  albumId: string
  albumTitle?: string
  artistName?: string
  backHref: string
}

async function fetchAlbumDetails(albumId: string, albumTitle?: string, artistName?: string) {
  const url = new URL(`/api/albums/${encodeURIComponent(albumId)}`, window.location.origin)

  if (albumTitle) {
    url.searchParams.set('title', albumTitle)
  }

  if (artistName) {
    url.searchParams.set('artist', artistName)
  }

  const response = await fetch(`${url.pathname}${url.search}`)

  if (!response.ok) {
    throw new Error('Could not load album details.')
  }

  return (await response.json()) as AlbumDetailsResponse
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

function statusLabel(status: SearchResult['status']) {
  if (status === 'available') return 'Available'
  if (status === 'partial') return 'Partially Available'
  if (status === 'requested') return 'Requested'

  return 'Missing'
}

function statusClass(status: SearchResult['status']) {
  if (status === 'available') return 'bg-green-500 text-green-950'
  if (status === 'partial') return 'bg-amber-400 text-amber-950'
  if (status === 'requested') return 'bg-violet-500 text-violet-950'

  return 'bg-slate-700 text-slate-200'
}

function statusDescription(status: SearchResult['status']) {
  if (status === 'available') return 'Ready to play'
  if (status === 'partial') return 'Some tracks are present'
  if (status === 'requested') return 'Requested, not available yet'

  return 'Can be requested'
}

function formatDuration(milliseconds?: number) {
  if (!milliseconds) {
    return '--:--'
  }

  const totalSeconds = Math.round(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')

  return `${minutes}:${seconds}`
}

function trackNumber(track: LidarrTrack) {
  return track.trackNumber || String(track.absoluteTrackNumber ?? '')
}

export function AlbumDetailsPage({ albumId, albumTitle, artistName, backHref }: AlbumDetailsPageProps) {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const albumQuery = useQuery({
    queryKey: ['album-details', albumId, albumTitle, artistName],
    queryFn: () => fetchAlbumDetails(albumId, albumTitle, artistName)
  })
  const requestMutation = useMutation({
    mutationFn: requestAlbum,
    onSuccess: async data => {
      setNotice(data.message)
      await queryClient.invalidateQueries({ queryKey: ['album-details', albumId, albumTitle, artistName] })
    },
    onError: error => {
      setNotice(error instanceof Error ? error.message : 'Request failed.')
    }
  })
  const album = albumQuery.data?.album
  const tracks = albumQuery.data?.tracks ?? []
  const availableTracks = tracks.filter(track => track.hasFile).length
  const artistId = album?.artist?.id ?? album?.artist?.foreignArtistId
  const currentAlbumHref = (() => {
    const params = new URLSearchParams()

    if (albumTitle) {
      params.set('title', albumTitle)
    }

    if (artistName) {
      params.set('artist', artistName)
    }

    params.set('from', backHref)

    return `/albums/${encodeURIComponent(albumId)}?${params.toString()}`
  })()
  const artistHref =
    album && artistId
      ? `/artists/${encodeURIComponent(String(artistId))}/albums?name=${encodeURIComponent(album.artist?.name ?? '')}&from=${encodeURIComponent(currentAlbumHref)}`
      : undefined
  const canRequest = album?.status === 'requestable'

  return (
    <main className="min-h-screen bg-[#111722] text-slate-100">
      <header className="border-b border-slate-800/80 bg-[#111722]/95 px-4 py-4 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link className="text-sm font-bold text-violet-300 transition hover:text-violet-200" href={backHref}>
            ← Back
          </Link>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Album</p>
            <h1 className="line-clamp-1 text-xl font-bold">{album?.title ?? albumTitle ?? 'Album'}</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {notice ? (
          <div className="mb-5 rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100">
            {notice}
          </div>
        ) : null}

        {albumQuery.isLoading ? (
          <div className="grid gap-5 md:grid-cols-[15rem_minmax(0,1fr)_260px]">
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-slate-800" />
            <div>
              <div className="h-9 max-w-lg animate-pulse rounded bg-slate-800" />
              <div className="mt-4 h-4 max-w-sm animate-pulse rounded bg-slate-800" />
              <div className="mt-8 h-32 animate-pulse rounded bg-slate-800" />
            </div>
            <div className="h-44 animate-pulse rounded-lg bg-slate-800" />
          </div>
        ) : albumQuery.isError ? (
          <div className="rounded-md border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-100">
            {albumQuery.error instanceof Error ? albumQuery.error.message : 'Could not load album details.'}
          </div>
        ) : album ? (
          <>
            <div className="mb-8 grid gap-5 rounded-lg border border-slate-700/80 bg-slate-900/70 p-4 shadow-xl shadow-black/20 md:grid-cols-[15rem_minmax(0,1fr)_260px] md:items-start">
              <div className="aspect-[2/3] overflow-hidden rounded-lg bg-slate-800">
                {album.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="h-full w-full object-cover" src={album.imageUrl} />
                ) : (
                  <div className="grid h-full place-items-center bg-gradient-to-br from-slate-700 to-slate-900 text-7xl font-bold text-white/10">
                    {album.title.slice(0, 1)}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${statusClass(album.status)}`}
                >
                  {statusLabel(album.status)}
                </div>
                <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{album.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
                  {artistHref ? (
                    <Link className="font-semibold text-violet-300 transition hover:text-violet-200" href={artistHref}>
                      {album.subtitle}
                    </Link>
                  ) : (
                    <span>{album.subtitle}</span>
                  )}
                  {album.year ? <span>{album.year}</span> : null}
                  <span>{statusDescription(album.status)}</span>
                </div>
                {album.overview ? (
                  <p className="mt-5 line-clamp-4 max-w-3xl text-sm leading-6 text-slate-400">{album.overview}</p>
                ) : null}
              </div>

              <div className="rounded-lg border border-slate-700 bg-[#111722] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tracks</p>
                <p className="mt-2 text-3xl font-bold">
                  {tracks.length ? `${availableTracks}/${tracks.length}` : 'Unknown'}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {tracks.length ? 'available tracks' : 'Track list is available after the album exists locally.'}
                </p>
                {artistHref ? (
                  <Link
                    className="mt-4 block h-11 rounded-md bg-slate-800 px-4 py-3 text-center text-sm font-bold text-slate-100 transition hover:bg-slate-700"
                    href={artistHref}
                  >
                    View artist
                  </Link>
                ) : null}
                <button
                  className="mt-3 h-14 w-full rounded-md bg-violet-600 px-4 text-base font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  disabled={!canRequest || requestMutation.isPending}
                  onClick={() => requestMutation.mutate(album)}
                  type="button"
                >
                  {!canRequest
                    ? statusLabel(album.status)
                    : requestMutation.isPending
                      ? 'Requesting...'
                      : 'Request Album'}
                </button>
              </div>
            </div>

            <section>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">Tracks</h2>
                <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-500 text-xs text-slate-300">
                  ›
                </span>
              </div>

              {tracks.length ? (
                <div className="overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900/70">
                  {tracks.map(track => (
                    <div
                      className="grid grid-cols-[2.5rem_minmax(0,1fr)_4rem_5.5rem] items-center gap-3 border-b border-slate-800 px-3 py-3 last:border-b-0 md:grid-cols-[3rem_minmax(0,1fr)_5rem_7rem]"
                      key={track.id ?? `${track.albumId}-${track.trackNumber}-${track.title}`}
                    >
                      <span className="text-sm font-bold text-slate-500">{trackNumber(track)}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{track.title}</p>
                        {track.mediumNumber && track.mediumNumber > 1 ? (
                          <p className="mt-1 text-xs text-slate-500">Disc {track.mediumNumber}</p>
                        ) : null}
                      </div>
                      <span className="text-right text-xs font-semibold text-slate-400">
                        {formatDuration(track.duration)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-center text-[0.68rem] font-black uppercase ${
                          track.hasFile ? 'bg-green-400 text-green-950' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {track.hasFile ? 'Ready' : 'Missing'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-700 px-6 py-12 text-center text-slate-400">
                  Track details will appear after this album is added.
                </div>
              )}
            </section>
          </>
        ) : null}
      </section>
    </main>
  )
}
