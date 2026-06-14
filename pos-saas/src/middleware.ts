import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const path = request.nextUrl.pathname

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Sin sesión → proteger rutas
  if (!session) {
    if (path.startsWith('/admin') || path.startsWith('/dashboard') || path.startsWith('/caja') || path.startsWith('/superadmin')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }

  // Cajero → solo POS y caja
  if (session && (path.startsWith('/admin') || path.startsWith('/dashboard'))) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', session.user.id)
      .single()

    if (usuario && (usuario as any).rol === 'cajero') {
      return NextResponse.redirect(new URL('/pos', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/caja/:path*', '/superadmin/:path*'],
}
