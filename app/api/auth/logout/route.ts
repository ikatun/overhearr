import { NextResponse } from 'next/server'

import { getServerEnv } from '@/lib/env'
import { SESSION_COOKIE } from '@/lib/session'

export async function POST() {
  const response = NextResponse.redirect(new URL('/login', getServerEnv().appUrl))

  response.cookies.delete(SESSION_COOKIE)

  return response
}
