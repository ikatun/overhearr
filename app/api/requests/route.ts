import { requireSession } from '@/lib/session'
import { LidarrService } from '@/services/lidarr-service'
import type { LidarrAlbum, LidarrArtist } from '@/types/lidarr'

type RequestBody =
  | {
      type: 'artist'
      payload: LidarrArtist
    }
  | {
      type: 'album'
      payload: LidarrAlbum
    }

export async function POST(request: Request) {
  await requireSession()

  const body = (await request.json()) as RequestBody
  const lidarr = new LidarrService()

  if (body.type === 'artist') {
    return Response.json(await lidarr.requestArtist(body.payload))
  }

  if (body.type === 'album') {
    return Response.json(await lidarr.requestAlbum(body.payload))
  }

  return Response.json({ ok: false, status: 'failed', message: 'Unsupported request type.' }, { status: 400 })
}
