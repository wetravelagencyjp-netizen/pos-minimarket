supabase.from('detalle_ventas').select('*, producto:productos(nombre), vendedor:vendedores(nombre)').gte('created_at', fechaInicio),
