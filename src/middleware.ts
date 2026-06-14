import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// ----------------------------------------------------------------
// Middleware de Next.js — se ejecuta en el Edge antes de cada página
// Protege /pos: si no hay sesión → /login
// La verificación de suscripción la hace AuthContext en el cliente
// (más confiable porque puede usar datos frescos de Supabase)
// ----------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Rutas protegidas
  const rutasProtegidas = ['/pos', '/reportes', '/inventario']
  const esRutaProtegida = rutasProtegidas.some(r => request.nextUrl.pathname.startsWith(r))

  if (esRutaProtegida && !session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Si ya está logueado y va a /login → redirigir al POS
  if (request.nextUrl.pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/pos', request.url))
  }

  return response
}

export const config = {
  matcher: ['/pos/:path*', '/login', '/reportes/:path*', '/inventario/:path*'],
}
