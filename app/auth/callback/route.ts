import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // User cancelled or there was an error
  if (error) {
    const url = new URL('/auth/login', origin)
    url.searchParams.set('message', errorDescription || 'Login was cancelled or failed. Please try again.')
    return NextResponse.redirect(url)
  }

  const next = searchParams.get('next')

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError) {
      // Safe redirect validation: accept only relative paths starting with /join/ to avoid open redirects
      const safeNext = next && next.startsWith('/join/') && !next.includes('//') ? next : '/'
      return NextResponse.redirect(new URL(safeNext, origin))
    }
  }

  // Something went wrong
  const url = new URL('/auth/login', origin)
  url.searchParams.set('message', 'Login failed. Please try again.')
  return NextResponse.redirect(url)
}
