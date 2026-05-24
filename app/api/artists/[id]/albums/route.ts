import { NextRequest } from 'next/server'

import { requireSession } from '@/lib/session'
import { LidarrService } from '@/services/lidarr-service'

export async function GET(request: NextRequest, context: RouteContext<'/api/artists/[id]/albums'>) {
  await requireSession()

  const { id } = await context.params
  const name = request.nextUrl.searchParams.get('name') ?? undefined

  return Response.json(await new LidarrService().getArtistAlbums(id, name))
}
