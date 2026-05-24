# Music Request Platform — Project Description

## Overview

Build a self-hosted music request platform for a Plex/Lidarr/Soularr ecosystem.

The application should allow users to:

- Login with their Plex account
- Verify they already have access to the Plex server/music library
- Search for artists/albums
- Request artists
- Automatically add artists to Lidarr
- Let Lidarr + Soularr + slskd handle acquisition automatically
- Surface request state and availability cleanly

The app should feel like:
- Overseerr for music
- lightweight
- modern
- music-focused
- social/community-friendly

---

# Core Stack

## Frontend / Backend

- Next.js (latest stable)
- TypeScript
- App Router
- TailwindCSS
- shadcn/ui

## Architecture Style

Even though this is Next.js, backend logic should be structured cleanly:

- services
- dependency injection style
- separation of concerns
- typed API clients
- no spaghetti route handlers

Suggested structure:

```txt
src/
  app/
  components/
  services/
  lib/
  auth/
  types/
```

---

# Authentication

## Plex Authentication

Users should login using Plex authentication.

Preferred approach:
- Plex PIN auth flow

Requirements:
- No local username/password accounts
- Only Plex-authenticated users allowed
- Verify users have access to the Plex server/music library

Potential future support:
- Admin role
- User permissions
- Request limits

---

# Integrations

## Lidarr

The application should communicate with Lidarr API.

Primary actions:
- artist lookup
- add artist
- monitor artist
- trigger search

Relevant endpoints:

```txt
/api/v1/artist/lookup
/api/v1/artist
```

Authentication:
- X-Api-Key header

API key must remain server-side only.

---

# Request Flow

## Artist Request

Flow:

1. User searches artist
2. App checks if artist already exists in Lidarr
3. If missing:
   - add artist
   - monitor all albums
   - search automatically
4. Show request status to user

---

# Future Features

Potential roadmap items:

## Spotify Integration

- Import Spotify playlist
- Extract artists
- Bulk-add artists to Lidarr

## Plexamp Integration

- Deep links into Plexamp
- Recently added
- Trending artists

## Discovery

- Similar artists
- Recently requested
- Most requested artists

## Social Features

- Request history
- Voting
- Activity feed
- Shared discovery

---

# UI / UX Goals

The application should feel:

- fast
- minimal
- music-focused
- self-hosted polished
- closer to Overseerr than Ombi

Avoid:
- clutter
- enterprise admin feel
- Arr-stack complexity leaking into UX

---

# Technical Philosophy

The backend should be:

- lightweight
- service-oriented
- explicit
- easy to reason about

Avoid:
- unnecessary framework magic
- overengineering
- microservices
- CQRS/event sourcing

This is fundamentally:
- an orchestration layer
- a social/request UX
- not a massive backend platform

---

# Suggested Service Layer

Example services:

```txt
PlexService
LidarrService
RequestService
SpotifyService
AuthService
```

---

# Suggested MVP Scope

## MVP Includes

- Plex login
- Verify Plex access
- Artist search
- Artist request
- Lidarr integration
- Request status
- Clean UI

## MVP Excludes

- Complex social features
- Recommendation engine
- Notifications
- Mobile app
- Queue workers
- Advanced analytics

---

# Deployment

Target deployment:
- Docker
- self-hosted
- reverse proxied
- homelab friendly

Should work well behind:
- Nginx Proxy Manager
- Traefik
- Cloudflare Tunnel

---

# Important Context

The backend ecosystem already exists:

- Plex
- Plexamp
- Lidarr
- Soularr
- slskd

This application is primarily:
- the social/request layer
- the UX layer
- the orchestration layer

NOT the acquisition engine itself.
