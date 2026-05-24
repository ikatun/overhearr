import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { getServerEnv } from '@/lib/env'
import { createSessionCookie, PLEX_PIN_COOKIE, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session'
import { PlexService } from '@/services/plex-service'

function appUrl(path: string) {
  return new URL(path, getServerEnv().appUrl)
}

function loginErrorUrl(message: string) {
  const url = appUrl('/login')
  url.searchParams.set('error', message)

  return url
}

export async function GET(request: NextRequest) {
  const pinId = request.nextUrl.searchParams.get('pinId')
  const cookieStore = await cookies()
  const expectedPinId = cookieStore.get(PLEX_PIN_COOKIE)?.value

  if (!pinId || pinId !== expectedPinId) {
    return NextResponse.redirect(loginErrorUrl('The Plex sign-in request expired. Please try again.'))
  }

  try {
    const session = await new PlexService().createSessionFromPin(pinId)
    const response = NextResponse.redirect(appUrl('/'))

    response.cookies.set(SESSION_COOKIE, createSessionCookie(session), sessionCookieOptions())
    response.cookies.delete(PLEX_PIN_COOKIE)

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Plex sign-in failed.'

    console.error('[PlexAuth] callback failed', {
      message,
      pinId
    })

    return NextResponse.redirect(loginErrorUrl(message))
  }
}
