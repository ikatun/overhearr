type ServerEnv = {
  lidarrUrl: string
  lidarrApiKey: string
  plexServerUrl: string
  plexClientIdentifier: string
  appUrl: string
  sessionSecret: string
}

function required(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export function getServerEnv(): ServerEnv {
  return {
    lidarrUrl: required('LIDARR_URL').replace(/\/$/, ''),
    lidarrApiKey: required('LIDARR_API_KEY'),
    plexServerUrl: required('PLEX_SERVER_URL').replace(/\/$/, ''),
    plexClientIdentifier: required('PLEX_CLIENT_IDENTIFIER'),
    appUrl: required('APP_URL').replace(/\/$/, ''),
    sessionSecret: required('SESSION_SECRET')
  }
}
