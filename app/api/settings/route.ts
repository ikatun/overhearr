import { getServerEnv } from '@/lib/env'
import { requireSession } from '@/lib/session'

function hostLabel(value: string) {
  try {
    const url = new URL(value)

    return {
      origin: url.origin,
      host: url.host,
      protocol: url.protocol.replace(':', '')
    }
  } catch {
    return {
      origin: value,
      host: value,
      protocol: 'unknown'
    }
  }
}

export async function GET() {
  await requireSession()

  const env = getServerEnv()

  return Response.json({
    app: {
      url: hostLabel(env.appUrl)
    },
    plex: {
      url: hostLabel(env.plexServerUrl),
      clientIdentifier: env.plexClientIdentifier
    },
    musicService: {
      url: hostLabel(env.lidarrUrl)
    }
  })
}
