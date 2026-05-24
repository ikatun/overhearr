import { NextRequest } from 'next/server'

import { getServerEnv } from '@/lib/env'
import { requireSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  await requireSession()

  const path = request.nextUrl.searchParams.get('path')

  if (!path?.startsWith('/')) {
    return Response.json({ message: 'Missing image path.' }, { status: 400 })
  }

  const env = getServerEnv()
  const url = new URL(path, env.lidarrUrl)
  const response = await fetch(url, {
    headers: {
      'X-Api-Key': env.lidarrApiKey
    },
    cache: 'no-store'
  })

  if (!response.ok) {
    return Response.json({ message: 'Image not found.' }, { status: response.status })
  }

  return new Response(response.body, {
    headers: {
      'Cache-Control': 'private, max-age=3600',
      'Content-Type': response.headers.get('Content-Type') ?? 'image/jpeg'
    }
  })
}
