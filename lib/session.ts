import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

import { getServerEnv } from '@/lib/env'
import type { AuthSession, PublicUser } from '@/types/auth'

export const SESSION_COOKIE = 'overhearr_session'
export const PLEX_PIN_COOKIE = 'overhearr_plex_pin'

const oneHundredYears = 60 * 60 * 24 * 365 * 100

function base64Url(value: Buffer | string) {
  return Buffer.from(value).toString('base64url')
}

function sign(value: string) {
  return createHmac('sha256', getServerEnv().sessionSecret).update(value).digest('base64url')
}

export function createSessionCookie(session: AuthSession) {
  const payload = base64Url(JSON.stringify(session))
  const signature = sign(payload)

  return `${payload}.${signature}`
}

export function verifySessionCookie(value?: string): AuthSession | null {
  if (!value) return null

  const [payload, signature] = value.split('.')

  if (!payload || !signature) return null

  const expected = sign(payload)
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)

  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AuthSession

    if (session.expiresAt < Date.now()) {
      return null
    }

    return session
  } catch {
    return null
  }
}

export async function getSession() {
  const cookieStore = await cookies()

  return verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value)
}

export async function requireSession() {
  const session = await getSession()

  if (!session) {
    throw new Error('Authentication required.')
  }

  return session
}

export function toPublicUser(session: AuthSession): PublicUser {
  return {
    username: session.username,
    email: session.email,
    thumb: session.thumb
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: getServerEnv().appUrl.startsWith('https://'),
    path: '/',
    maxAge: oneHundredYears
  }
}
