import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── MÓDULO 11 (Dígito Verificador) ─────────────────────
function calcularDigitoVerificador(clave48: string): number {
  const pesos = [2, 3, 4, 5, 6, 7]
  let suma = 0
  let pesoIdx = 0
  for (let i = clave48.length - 1; i >= 0; i--) {
    suma += parseInt(clave48[i]) * pesos[pesoIdx % 6]
    pesoIdx++
  }
  const residuo = suma % 11
  if (residuo === 0) return 0
  if (residuo === 1) return 1
  return 11 - residuo
}

// ─── CLAVE DE ACCESO (49 dígitos) ────────────────────────
function generarClaveAcceso(params: {
  fecha: Date
  tipoComprobante: string  // '01' factura
  ruc: string
  ambiente: '1' | '2'     // 1=pruebas 2=produccion
  establecimiento: string  // '001'
  puntoEmision: string     // '001'
  secuencial: string       // '000000001'
  codigoNumerico: string   // 8 dígitos aleatorios
  tipoEmision: '1'         // 1=normal
}): string {
  const dia = String(params.fecha.getDate()).padStart(2, '0')
  const mes = String(params.fecha.getMonth() + 1).padStart(2, '0')
  const anio = String(params.fecha.getFullYear())
  const fecha = `${dia}${mes}${anio}` // DDMMAAAA

  const clave48 =
    fecha +                                    // 8 dígitos
    params.tipoComprobante +                   // 2 dígitos
    params.ruc +                               // 13 dígitos
    params.ambiente +                          // 1 dígito
    params.establecimiento +                   // 3 dígitos
    params.puntoEmision +                      // 3 dígitos
    params.secuencial +                        // 9 dígitos
    params.codigoNumerico +                    // 8 dígitos
    params.tipoEmision                         // 1 dígito = 48 dígitos

  const digitoVerificador = calcularDigitoVerificador(clave48)
  return clave48 + String(digitoVerificador)   // 49 dígitos
}

// ─── NÚMERO DE COMPROBANTE ────────────────────────────────
function formatearNumero(estab: string, punto: string, secuencial: string): string {
  return `${estab.padStart(3, '0')}-${punto.padStart(3, '0')}-${secuencial.padStart(9, '0')}`
}

// ─── CALCULAR IVA ────────────────────────────────────────
function calcularImpuestos(detalles: any[], porcentajeIva: number = 15) {
  let subtotal0 = 0
  let subtotalIva = 0

  detalles.forEach(d => {
    const subtotal = d.precio_unitario * d.cantidad
    if (d.tiene_iva) {
      subtotalIva += subtotal
    } else {
      subtotal0 += subtotal
    }
  })

  const iva = +(subtotalIva * (porcentajeIva / 100)).toFixed(2)
  const total = +(subtotal0 + subtotalIva + iva).toFixed(2)

  return { subtotal0, subtotalIva, iva, total, porcentajeIva }
}

// ─── CÓDIGO SRI POR TARIFA (Tabla 17, ficha técnica) ─────
// ⚠️ El código '8' para la tarifa del 8% (turismo) no está
// verificado con una fuente oficial — confírmalo con tu
// contador antes de usarlo en producción con un cliente real.
const CODIGO_PORCENTAJE_IVA: Record<number, string> = {
  0: '0',
  5: '5',
  8: '8',
  15: '4',
}
function codigoPorcentajeIva(porcentaje: number): string {
  return CODIGO_PORCENTAJE_IVA[porcentaje] ?? '4'
}

