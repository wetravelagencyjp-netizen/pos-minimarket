interface ItemCotizacion {
  nombre: string
  cantidad: number
  precioUnitario: number
  descuento?: number
}

interface DatosCotizacion {
  numeroCotizacion: string
  fechaEmision: string
  validoHasta: string
  negocio: {
    nombre: string
    ruc?: string | null
    direccion?: string | null
    telefono?: string | null
    whatsapp?: string | null
    email?: string | null
    logoUrl?: string | null
  }
  cliente: {
    nombre: string
    identificacion?: string | null
    email?: string | null
    telefono?: string | null
    direccion?: string | null
  }
  items: ItemCotizacion[]
  descuentoGlobal?: number
  notas?: string | null
}

export function generarCotizacionPDF(d: DatosCotizacion) {
  const ventana = window.open('', '_blank', 'width=900,height=700')
  if (!ventana) return

  const subtotalSinDescuento = d.items.reduce((s, it) => s + it.precioUnitario * it.cantidad, 0)
  const descuentoItems = d.items.reduce((s, it) => s + (it.descuento ?? 0) * it.cantidad, 0)
  const subtotal = subtotalSinDescuento - descuentoItems
  const descuentoGlobal = d.descuentoGlobal ?? 0
  const montoDescuentoGlobal = subtotal * (descuentoGlobal / 100)
  const total = subtotal - montoDescuentoGlobal
  const iva = total * 0.15
  const totalConIva = total + iva

  const fmt = (n: number) => `$${n.toFixed(2)}`
  const whatsappUrl = d.negocio.whatsapp
    ? `https://wa.me/593${d.negocio.whatsapp.replace(/^0/, '')}`
    : null
  const qrWhatsapp = whatsappUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(whatsappUrl)}`
    : null

  const filas = d.items.map(it => {
    const descIt = it.descuento ?? 0
    const precioNeto = it.precioUnitario - descIt
    const totalIt = precioNeto * it.cantidad
    return `
      <tr>
        <td>${it.nombre}</td>
        <td class="centro">${it.cantidad}</td>
        <td class="derecha">${fmt(it.precioUnitario)}</td>
        <td class="centro">${descIt > 0 ? fmt(descIt) : '—'}</td>
        <td class="derecha"><strong>${fmt(totalIt)}</strong></td>
      </tr>`
  }).join('')

  ventana.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8"/>
      <title>Cotización ${d.numeroCotizacion}</title>
      <style>
        @page { size: A4; margin: 15mm 18mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }

        /* Header */
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #4f46e5; }
        .logo-area { display: flex; flex-direction: column; gap: 6px; }
        .logo-area img { max-height: 56px; max-width: 160px; object-fit: contain; }
        .negocio-nombre { font-size: 18px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.3px; }
        .negocio-datos { font-size: 10px; color: #555; line-height: 1.6; }
        .cotizacion-info { text-align: right; }
        .cotizacion-titulo { font-size: 22px; font-weight: 800; color: #4f46e5; letter-spacing: -0.5px; }
        .cotizacion-num { font-size: 12px; color: #555; margin-top: 4px; }
        .cotizacion-fecha { font-size: 10px; color: #888; margin-top: 2px; }
        .valido-badge { display: inline-block; margin-top: 6px; background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 20px; }

        /* Cliente */
        .seccion-cliente { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .cliente-box { background: #f8f9ff; border: 1px solid #e0e0f0; border-radius: 8px; padding: 14px 16px; flex: 1; margin-right: 16px; }
        .cliente-titulo { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #4f46e5; margin-bottom: 6px; }
        .cliente-nombre { font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 3px; }
        .cliente-dato { font-size: 10px; color: #555; line-height: 1.6; }
        .qr-box { text-align: center; }
        .qr-box img { width: 80px; height: 80px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 4px; }
        .qr-label { font-size: 9px; color: #888; margin-top: 4px; }

        /* Tabla */
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        thead tr { background: #4f46e5; color: white; }
        thead th { padding: 9px 10px; text-align: left; font-size: 10px; font-weight: 600; letter-spacing: 0.3px; }
        thead th.centro { text-align: center; }
        thead th.derecha { text-align: right; }
        tbody tr { border-bottom: 1px solid #f0f0f0; }
        tbody tr:nth-child(even) { background: #fafafa; }
        tbody td { padding: 8px 10px; font-size: 11px; color: #333; vertical-align: middle; }
        td.centro { text-align: center; }
        td.derecha { text-align: right; }

        /* Totales */
        .totales-wrap { display: flex; justify-content: flex-end; margin-bottom: 24px; }
        .totales { width: 260px; }
        .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; color: #444; }
        .total-row.descuento { color: #dc2626; }
        .total-row.final { font-size: 14px; font-weight: 800; color: #1a1a1a; border-top: 2px solid #4f46e5; padding-top: 8px; margin-top: 4px; }
        .total-row.iva { color: #555; font-size: 10px; }

        /* Notas */
        .notas-box { background: #f8f9ff; border-left: 3px solid #4f46e5; border-radius: 0 6px 6px 0; padding: 10px 14px; margin-bottom: 24px; font-size: 10px; color: #555; line-height: 1.6; }
        .notas-titulo { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #4f46e5; margin-bottom: 4px; }

        /* Footer */
        .footer { border-top: 1px solid #e5e7eb; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; }
        .footer-text { font-size: 9px; color: #999; line-height: 1.6; }
        .footer-contacto { text-align: right; font-size: 9px; color: #555; line-height: 1.6; }

        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>

      <!-- HEADER -->
      <div class="header">
        <div class="logo-area">
          ${d.negocio.logoUrl ? `<img src="${d.negocio.logoUrl}" alt="Logo" />` : ''}
          <div class="negocio-nombre">${d.negocio.nombre}</div>
          <div class="negocio-datos">
            ${d.negocio.ruc ? `RUC: ${d.negocio.ruc}<br/>` : ''}
            ${d.negocio.direccion ? `${d.negocio.direccion}<br/>` : ''}
            ${d.negocio.telefono ? `Tel: ${d.negocio.telefono}<br/>` : ''}
            ${d.negocio.whatsapp ? `WhatsApp: ${d.negocio.whatsapp}` : ''}
          </div>
        </div>
        <div class="cotizacion-info">
          <div class="cotizacion-titulo">COTIZACIÓN</div>
          <div class="cotizacion-num"># ${d.numeroCotizacion}</div>
          <div class="cotizacion-fecha">Emitida: ${d.fechaEmision}</div>
          <div class="valido-badge">⏳ Válida hasta: ${d.validoHasta}</div>
        </div>
      </div>

      <!-- CLIENTE + QR -->
      <div class="seccion-cliente">
        <div class="cliente-box">
          <div class="cliente-titulo">Cotización para</div>
          <div class="cliente-nombre">${d.cliente.nombre}</div>
          ${d.cliente.identificacion ? `<div class="cliente-dato">CI/RUC: ${d.cliente.identificacion}</div>` : ''}
          ${d.cliente.email ? `<div class="cliente-dato">✉ ${d.cliente.email}</div>` : ''}
          ${d.cliente.telefono ? `<div class="cliente-dato">📞 ${d.cliente.telefono}</div>` : ''}
          ${d.cliente.direccion ? `<div class="cliente-dato">📍 ${d.cliente.direccion}</div>` : ''}
        </div>
        ${qrWhatsapp ? `
        <div class="qr-box">
          <img src="${qrWhatsapp}" alt="QR WhatsApp" />
          <div class="qr-label">Escríbenos por<br/>WhatsApp</div>
        </div>` : ''}
      </div>

      <!-- TABLA DE PRODUCTOS -->
      <table>
        <thead>
          <tr>
            <th>Descripción</th>
            <th class="centro">Cantidad</th>
            <th class="derecha">Precio unit.</th>
            <th class="centro">Descuento</th>
            <th class="derecha">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${filas}
        </tbody>
      </table>

      <!-- TOTALES -->
      <div class="totales-wrap">
        <div class="totales">
          <div class="total-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
          ${descuentoGlobal > 0 ? `<div class="total-row descuento"><span>Descuento (${descuentoGlobal}%)</span><span>-${fmt(montoDescuentoGlobal)}</span></div>` : ''}
          <div class="total-row final"><span>TOTAL</span><span>${fmt(total)}</span></div>
          <div class="total-row iva"><span>IVA 15% (referencial)</span><span>${fmt(iva)}</span></div>
          <div class="total-row iva"><span>Total con IVA (referencial)</span><span>${fmt(totalConIva)}</span></div>
        </div>
      </div>

      ${d.notas ? `
      <div class="notas-box">
        <div class="notas-titulo">Notas y condiciones</div>
        ${d.notas}
      </div>` : ''}

      <!-- FOOTER -->
      <div class="footer">
        <div class="footer-text">
          Esta cotización es válida hasta el ${d.validoHasta}.<br/>
          Los precios pueden variar sin previo aviso después de la fecha de vencimiento.
        </div>
        <div class="footer-contacto">
          ${d.negocio.nombre}<br/>
          ${d.negocio.whatsapp ? `WhatsApp: ${d.negocio.whatsapp}<br/>` : ''}
          ${d.negocio.email ? `${d.negocio.email}` : ''}
        </div>
      </div>

    </body>
    </html>
  `)
  ventana.document.close()
  ventana.focus()
  setTimeout(() => ventana.print(), 500)
}