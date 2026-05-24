import { NextRequest } from 'next/server'

import { LidarrService } from '@/services/lidarr-service'
import { MusicBrainzService } from '@/services/musicbrainz-service'
import type { SearchKind } from '@/types/lidarr'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')?.trim() ?? ''
  const type = (request.nextUrl.searchParams.get('type') ?? 'all') as SearchKind

  if (query.length < 2) {
    return Response.json({ results: [] })
  }

  const lidarr = new LidarrService()
  const musicBrainz = new MusicBrainzService()

  const [lidarrResults, songResults] = await Promise.all([
    type === 'song'
      ? Promise.resolve([])
      : lidarr.search(query, type === 'album' ? 'album' : type === 'artist' ? 'artist' : 'all'),
    type === 'artist' || type === 'album' ? Promise.resolve([]) : musicBrainz.searchSongs(query)
  ])

  return Response.json({ results: [...lidarrResults, ...songResults] })
}
