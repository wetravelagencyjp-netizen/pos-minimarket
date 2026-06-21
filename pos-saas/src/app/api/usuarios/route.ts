import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function obtenerSolicitanteAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return null

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null

  const { data: perfil } = await supabaseAdmin
    .from('usuarios')
    .select('rol, establecimiento_id')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'admin') return null
  return perfil
}

export async function POST(request: NextRequest) {
  try {
    const solicitante = await obtenerSolicitanteAdmin(request)
    if (!solicitante) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { email, password, nombre, rol } = await request.json()

    if (!email || !password || !nombre || !rol) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? 'No se pudo crear el usuario' }, { status: 400 })
    }

    // establecimiento_id SIEMPRE se toma del solicitante autenticado, nunca del body —
    // así un admin no puede crear usuarios en un establecimiento que no es el suyo.
    const { error: dbError } = await supabaseAdmin.from('usuarios').insert({
      id: authData.user.id,
      establecimiento_id: solicitante.establecimiento_id,
      nombre,
      rol,
      email,
      es_superadmin: false,
    })

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, id: authData.user.id })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const solicitante = await obtenerSolicitanteAdmin(request)
    if (!solicitante) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Falta el ID' }, { status: 400 })

    // Confirmar que el usuario a eliminar pertenece al MISMO establecimiento del solicitante.
    const { data: objetivo } = await supabaseAdmin
      .from('usuarios')
      .select('establecimiento_id, es_superadmin')
      .eq('id', id)
      .single()

    if (!objetivo || objetivo.establecimiento_id !== solicitante.establecimiento_id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (objetivo.es_superadmin) {
      return NextResponse.json({ error: 'No se puede eliminar un superadmin' }, { status: 403 })
    }

    await supabaseAdmin.from('usuarios').delete().eq('id', id)
    await supabaseAdmin.auth.admin.deleteUser(id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}