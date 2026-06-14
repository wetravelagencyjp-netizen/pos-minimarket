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

  // Si no está logueado y quiere entrar al POS → login
  if (!session && request.nextUrl.pathname.startsWith('/pos')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Si está logueado, verificar estado de suscripción
  if (session && request.nextUrl.pathname.startsWith('/pos')) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('establecimiento_id, establecimientos(nombre, estado_cuenta, fecha_vencimiento, url_pago)')
      .eq('id', session.user.id)
      .single()

    if (usuario) {
      const estab = (usuario as any).establecimientos
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const venc = new Date(estab?.fecha_vencimiento + 'T00:00:00')
      const suspendido = estab?.estado_cuenta === 'suspendido' || hoy > venc

      if (suspendido) {
        const url = new URL('/suscripcion-vencida', request.url)
        url.searchParams.set('url', encodeURIComponent(estab?.url_pago ?? ''))
        url.searchParams.set('nombre', encodeURIComponent(estab?.nombre ?? ''))
        return NextResponse.redirect(url)
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/pos/:path*', '/login'],
}
