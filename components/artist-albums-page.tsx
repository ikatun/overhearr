'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'

import type { ArtistAlbumsResponse } from '@/types/lidarr'
import type { RequestResult, SearchResult } from '@/types/lidarr'

type ArtistAlbumsPageProps = {
  artistId: string
  artistName?: string
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

export function ArtistAlbumsPage({ artistId, artistName }: ArtistAlbumsPageProps) {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const albumsQuery = useQuery({
    queryKey: ['artist-albums', artistId, artistName],
    queryFn: () => fetchArtistAlbums(artistId, artistName)
  })
  const requestMutation = useMutation({
    mutationFn: requestArtist,
    onSuccess: async data => {
      setNotice(data.message)
      await queryClient.invalidateQueries({ queryKey: ['artist-albums', artistId, artistName] })
    },
    onError: error => {
      setNotice(error instanceof Error ? error.message : 'Request failed.')
    }
  })
  const artist = albumsQuery.data?.artist
  const albums = albumsQuery.data?.albums ?? []
  const artistStatus =
    artist?.status === 'available' ? 'Available' : artist?.status === 'requestable' ? 'Requestable' : 'Unknown'

  return (
    <main className="min-h-screen bg-[#111722] text-slate-100">
      <header className="border-b border-slate-800/80 bg-[#111722]/95 px-4 py-4 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link className="text-sm font-bold text-violet-300 transition hover:text-violet-200" href="/">
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
                  artist.status === 'available' ? 'bg-green-500 text-green-950' : 'bg-violet-500 text-violet-950'
                }`}
              >
                {artistStatus}
              </div>
              <button
                className="mt-4 h-14 w-full rounded-md bg-violet-600 px-4 text-base font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                disabled={artist.status === 'available' || requestMutation.isPending}
                onClick={() => requestMutation.mutate(artist)}
                type="button"
              >
                {artist.status === 'available'
                  ? 'Available'
                  : requestMutation.isPending
                    ? 'Requesting...'
                    : 'Request Artist'}
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
        ) : albums.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {albums.map(album => (
              <article className="min-w-0" key={album.id}>
                <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-slate-700/80 bg-slate-800 shadow-xl shadow-black/30">
                  {album.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-full w-full object-cover" src={album.imageUrl} />
                  ) : (
                    <div className="grid h-full place-items-center bg-gradient-to-br from-slate-700 to-slate-900 text-6xl font-bold text-white/10">
                      {album.title.slice(0, 1)}
                    </div>
                  )}
                  <div className="absolute left-2 top-2 rounded-md bg-blue-600 px-2 py-1 text-[0.68rem] font-bold uppercase text-white shadow">
                    Album
                  </div>
                  <div className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-green-400 text-xs font-black text-green-950">
                    ✓
                  </div>
                </div>
                <div className="mt-2 min-h-14">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-100">{album.title}</h3>
                  {album.year ? <p className="mt-1 text-xs text-slate-400">{album.year}</p> : null}
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
