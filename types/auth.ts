export type AuthSession = {
  plexUserId: string
  username: string
  email?: string
  thumb?: string
  plexToken: string
  expiresAt: number
}

export type PublicUser = {
  username: string
  email?: string
  thumb?: string
}
