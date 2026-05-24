import './globals.css'

import type { Metadata } from 'next'

import { QueryProvider } from '@/components/query-provider'

export const metadata: Metadata = {
  title: 'Overhearr',
  description: 'Music requests for Plex'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
