export type SearchKind = 'all' | 'artist' | 'album'

export type RequestKind = 'artist' | 'album'

export type SearchResult = {
  id: string
  type: 'artist' | 'album'
  title: string
  subtitle?: string
  overview?: string
  imageUrl?: string
  year?: number
  status: 'available' | 'partial' | 'requested' | 'requestable' | 'external'
  artist?: {
    name: string
    id?: number
    foreignArtistId?: string
  }
  payload: unknown
}

export type RequestResult = {
  ok: boolean
  status: 'added' | 'already_exists' | 'failed'
  message: string
  artistName?: string
  lidarrArtistId?: number
}

export type BulkArtistResult = {
  name: string
  result: RequestResult
}

export type LidarrImage = {
  coverType?: string
  url?: string
  remoteUrl?: string
}

export type LidarrArtist = {
  id?: number
  artistName: string
  sortName?: string
  foreignArtistId?: string
  overview?: string
  disambiguation?: string
  status?: string
  path?: string
  monitored?: boolean
  images?: LidarrImage[]
  addOptions?: Record<string, unknown>
  rootFolderPath?: string
  qualityProfileId?: number
  metadataProfileId?: number
}

export type LidarrAlbum = {
  id?: number
  title: string
  foreignAlbumId?: string
  releaseDate?: string
  disambiguation?: string
  overview?: string
  monitored?: boolean
  artist?: LidarrArtist
  artistId?: number
  images?: LidarrImage[]
  statistics?: {
    trackFileCount?: number
    trackCount?: number
    totalTrackCount?: number
    sizeOnDisk?: number
    percentOfTracks?: number
  }
}

export type LidarrTrack = {
  id?: number
  artistId?: number
  albumId?: number
  foreignTrackId?: string
  foreignRecordingId?: string
  trackFileId?: number
  explicit?: boolean
  absoluteTrackNumber?: number
  trackNumber?: string
  title: string
  duration?: number
  mediumNumber?: number
  hasFile?: boolean
  ratings?: {
    votes?: number
    value?: number
  }
}

export type ArtistAlbumsResponse = {
  artist: SearchResult
  albums: SearchResult[]
}

export type AlbumDetailsResponse = {
  album: SearchResult
  tracks: LidarrTrack[]
}
