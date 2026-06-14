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

  // Sin sesión → solo proteger rutas sensibles
  if (!session) {
    if (path.startsWith('/admin') || path.startsWith('/dashboard') || path.startsWith('/caja') || path.startsWith('/superadmin')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }

  // Con sesión → verificar rol
  if (session && (path.startsWith('/admin') || path.startsWith('/dashboard') || path.startsWith('/superadmin'))) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol, es_superadmin')
      .eq('id', session.user.id)
      .single()

    if (usuario) {
      const rol = (usuario as any).rol
      const esSuperadmin = (usuario as any).es_superadmin

      if (rol === 'cajero') {
        return NextResponse.redirect(new URL('/pos', request.url))
      }

      if (path.startsWith('/superadmin') && !esSuperadmin) {
        return NextResponse.redirect(new URL('/pos', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/caja/:path*', '/superadmin/:path*', '/login'],
}
