import { redirect } from 'next/navigation'

import { ArtistAlbumsPage } from '@/components/artist-albums-page'
import { getSession } from '@/lib/session'

type ArtistAlbumsRouteProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    name?: string
  }>
}

export default async function ArtistAlbumsRoute({ params, searchParams }: ArtistAlbumsRouteProps) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const { id } = await params
  const { name } = await searchParams

  return <ArtistAlbumsPage artistId={id} artistName={name} />
}
