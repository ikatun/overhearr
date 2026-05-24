import { getServerEnv } from '@/lib/env'
import type { LidarrAlbum, LidarrArtist, RequestResult, SearchResult } from '@/types/lidarr'

type RootFolder = {
  path: string
}

type Profile = {
  id: number
  name: string
}

function imageUrl(baseUrl: string, images?: { coverType?: string; remoteUrl?: string; url?: string }[]) {
  const orderedImages = [
    ...(images?.filter(image => image.coverType === 'poster') ?? []),
    ...(images?.filter(image => image.coverType === 'cover') ?? []),
    ...(images?.filter(image => image.coverType === 'headshot') ?? []),
    ...(images?.filter(image => image.coverType !== 'fanart') ?? []),
    ...(images ?? [])
  ]
  const selectedImage = orderedImages.find(image => image.remoteUrl || image.url)
  const rawUrl =
    selectedImage?.remoteUrl?.startsWith('http://') || selectedImage?.remoteUrl?.startsWith('https://')
      ? selectedImage.remoteUrl
      : (selectedImage?.url ?? selectedImage?.remoteUrl)

  if (!rawUrl) {
    return undefined
  }

  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl
  }

  const lidarrUrl = new URL(rawUrl, baseUrl)

  return `/api/lidarr/image?path=${encodeURIComponent(`${lidarrUrl.pathname}${lidarrUrl.search}`)}`
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

  async getAlbums(): Promise<LidarrAlbum[]> {
    return this.get<LidarrAlbum[]>('/api/v1/album')
  }

  async browse(include: 'all' | 'artist' | 'album'): Promise<SearchResult[]> {
    const [artists, albums] = await Promise.all([
      include === 'album' ? Promise.resolve([]) : this.getArtists(),
      include === 'artist' ? Promise.resolve([]) : this.getAlbums()
    ])

    const artistResults = artists.slice(0, 40).map<SearchResult>(artist => ({
      id: artist.foreignArtistId ?? String(artist.id ?? artist.artistName),
      type: 'artist',
      title: artist.artistName,
      subtitle: artist.disambiguation || artist.status || 'Artist',
      overview: artist.overview,
      imageUrl: imageUrl(this.baseUrl, artist.images),
      status: 'available',
      artist: {
        name: artist.artistName,
        id: artist.id,
        foreignArtistId: artist.foreignArtistId
      },
      payload: artist
    }))

    const albumResults = albums.slice(0, 40).map<SearchResult>(album => ({
      id: album.foreignAlbumId ?? String(album.id ?? `${album.artist?.artistName ?? 'album'}-${album.title}`),
      type: 'album',
      title: album.title,
      subtitle: album.artist?.artistName ?? 'Album',
      overview: album.overview || album.disambiguation,
      imageUrl: imageUrl(this.baseUrl, album.images) ?? imageUrl(this.baseUrl, album.artist?.images),
      year: album.releaseDate ? new Date(album.releaseDate).getFullYear() : undefined,
      status: 'available',
      artist: album.artist
        ? {
            name: album.artist.artistName,
            id: album.artist.id,
            foreignArtistId: album.artist.foreignArtistId
          }
        : undefined,
      payload: album
    }))

    return [...artistResults, ...albumResults]
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
      imageUrl: imageUrl(this.baseUrl, artist.images),
      status:
        (artist.foreignArtistId && existingIds.has(artist.foreignArtistId)) ||
        existingNames.has(normalize(artist.artistName))
          ? 'available'
          : 'requestable',
      artist: {
        name: artist.artistName,
        id: artist.id,
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
        imageUrl: imageUrl(this.baseUrl, album.images) ?? imageUrl(this.baseUrl, artist?.images),
        year: album.releaseDate ? new Date(album.releaseDate).getFullYear() : undefined,
        status: available ? 'available' : 'requestable',
        artist: artist
          ? {
              name: artist.artistName,
              id: artist.id,
              foreignArtistId: artist.foreignArtistId
            }
          : undefined,
        payload: album
      }
    })

    return [...artistResults, ...albumResults]
  }

  async getArtistAlbums(
    identifier: string,
    artistName?: string
  ): Promise<{ artist: SearchResult; albums: SearchResult[] }> {
    const artists = await this.getArtists()
    const artist = artists.find(item => String(item.id) === identifier || item.foreignArtistId === identifier)

    if (!artist && !artistName) {
      throw new Error('Artist not found.')
    }

    const lookupArtist = artist
      ? undefined
      : ((await this.lookupArtists(artistName ?? identifier)).find(item => item.foreignArtistId === identifier) ??
        (await this.lookupArtists(artistName ?? identifier))[0])

    const resolvedArtist = artist ?? lookupArtist

    if (!resolvedArtist) {
      throw new Error('Artist not found.')
    }

    const albums = artist ? await this.getAlbums() : await this.lookupAlbums(resolvedArtist.artistName)
    const artistAlbums = albums
      .filter(
        album =>
          album.artistId === resolvedArtist.id ||
          album.artist?.foreignArtistId === resolvedArtist.foreignArtistId ||
          normalize(album.artist?.artistName ?? '') === normalize(resolvedArtist.artistName)
      )
      .map<SearchResult>(album => ({
        id: album.foreignAlbumId ?? String(album.id ?? `${resolvedArtist.artistName}-${album.title}`),
        type: 'album',
        title: album.title,
        subtitle: resolvedArtist.artistName,
        overview: album.overview || album.disambiguation,
        imageUrl: imageUrl(this.baseUrl, album.images) ?? imageUrl(this.baseUrl, resolvedArtist.images),
        year: album.releaseDate ? new Date(album.releaseDate).getFullYear() : undefined,
        status: artist ? 'available' : 'requestable',
        artist: {
          name: resolvedArtist.artistName,
          id: resolvedArtist.id,
          foreignArtistId: resolvedArtist.foreignArtistId
        },
        payload: album
      }))

    return {
      artist: {
        id: resolvedArtist.foreignArtistId ?? String(resolvedArtist.id ?? resolvedArtist.artistName),
        type: 'artist',
        title: resolvedArtist.artistName,
        subtitle: resolvedArtist.disambiguation || resolvedArtist.status || 'Artist',
        overview: resolvedArtist.overview,
        imageUrl: imageUrl(this.baseUrl, resolvedArtist.images),
        status: artist ? 'available' : 'requestable',
        artist: {
          name: resolvedArtist.artistName,
          id: resolvedArtist.id,
          foreignArtistId: resolvedArtist.foreignArtistId
        },
        payload: resolvedArtist
      },
      albums: artistAlbums
    }
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
