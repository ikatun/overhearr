import { redirect } from 'next/navigation'

import { OverhearrApp } from '@/components/overhearr-app'
import { getSession, toPublicUser } from '@/lib/session'

export default async function Home() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return <OverhearrApp user={toPublicUser(session)} />
}
