import { redirect } from 'next/navigation'

import { getSession } from '@/lib/session'

type LoginPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession()

  if (session) {
    redirect('/')
  }

  const params = await searchParams

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#101724] text-white">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-35"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=2200&q=80')"
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.18),rgba(15,23,42,0.9)_70%),linear-gradient(to_bottom,rgba(15,23,42,0.36),#111827)]" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center px-5 pt-24 text-center sm:pt-32">
        <div className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-violet-300 via-violet-500 to-indigo-600 shadow-2xl shadow-violet-950/60">
          <div className="h-12 w-12 rounded-full border-[12px] border-[#101827] border-t-white" />
        </div>
        <h1 className="mt-5 text-6xl font-semibold tracking-tight sm:text-7xl">overhearr</h1>
        <h2 className="mt-10 text-3xl font-bold tracking-tight">Sign in to continue</h2>

        <div className="mt-8 w-full max-w-md overflow-hidden rounded-md bg-slate-800/90 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="border-b border-slate-700/60 bg-slate-800 px-5 py-3 text-sm font-bold text-violet-400">
            Use your Plex account
          </div>
          <div className="px-10 py-8">
            <a
              className="flex h-12 w-full items-center justify-center gap-3 rounded-md bg-[#d9830f] text-sm font-bold text-white shadow-lg shadow-black/30 transition hover:bg-[#e89218]"
              href="/api/auth/plex/start"
            >
              <span className="text-lg">↪</span>
              Sign In
            </a>
          </div>
        </div>

        {params.error ? (
          <div className="mt-5 max-w-md rounded-md border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-100">
            {decodeURIComponent(params.error)}
          </div>
        ) : null}
      </section>
    </main>
  )
}
