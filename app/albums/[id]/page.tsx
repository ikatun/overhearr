import { redirect } from 'next/navigation'

import { AlbumDetailsPage } from '@/components/album-details-page'
import { getSession } from '@/lib/session'

type AlbumDetailsRouteProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    artist?: string
    from?: string
    title?: string
  }>
}

export default async function AlbumDetailsRoute({ params, searchParams }: AlbumDetailsRouteProps) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const { id } = await params
  const { artist, from, title } = await searchParams

  return <AlbumDetailsPage albumId={id} albumTitle={title} artistName={artist} backHref={from ?? '/'} />
}
