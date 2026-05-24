import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { createSessionCookie, PLEX_PIN_COOKIE, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session'
import { PlexService } from '@/services/plex-service'

function loginErrorUrl(request: NextRequest, message: string) {
  const url = new URL('/login', request.url)
  url.searchParams.set('error', message)

  return url
}

export async function GET(request: NextRequest) {
  const pinId = request.nextUrl.searchParams.get('pinId')
  const cookieStore = await cookies()
  const expectedPinId = cookieStore.get(PLEX_PIN_COOKIE)?.value

  if (!pinId || pinId !== expectedPinId) {
    return NextResponse.redirect(loginErrorUrl(request, 'The Plex sign-in request expired. Please try again.'))
  }

  try {
    const session = await new PlexService().createSessionFromPin(pinId)
    const response = NextResponse.redirect(new URL('/', request.url))

    response.cookies.set(SESSION_COOKIE, createSessionCookie(session), sessionCookieOptions())
    response.cookies.delete(PLEX_PIN_COOKIE)

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Plex sign-in failed.'

    return NextResponse.redirect(loginErrorUrl(request, message))
  }
}
