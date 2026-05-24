import { getServerEnv } from '@/lib/env'
import type { AuthSession } from '@/types/auth'

type PlexPin = {
  id: number
  code: string
  authToken?: string | null
}

type PlexUser = {
  id: number
  uuid?: string
  username?: string
  title?: string
  email?: string
  thumb?: string
}

const plexProduct = 'Overhearr'
const plexVersion = '0.1.0'

function logPlexAuth(message: string, details?: Record<string, unknown>) {
  console.info('[PlexAuth]', message, details ?? '')
}

function logPlexAuthError(message: string, details?: Record<string, unknown>) {
  console.error('[PlexAuth]', message, details ?? '')
}

export class PlexService {
  private readonly env = getServerEnv()

  async createPin() {
    const url = new URL('https://plex.tv/api/v2/pins')
    url.searchParams.set('strong', 'true')

    return this.plexFetch<PlexPin>(url, {
      method: 'POST',
      headers: {
        Origin: this.env.appUrl
      }
    })
  }

  getAuthUrl(pin: PlexPin) {
    const forwardUrl = new URL('/api/auth/plex/callback', this.env.appUrl)
    forwardUrl.searchParams.set('pinId', String(pin.id))

    const params = new URLSearchParams({
      clientID: this.env.plexClientIdentifier,
      code: pin.code,
      forwardUrl: forwardUrl.toString(),
      'context[device][product]': plexProduct,
      'context[device][version]': plexVersion,
      'context[device][platform]': 'Web',
      'context[device][device]': 'Overhearr'
    })

    return `https://app.plex.tv/auth#?${params.toString()}`
  }

  async getPin(pinId: string) {
    return this.plexFetch<PlexPin>(new URL(`https://plex.tv/api/v2/pins/${pinId}`))
  }

  async createSessionFromPin(pinId: string): Promise<AuthSession> {
    logPlexAuth('reading completed Plex pin', { pinId })
    const pin = await this.getPin(pinId)

    if (!pin.authToken) {
      logPlexAuthError('pin did not contain an auth token', { pinId })
      throw new Error('Plex authentication was not completed.')
    }

    const user = await this.getUser(pin.authToken)
    logPlexAuth('Plex user authenticated', {
      plexUserId: String(user.uuid ?? user.id),
      username: user.username ?? user.title ?? user.email ?? 'Plex User'
    })

    await this.verifyServerAccess(pin.authToken)

    logPlexAuth('Plex access verification complete', {
      plexUserId: String(user.uuid ?? user.id)
    })

    return {
      plexUserId: String(user.uuid ?? user.id),
      username: user.username ?? user.title ?? user.email ?? 'Plex User',
      email: user.email,
      thumb: user.thumb,
      plexToken: pin.authToken,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365 * 100
    }
  }

  async getUser(token: string) {
    const url = new URL('https://plex.tv/api/v2/user')
    url.searchParams.set('X-Plex-Token', token)

    return this.plexFetch<PlexUser>(url)
  }

  async verifyServerAccess(token: string) {
    const identityUrl = new URL('/identity', this.env.plexServerUrl)
    identityUrl.searchParams.set('X-Plex-Token', token)

    logPlexAuth('checking Plex server identity', {
      plexServerUrl: this.env.plexServerUrl
    })

    const identityResponse = await fetch(identityUrl, { cache: 'no-store' })

    if (!identityResponse.ok) {
      logPlexAuthError('Plex server identity check failed', {
        status: identityResponse.status,
        statusText: identityResponse.statusText
      })
      throw new Error('Your Plex account does not have access to this Plex server.')
    }

    logPlexAuth('Plex server identity check passed', {
      status: identityResponse.status
    })

    const sectionsUrl = new URL('/library/sections', this.env.plexServerUrl)
    sectionsUrl.searchParams.set('X-Plex-Token', token)

    logPlexAuth('checking Plex library sections')

    const sectionsResponse = await fetch(sectionsUrl, { cache: 'no-store' })

    if (!sectionsResponse.ok) {
      logPlexAuthError('Plex library sections check failed', {
        status: sectionsResponse.status,
        statusText: sectionsResponse.statusText
      })
      throw new Error('Overhearr could not verify Plex library access.')
    }

    const sections = await sectionsResponse.text()

    if (!sections.includes('type="artist"') && !sections.includes('Plex Music Scanner')) {
      logPlexAuthError('Plex music library was not found in library sections')
      throw new Error('Your Plex account does not appear to have access to a music library.')
    }

    logPlexAuth('Plex music library check passed')
  }

  private async plexFetch<T>(url: URL, init?: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        'X-Plex-Product': plexProduct,
        'X-Plex-Version': plexVersion,
        'X-Plex-Client-Identifier': this.env.plexClientIdentifier,
        'X-Plex-Platform': 'Web',
        'X-Plex-Device': 'Overhearr',
        ...init?.headers
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Plex ${response.status}: ${text || response.statusText}`)
    }

    return (await response.json()) as T
  }
}
