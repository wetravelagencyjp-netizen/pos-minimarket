import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Si no está logueado y quiere entrar al POS → redirigir a login
  if (!user && request.nextUrl.pathname.startsWith('/pos')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Si ya está logueado y va al login → redirigir al POS
  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/pos', request.url))
  }

  return response
}

export const config = {
  matcher: ['/pos/:path*', '/login'],
}
