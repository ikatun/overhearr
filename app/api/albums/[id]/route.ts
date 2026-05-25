import { NextRequest } from 'next/server'

import { requireSession } from '@/lib/session'
import { LidarrService } from '@/services/lidarr-service'

export async function GET(request: NextRequest, context: RouteContext<'/api/albums/[id]'>) {
  await requireSession()

  const { id } = await context.params
  const title = request.nextUrl.searchParams.get('title') ?? undefined
  const artist = request.nextUrl.searchParams.get('artist') ?? undefined

  return Response.json(await new LidarrService().getAlbumDetails(id, title, artist))
}
