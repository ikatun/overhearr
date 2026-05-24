import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { PLEX_PIN_COOKIE } from '@/lib/session'
import { PlexService } from '@/services/plex-service'

export async function GET() {
  const plex = new PlexService()
  const pin = await plex.createPin()
  const cookieStore = await cookies()

  cookieStore.set(PLEX_PIN_COOKIE, String(pin.id), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60
  })

  return NextResponse.redirect(plex.getAuthUrl(pin))
}
