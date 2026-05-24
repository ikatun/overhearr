import { requireSession } from '@/lib/session'
import { LidarrService } from '@/services/lidarr-service'
import type { BulkArtistResult } from '@/types/lidarr'

type BulkBody = {
  artists: string[]
}

export async function POST(request: Request) {
  await requireSession()

  const body = (await request.json()) as BulkBody
  const names = [...new Set((body.artists ?? []).map(name => name.trim()).filter(Boolean))]
  const lidarr = new LidarrService()
  const results: BulkArtistResult[] = []

  for (const name of names) {
    try {
      results.push({
        name,
        result: await lidarr.requestArtistByName(name)
      })
    } catch (error) {
      results.push({
        name,
        result: {
          ok: false,
          status: 'failed',
          artistName: name,
          message: error instanceof Error ? error.message : 'Unknown request failure.'
        }
      })
    }
  }

  return Response.json({ results })
}
