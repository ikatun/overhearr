import { NextRequest } from 'next/server'

import { requireSession } from '@/lib/session'
import { LidarrService } from '@/services/lidarr-service'
import type { SearchKind, SearchResult } from '@/types/lidarr'

function interleaveResults(results: SearchResult[]) {
  const artists = results.filter(result => result.type === 'artist')
  const albums = results.filter(result => result.type === 'album')
  const interleaved: SearchResult[] = []
  const longest = Math.max(artists.length, albums.length)

  for (let index = 0; index < longest; index += 1) {
    const artist = artists[index]
    const album = albums[index]

    if (artist) interleaved.push(artist)
    if (album) interleaved.push(album)
  }

  return interleaved
}

export async function GET(request: NextRequest) {
  await requireSession()

  const query = request.nextUrl.searchParams.get('query')?.trim() ?? ''
  const type = (request.nextUrl.searchParams.get('type') ?? 'all') as SearchKind

  const lidarr = new LidarrService()
  const lidarrInclude = type === 'album' ? 'album' : type === 'artist' ? 'artist' : 'all'

  if (query.length < 2) {
    const results = await lidarr.browse(lidarrInclude)

    return Response.json({ results: type === 'all' ? interleaveResults(results) : results })
  }

  const results = await lidarr.search(query, lidarrInclude)

  return Response.json({ results: type === 'all' ? interleaveResults(results) : results })
}
