import { redirect } from 'next/navigation'

import { OverhearrApp } from '@/components/overhearr-app'
import { getSession, toPublicUser } from '@/lib/session'
import type { SearchKind } from '@/types/lidarr'

type HomeProps = {
  searchParams: Promise<{
    q?: string
    tab?: string
    type?: string
  }>
}

function searchKind(value?: string): SearchKind {
  if (value === 'artist' || value === 'album') {
    return value
  }

  return 'all'
}

function activeTab(value?: string) {
  if (value === 'requests' || value === 'bulk' || value === 'settings') {
    return value
  }

  return 'search'
}

export default async function Home({ searchParams }: HomeProps) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const params = await searchParams

  return (
    <OverhearrApp
      initialFilter={searchKind(params.type)}
      initialQuery={params.q ?? ''}
      initialTab={activeTab(params.tab)}
      user={toPublicUser(session)}
    />
  )
}
