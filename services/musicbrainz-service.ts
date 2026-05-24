import type { SearchResult } from '@/types/lidarr'

type MusicBrainzRecording = {
  id: string
  title: string
  score?: number
  'artist-credit'?: {
    name?: string
    artist?: {
      id?: string
      name?: string
    }
  }[]
  releases?: {
    title?: string
    date?: string
  }[]
}

type RecordingResponse = {
  recordings?: MusicBrainzRecording[]
}

export class MusicBrainzService {
  async searchSongs(term: string): Promise<SearchResult[]> {
    if (!term.trim()) return []

    try {
      const url = new URL('https://musicbrainz.org/ws/2/recording')
      url.searchParams.set('query', term)
      url.searchParams.set('fmt', 'json')
      url.searchParams.set('limit', '8')

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Overhearr/0.1.0 (self-hosted music request app)'
        },
        cache: 'no-store'
      })

      if (!response.ok) {
        return []
      }

      const data = (await response.json()) as RecordingResponse

      return (data.recordings ?? []).map(recording => {
        const artistCredit = recording['artist-credit']?.[0]
        const artistName = artistCredit?.artist?.name ?? artistCredit?.name
        const release = recording.releases?.[0]

        return {
          id: recording.id,
          type: 'song',
          title: recording.title,
          subtitle: [artistName, release?.title].filter(Boolean).join(' - '),
          year: release?.date ? Number.parseInt(release.date.slice(0, 4), 10) : undefined,
          status: 'external',
          artist: artistName
            ? {
                name: artistName,
                foreignArtistId: artistCredit?.artist?.id
              }
            : undefined,
          payload: recording
        }
      })
    } catch {
      return []
    }
  }
}
