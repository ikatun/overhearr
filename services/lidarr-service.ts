import { getServerEnv } from '@/lib/env'
import type { LidarrAlbum, LidarrArtist, RequestResult, SearchResult } from '@/types/lidarr'

type RootFolder = {
  path: string
}

type Profile = {
  id: number
  name: string
}

function imageUrl(images?: { remoteUrl?: string; url?: string }[]) {
  return images?.find(image => image.remoteUrl || image.url)?.remoteUrl ?? images?.find(image => image.url)?.url
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase()
}

export class LidarrService {
  private readonly baseUrl = getServerEnv().lidarrUrl
  private readonly apiKey = getServerEnv().lidarrApiKey

  async lookupArtists(term: string): Promise<LidarrArtist[]> {
    if (!term.trim()) return []

    return this.get<LidarrArtist[]>('/api/v1/artist/lookup', { term })
  }

  async lookupAlbums(term: string): Promise<LidarrAlbum[]> {
    if (!term.trim()) return []

    try {
      return await this.get<LidarrAlbum[]>('/api/v1/album/lookup', { term })
    } catch {
      return []
    }
  }

  async getArtists(): Promise<LidarrArtist[]> {
    return this.get<LidarrArtist[]>('/api/v1/artist')
  }

  async search(term: string, include: 'all' | 'artist' | 'album'): Promise<SearchResult[]> {
    const [existingArtists, artists, albums] = await Promise.all([
      this.getArtists(),
      include === 'album' ? Promise.resolve([]) : this.lookupArtists(term),
      include === 'artist' ? Promise.resolve([]) : this.lookupAlbums(term)
    ])

    const existingIds = new Set(existingArtists.map(artist => artist.foreignArtistId).filter(Boolean))
    const existingNames = new Set(existingArtists.map(artist => normalize(artist.artistName)))

    const artistResults = artists.slice(0, 12).map<SearchResult>(artist => ({
      id: artist.foreignArtistId ?? artist.artistName,
      type: 'artist',
      title: artist.artistName,
      subtitle: artist.disambiguation || artist.status || 'Artist',
      overview: artist.overview,
      imageUrl: imageUrl(artist.images),
      status:
        (artist.foreignArtistId && existingIds.has(artist.foreignArtistId)) ||
        existingNames.has(normalize(artist.artistName))
          ? 'available'
          : 'requestable',
      artist: {
        name: artist.artistName,
        foreignArtistId: artist.foreignArtistId
      },
      payload: artist
    }))

    const albumResults = albums.slice(0, 12).map<SearchResult>(album => {
      const artist = album.artist
      const available =
        artist &&
        ((artist.foreignArtistId && existingIds.has(artist.foreignArtistId)) ||
          existingNames.has(normalize(artist.artistName)))

      return {
        id: album.foreignAlbumId ?? `${album.artist?.artistName ?? 'album'}-${album.title}`,
        type: 'album',
        title: album.title,
        subtitle: artist?.artistName ?? 'Album',
        overview: album.overview || album.disambiguation,
        imageUrl: imageUrl(album.images) ?? imageUrl(artist?.images),
        year: album.releaseDate ? new Date(album.releaseDate).getFullYear() : undefined,
        status: available ? 'available' : 'requestable',
        artist: artist
          ? {
              name: artist.artistName,
              foreignArtistId: artist.foreignArtistId
            }
          : undefined,
        payload: album
      }
    })

    return [...artistResults, ...albumResults]
  }

  async requestArtist(artist: LidarrArtist): Promise<RequestResult> {
    const existing = await this.findExistingArtist(artist)

    if (existing?.id) {
      return {
        ok: true,
        status: 'already_exists',
        message: `${existing.artistName} is already in Lidarr.`,
        artistName: existing.artistName,
        lidarrArtistId: existing.id
      }
    }

    const config = await this.getAddConfig()
    const added = await this.post<LidarrArtist>('/api/v1/artist', {
      ...artist,
      monitored: true,
      rootFolderPath: config.rootFolderPath,
      qualityProfileId: config.qualityProfileId,
      metadataProfileId: config.metadataProfileId,
      addOptions: {
        monitor: 'all',
        searchForMissingAlbums: true
      }
    })

    return {
      ok: true,
      status: 'added',
      message: `${added.artistName} was added to Lidarr.`,
      artistName: added.artistName,
      lidarrArtistId: added.id
    }
  }

  async requestAlbum(album: LidarrAlbum): Promise<RequestResult> {
    if (!album.artist) {
      return {
        ok: false,
        status: 'failed',
        message: `Lidarr did not return an artist for ${album.title}.`
      }
    }

    const result = await this.requestArtist(album.artist)

    if (result.ok) {
      return {
        ...result,
        message:
          result.status === 'already_exists'
            ? `${album.title} maps to ${result.artistName}, which is already in Lidarr.`
            : `${album.title} was requested by adding ${result.artistName} to Lidarr.`
      }
    }

    return result
  }

  async requestArtistByName(name: string): Promise<RequestResult> {
    const [artist] = await this.lookupArtists(name)

    if (!artist) {
      return {
        ok: false,
        status: 'failed',
        message: `No Lidarr artist match found for ${name}.`,
        artistName: name
      }
    }

    return this.requestArtist(artist)
  }

  private async findExistingArtist(candidate: LidarrArtist) {
    const artists = await this.getArtists()

    return artists.find(artist => {
      if (candidate.foreignArtistId && artist.foreignArtistId === candidate.foreignArtistId) {
        return true
      }

      return normalize(artist.artistName) === normalize(candidate.artistName)
    })
  }

  private async getAddConfig() {
    const [rootFolders, qualityProfiles, metadataProfiles] = await Promise.all([
      this.get<RootFolder[]>('/api/v1/rootfolder'),
      this.get<Profile[]>('/api/v1/qualityprofile'),
      this.get<Profile[]>('/api/v1/metadataprofile')
    ])

    const rootFolderPath = rootFolders[0]?.path
    const qualityProfileId = qualityProfiles[0]?.id
    const metadataProfileId = metadataProfiles[0]?.id

    if (!rootFolderPath || !qualityProfileId || !metadataProfileId) {
      throw new Error('Lidarr is missing a root folder, quality profile, or metadata profile.')
    }

    return {
      rootFolderPath,
      qualityProfileId,
      metadataProfileId
    }
  }

  private async get<T>(path: string, searchParams?: Record<string, string>) {
    const url = new URL(`${this.baseUrl}${path}`)

    for (const [key, value] of Object.entries(searchParams ?? {})) {
      url.searchParams.set(key, value)
    }

    return this.fetchJson<T>(url)
  }

  private async post<T>(path: string, body: unknown) {
    return this.fetchJson<T>(new URL(`${this.baseUrl}${path}`), {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  private async fetchJson<T>(url: URL, init?: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
        ...init?.headers
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Lidarr ${response.status}: ${text || response.statusText}`)
    }

    return (await response.json()) as T
  }
}
