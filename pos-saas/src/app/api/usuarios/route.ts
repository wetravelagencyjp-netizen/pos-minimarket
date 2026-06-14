import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  try {
    const { email, password, nombre, rol, establecimiento_id } = await request.json()

    if (!email || !password || !nombre || !rol || !establecimiento_id) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Crear usuario en auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Insertar en tabla usuarios
    const { error: dbError } = await supabaseAdmin.from('usuarios').insert({
      id: authData.user.id,
      establecimiento_id,
      nombre,
      rol,
      es_superadmin: false,
    })

    if (dbError) {
      // Si falla, eliminar el usuario de auth
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, id: authData.user.id })
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Falta el ID' }, { status: 400 })

    await supabaseAdmin.from('usuarios').delete().eq('id', id)
    await supabaseAdmin.auth.admin.deleteUser(id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
