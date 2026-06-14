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
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const path = request.nextUrl.pathname

  // Sin sesión → login
  if (!session) {
    if (path.startsWith('/pos') || path.startsWith('/admin') || path.startsWith('/dashboard') || path.startsWith('/caja') || path.startsWith('/superadmin')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }

  // Con sesión → verificar rol y suscripción
  if (session) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol, es_superadmin, establecimiento_id, establecimientos(nombre, estado_cuenta, fecha_vencimiento, url_pago)')
      .eq('id', session.user.id)
      .single()

    if (usuario) {
      const estab = (usuario as any).establecimientos
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const venc = new Date(estab?.fecha_vencimiento + 'T00:00:00')
      const suspendido = estab?.estado_cuenta === 'suspendido' || hoy > venc

      // Suscripción vencida → redirigir
      if (suspendido && path.startsWith('/pos')) {
        const url = new URL('/suscripcion-vencida', request.url)
        url.searchParams.set('url', encodeURIComponent(estab?.url_pago ?? ''))
        url.searchParams.set('nombre', encodeURIComponent(estab?.nombre ?? ''))
        return NextResponse.redirect(url)
      }

      const rol = (usuario as any).rol
      const esSuperadmin = (usuario as any).es_superadmin

      // Cajero → solo puede acceder a /pos y /caja
      if (rol === 'cajero') {
        if (path.startsWith('/admin') || path.startsWith('/dashboard') || path.startsWith('/superadmin')) {
          return NextResponse.redirect(new URL('/pos', request.url))
        }
      }

      // Solo superadmin puede acceder a /superadmin
      if (path.startsWith('/superadmin') && !esSuperadmin) {
        return NextResponse.redirect(new URL('/pos', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/pos/:path*', '/admin/:path*', '/dashboard/:path*', '/caja/:path*', '/superadmin/:path*', '/login'],
}