// ─── GENERAR XML ─────────────────────────────────────────
function generarXML(params: {
  claveAcceso: string
  numeroComprobante: string
  credenciales: any
  cliente: any
  detalles: any[]
  fecha: Date
  ambiente: '1' | '2'
  porcentajeIva: number
}): string {
  const { claveAcceso, numeroComprobante, credenciales, cliente, detalles, fecha, ambiente, porcentajeIva } = params
  const impuestos = calcularImpuestos(detalles, porcentajeIva)

  const fechaStr = `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`
  const ambienteLabel = ambiente === '1' ? 'PRUEBAS' : 'PRODUCCION'

  // Detalles de productos
  const xmlDetalles = detalles.map((d, i) => {
    const precioSinIva = d.tiene_iva
      ? +(d.precio_unitario / (1 + impuestos.porcentajeIva / 100)).toFixed(6)
      : d.precio_unitario
    const subtotalSinIva = +(precioSinIva * d.cantidad).toFixed(2)
    const valorIva = d.tiene_iva ? +(subtotalSinIva * (impuestos.porcentajeIva / 100)).toFixed(2) : 0
    const codigoIva = d.tiene_iva ? codigoPorcentajeIva(impuestos.porcentajeIva) : '0'
    const tarifaIva = d.tiene_iva ? impuestos.porcentajeIva : 0

    return `
        <detalle>
            <codigoPrincipal>${d.codigo_barras ?? String(i + 1).padStart(6, '0')}</codigoPrincipal>
            <descripcion><![CDATA[${d.nombre}]]></descripcion>
            <cantidad>${d.cantidad}.000000</cantidad>
            <precioUnitario>${precioSinIva.toFixed(6)}</precioUnitario>
            <descuento>0.00</descuento>
            <precioTotalSinImpuesto>${subtotalSinIva.toFixed(2)}</precioTotalSinImpuesto>
            <impuestos>
                <impuesto>
                    <codigo>2</codigo>
                    <codigoPorcentaje>${codigoIva}</codigoPorcentaje>
                    <tarifa>${tarifaIva}.00</tarifa>
                    <baseImponible>${subtotalSinIva.toFixed(2)}</baseImponible>
                    <valor>${valorIva.toFixed(2)}</valor>
                </impuesto>
            </impuestos>
        </detalle>`
  }).join('')

  // Resumen de impuestos
  const xmlImpuestosResumen = `
            <totalImpuesto>
                <codigo>2</codigo>
                <codigoPorcentaje>0</codigoPorcentaje>
                <baseImponible>${impuestos.subtotal0.toFixed(2)}</baseImponible>
                <valor>0.00</valor>
            </totalImpuesto>
            <totalImpuesto>
                <codigo>2</codigo>
                <codigoPorcentaje>${codigoPorcentajeIva(impuestos.porcentajeIva)}</codigoPorcentaje>
                <baseImponible>${impuestos.subtotalIva.toFixed(2)}</baseImponible>
                <valor>${impuestos.iva.toFixed(2)}</valor>
            </totalImpuesto>`

  const tipoIdentificacion: Record<string, string> = {
    cedula: '05',
    ruc: '04',
    pasaporte: '06',
    consumidor_final: '07',
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.0.0">
    <infoTributaria>
        <ambiente>${ambiente}</ambiente>
        <tipoEmision>1</tipoEmision>
        <razonSocial><![CDATA[${credenciales.razon_social}]]></razonSocial>
        <nombreComercial><![CDATA[${credenciales.nombre_comercial || credenciales.razon_social}]]></nombreComercial>
        <ruc>${credenciales.ruc}</ruc>
        <claveAcceso>${claveAcceso}</claveAcceso>
        <codDoc>01</codDoc>
        <estab>${credenciales.codigo_establecimiento}</estab>
        <ptoEmi>${credenciales.codigo_punto_emision}</ptoEmi>
        <secuencial>${numeroComprobante.split('-')[2]}</secuencial>
        <dirMatriz><![CDATA[${credenciales.direccion_matriz}]]></dirMatriz>
        ${credenciales.regimen === 'rimpe' ? '<contribuyenteRimpe>CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE</contribuyenteRimpe>' : ''}
    </infoTributaria>
    <infoFactura>
        <fechaEmision>${fechaStr}</fechaEmision>
        <dirEstablecimiento><![CDATA[${credenciales.direccion_establecimiento || credenciales.direccion_matriz}]]></dirEstablecimiento>
        ${credenciales.contribuyente_especial ? `<contribuyenteEspecial>${credenciales.contribuyente_especial}</contribuyenteEspecial>` : ''}
        <obligadoContabilidad>${credenciales.obligado_contabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
        <tipoIdentificacionComprador>${tipoIdentificacion[cliente.tipo_identificacion] ?? '05'}</tipoIdentificacionComprador>
        <razonSocialComprador><![CDATA[${cliente.razon_social}]]></razonSocialComprador>
        <identificacionComprador>${cliente.identificacion}</identificacionComprador>
        <direccionComprador><![CDATA[${cliente.direccion || 'S/N'}]]></direccionComprador>
        <totalSinImpuestos>${(impuestos.subtotal0 + impuestos.subtotalIva).toFixed(2)}</totalSinImpuestos>
        <totalDescuento>0.00</totalDescuento>
        <totalConImpuestos>${xmlImpuestosResumen}
        </totalConImpuestos>
        <propina>0.00</propina>
        <importeTotal>${impuestos.total.toFixed(2)}</importeTotal>
        <moneda>DOLAR</moneda>
        <pagos>
            <pago>
                <formaPago>01</formaPago>
                <total>${impuestos.total.toFixed(2)}</total>
                <plazo>0</plazo>
                <unidadTiempo>dias</unidadTiempo>
            </pago>
        </pagos>
    </infoFactura>
    <detalles>${xmlDetalles}
    </detalles>
    <infoAdicional>
        <campoAdicional nombre="Email">${cliente.email ?? ''}</campoAdicional>
        <campoAdicional nombre="Telefono">${cliente.telefono ?? ''}</campoAdicional>
        <campoAdicional nombre="Ambiente">${ambienteLabel}</campoAdicional>
    </infoAdicional>
</factura>`

  return xml
}

// ─── ENDPOINT POST ────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { venta_id, establecimiento_id, cliente, detalles } = await request.json()

    // 1. Obtener credenciales SRI
    const { data: cred, error: credError } = await supabaseAdmin
      .from('sri_credenciales')
      .select('*')
      .eq('establecimiento_id', establecimiento_id)
      .single()

    if (credError || !cred) {
      return NextResponse.json({ error: 'No hay credenciales SRI configuradas. Ve a Facturación → Credenciales SRI.' }, { status: 400 })
    }

    // 2. Obtener siguiente secuencial
    const { data: lastComp } = await supabaseAdmin
      .from('sri_comprobantes')
      .select('numero_comprobante')
      .eq('establecimiento_id', establecimiento_id)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    let secuencial = 1
    if (lastComp?.numero_comprobante) {
      const parts = lastComp.numero_comprobante.split('-')
      secuencial = parseInt(parts[2] ?? '0') + 1
    }
    const secuencialStr = String(secuencial).padStart(9, '0')
    const numeroComprobante = formatearNumero(cred.codigo_establecimiento, cred.codigo_punto_emision, secuencialStr)

    // 3. Código numérico aleatorio (8 dígitos)
    const codigoNumerico = String(Math.floor(Math.random() * 99999999)).padStart(8, '0')

    // 4. Ambiente
    const ambiente: '1' | '2' = cred.tipo_emision === 'produccion' ? '2' : '1'

    // 5. Generar clave de acceso
    const fecha = new Date()
    const claveAcceso = generarClaveAcceso({
      fecha,
      tipoComprobante: '01',
      ruc: cred.ruc,
      ambiente,
      establecimiento: cred.codigo_establecimiento,
      puntoEmision: cred.codigo_punto_emision,
      secuencial: secuencialStr,
      codigoNumerico,
      tipoEmision: '1',
    })

    // 6. Calcular totales
    const porcentajeIva = cred.es_negocio_turistico && cred.iva_reducido_activo ? 8 : 15
    const impuestos = calcularImpuestos(detalles, porcentajeIva)

    // 7. Generar XML
    const xml = generarXML({
      claveAcceso,
      numeroComprobante,
      credenciales: cred,
      cliente,
      detalles,
      fecha,
      ambiente,
      porcentajeIva,
    })

    // 8. Guardar comprobante en BD
    const { data: comprobante, error: compError } = await supabaseAdmin
      .from('sri_comprobantes')
      .insert({
        establecimiento_id,
        venta_id,
        tipo_comprobante: 'factura',
        numero_comprobante: numeroComprobante,
        clave_acceso: claveAcceso,
        estado: 'PENDIENTE',
        fecha_emision: fecha.toISOString(),
        xml_generado: xml,
        cliente_identificacion: cliente.identificacion,
        cliente_tipo_identificacion: cliente.tipo_identificacion,
        cliente_razon_social: cliente.razon_social,
        cliente_direccion: cliente.direccion,
        cliente_email: cliente.email,
        cliente_telefono: cliente.telefono,
        subtotal_sin_impuesto: impuestos.subtotal0 + impuestos.subtotalIva,
        subtotal_iva: impuestos.subtotalIva,
        iva: impuestos.iva,
        total: impuestos.total,
      })
      .select()
      .single()

    if (compError) {
      return NextResponse.json({ error: compError.message }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      claveAcceso,
      numeroComprobante,
      xml,
      comprobante_id: comprobante.id,
      totales: impuestos,
    })

  } catch (e) {
    console.error('Error generando XML:', e)
    return NextResponse.json({ error: 'Error interno generando XML' }, { status: 500 })
  }
}
