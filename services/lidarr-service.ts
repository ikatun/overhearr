import { getServerEnv } from '@/lib/env'
import type {
  AlbumDetailsResponse,
  LidarrAlbum,
  LidarrArtist,
  LidarrTrack,
  RequestResult,
  SearchResult
} from '@/types/lidarr'

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

function albumStatus(album: LidarrAlbum, isKnown: boolean): SearchResult['status'] {
  if (!isKnown) {
    return 'requestable'
  }

  const percentOfTracks = album.statistics?.percentOfTracks ?? 0
  const trackFileCount = album.statistics?.trackFileCount ?? 0
  const trackCount = album.statistics?.trackCount ?? album.statistics?.totalTrackCount ?? 0

  if (percentOfTracks >= 100 || (trackCount > 0 && trackFileCount >= trackCount)) {
    return 'available'
  }

  if (trackFileCount > 0 || percentOfTracks > 0) {
    return 'partial'
  }

  if (album.monitored) {
    return 'requested'
  }

  return 'requestable'
}

function albumSearchResult(
  baseUrl: string,
  album: LidarrAlbum,
  isKnown: boolean,
  fallbackArtist?: LidarrArtist
): SearchResult {
  const artist = album.artist ?? fallbackArtist

  return {
    id: album.foreignAlbumId ?? String(album.id ?? `${artist?.artistName ?? 'album'}-${album.title}`),
    type: 'album',
    title: album.title,
    subtitle: artist?.artistName ?? 'Album',
    overview: album.overview || album.disambiguation,
    imageUrl: imageUrl(baseUrl, album.images) ?? imageUrl(baseUrl, artist?.images),
    year: album.releaseDate ? new Date(album.releaseDate).getFullYear() : undefined,
    status: albumStatus(album, isKnown),
    artist: artist
      ? {
          name: artist.artistName,
          id: artist.id,
          foreignArtistId: artist.foreignArtistId
        }
      : undefined,
    payload: album
  }
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

  async getTracks(albumId: number): Promise<LidarrTrack[]> {
    const tracks = await this.get<LidarrTrack[]>('/api/v1/track', { albumId: String(albumId) })

    return tracks.sort((left, right) => {
      return (
        (left.mediumNumber ?? 0) - (right.mediumNumber ?? 0) ||
        (left.absoluteTrackNumber ?? 0) - (right.absoluteTrackNumber ?? 0) ||
        (left.trackNumber ?? '').localeCompare(right.trackNumber ?? '') ||
        left.title.localeCompare(right.title)
      )
    })
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
      status: albumStatus(album, true),
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
    const [existingArtists, existingAlbums, artists, albums] = await Promise.all([
      this.getArtists(),
      include === 'artist' ? Promise.resolve([]) : this.getAlbums(),
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
      const existingAlbum = existingAlbums.find(existing => {
        if (album.foreignAlbumId && existing.foreignAlbumId === album.foreignAlbumId) {
          return true
        }

        return (
          normalize(existing.title) === normalize(album.title) &&
          normalize(existing.artist?.artistName ?? '') === normalize(artist?.artistName ?? '')
        )
      })

      return {
        id: album.foreignAlbumId ?? `${album.artist?.artistName ?? 'album'}-${album.title}`,
        type: 'album',
        title: album.title,
        subtitle: artist?.artistName ?? 'Album',
        overview: album.overview || album.disambiguation,
        imageUrl: imageUrl(this.baseUrl, album.images) ?? imageUrl(this.baseUrl, artist?.images),
        year: album.releaseDate ? new Date(album.releaseDate).getFullYear() : undefined,
        status: existingAlbum ? albumStatus(existingAlbum, true) : available ? 'requestable' : 'requestable',
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
        status: albumStatus(album, Boolean(artist)),
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

  async getAlbumDetails(identifier: string, title?: string, artistName?: string): Promise<AlbumDetailsResponse> {
    const albums = await this.getAlbums()
    const existingAlbum = albums.find(album => {
      if (String(album.id) === identifier || album.foreignAlbumId === identifier) {
        return true
      }

      if (!title) {
        return false
      }

      return (
        normalize(album.title) === normalize(title) &&
        (!artistName || normalize(album.artist?.artistName ?? '') === normalize(artistName))
      )
    })

    if (existingAlbum) {
      return {
        album: albumSearchResult(this.baseUrl, existingAlbum, true),
        tracks: existingAlbum.id ? await this.getTracks(existingAlbum.id) : []
      }
    }

    if (!title && !artistName) {
      throw new Error('Album not found.')
    }

    const lookupTerm = [artistName, title ?? identifier].filter(Boolean).join(' ')
    const lookupAlbum = (await this.lookupAlbums(lookupTerm)).find(album => {
      if (album.foreignAlbumId === identifier) {
        return true
      }

      if (!title) {
        return false
      }

      return (
        normalize(album.title) === normalize(title) &&
        (!artistName || normalize(album.artist?.artistName ?? '') === normalize(artistName))
      )
    })

    if (!lookupAlbum) {
      throw new Error('Album not found.')
    }

    return {
      album: albumSearchResult(this.baseUrl, lookupAlbum, false),
      tracks: []
    }
  }

  async requestArtist(artist: LidarrArtist): Promise<RequestResult> {
    const existing = await this.findExistingArtist(artist)

    if (existing?.id) {
      const albums = await this.getAlbums()
      const artistAlbums = albums.filter(album => this.albumBelongsToArtist(album, existing))
      const albumsToMonitor = artistAlbums.filter(album => !album.monitored && album.id)
      const albumsToSearch = artistAlbums.filter(album => album.id && albumStatus(album, true) !== 'available')

      if (!existing.monitored) {
        await this.put<LidarrArtist>(`/api/v1/artist/${existing.id}`, {
          ...existing,
          monitored: true,
          monitorNewItems: 'all'
        })
      }

      await Promise.all(
        albumsToMonitor.map(album =>
          this.put<LidarrAlbum>(`/api/v1/album/${album.id}`, {
            ...album,
            monitored: true
          })
        )
      )

      await this.triggerAlbumSearch(albumsToSearch.map(album => album.id).filter((id): id is number => Boolean(id)))

      return {
        ok: true,
        status: 'added',
        message: `${existing.artistName} albums were requested.`,
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
      message: `${added.artistName} was requested.`,
      artistName: added.artistName,
      lidarrArtistId: added.id
    }
  }

  async requestAlbum(album: LidarrAlbum): Promise<RequestResult> {
    if (!album.artist) {
      return {
        ok: false,
        status: 'failed',
        message: `No artist was returned for ${album.title}.`
      }
    }

    const { artist, created } = await this.ensureArtistForAlbumRequest(album.artist)
    const requestedAlbum = await this.findExistingAlbumWithRetry(album, created ? 10 : 2)

    if (!requestedAlbum?.id) {
      return {
        ok: false,
        status: 'failed',
        message: `${album.title} was not found after adding ${artist.artistName}.`,
        artistName: artist.artistName,
        lidarrArtistId: artist.id
      }
    }

    const monitoredAlbum = requestedAlbum.monitored
      ? requestedAlbum
      : await this.put<LidarrAlbum>(`/api/v1/album/${requestedAlbum.id}`, {
          ...requestedAlbum,
          monitored: true
        })

    await this.triggerAlbumSearch(monitoredAlbum.id)

    return {
      ok: true,
      status: 'added',
      message: `${monitoredAlbum.title} was requested.`,
      artistName: artist.artistName,
      lidarrArtistId: artist.id
    }
  }

  async requestArtistByName(name: string): Promise<RequestResult> {
    const [artist] = await this.lookupArtists(name)

    if (!artist) {
      return {
        ok: false,
        status: 'failed',
        message: `No artist match found for ${name}.`,
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

  private albumBelongsToArtist(album: LidarrAlbum, artist: LidarrArtist) {
    if (artist.id && album.artistId === artist.id) {
      return true
    }

    if (artist.foreignArtistId && album.artist?.foreignArtistId === artist.foreignArtistId) {
      return true
    }

    return normalize(album.artist?.artistName ?? '') === normalize(artist.artistName)
  }

  private async ensureArtistForAlbumRequest(candidate: LidarrArtist) {
    const existing = await this.findExistingArtist(candidate)

    if (existing) {
      return { artist: existing, created: false }
    }

    const config = await this.getAddConfig()

    const artist = await this.post<LidarrArtist>('/api/v1/artist', {
      ...candidate,
      monitored: false,
      rootFolderPath: config.rootFolderPath,
      qualityProfileId: config.qualityProfileId,
      metadataProfileId: config.metadataProfileId,
      addOptions: {
        monitor: 'none',
        searchForMissingAlbums: false
      }
    })

    return { artist, created: true }
  }

  private async findExistingAlbum(candidate: LidarrAlbum) {
    const albums = await this.getAlbums()

    return albums.find(album => {
      if (candidate.foreignAlbumId && album.foreignAlbumId === candidate.foreignAlbumId) {
        return true
      }

      return (
        normalize(album.title) === normalize(candidate.title) &&
        normalize(album.artist?.artistName ?? '') === normalize(candidate.artist?.artistName ?? '')
      )
    })
  }

  private async findExistingAlbumWithRetry(candidate: LidarrAlbum, attempts: number) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const album = await this.findExistingAlbum(candidate)

      if (album) {
        return album
      }

      if (attempt < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return undefined
  }

  private async triggerAlbumSearch(albumIds?: number | number[]) {
    const ids = Array.isArray(albumIds) ? albumIds : albumIds ? [albumIds] : []

    if (!ids.length) return

    await this.post('/api/v1/command', {
      name: 'AlbumSearch',
      albumIds: ids
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

  private async put<T>(path: string, body: unknown) {
    return this.fetchJson<T>(new URL(`${this.baseUrl}${path}`), {
      method: 'PUT',
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
