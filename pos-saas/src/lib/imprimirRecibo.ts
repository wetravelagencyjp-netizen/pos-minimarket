interface ItemRecibo {
  nombre: string
  cantidad: number
  precioUnitario: number
}

interface PagoRecibo {
  metodo: string
  monto: number
}

interface DatosRecibo {
  nombreNegocio: string
  ruc?: string | null
  direccion?: string | null
  numeroComprobante: string
  claveAcceso?: string | null
  fecha: string
  cajero?: string | null
  items: ItemRecibo[]
  pagos: PagoRecibo[]
  total: number
  anticipoReserva?: number
  subtotalSinIva?: number
  subtotalIva?: number
  iva?: number
  ancho: '80mm' | '58mm'
}

const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  credito: 'Crédito',
  mixto: 'Mixto',
}

export function imprimirRecibo(d: DatosRecibo) {
  // En iOS PWA window.open está bloqueado — usamos iframe oculto
  const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  let ventana: Window | null = null

  if (!esIOS) {
    ventana = window.open('', '_blank', 'width=400,height=600')
    if (!ventana) return
  } else {
    // En iOS: crear iframe oculto para imprimir
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    document.body.appendChild(iframe)
    ventana = iframe.contentWindow
    if (!ventana) return

  const fmt = (n: number) => `$${n.toFixed(2)}`
  const anchoPx = d.ancho === '58mm' ? '58mm' : '80mm'

  const filasItems = d.items.map((it) => {
    const subtotal = it.precioUnitario * it.cantidad
    return `<tr>
      <td class="cant">${it.cantidad}</td>
      <td class="desc">${it.nombre}</td>
      <td class="precio">${fmt(subtotal)}</td>
    </tr>`
  }).join('')

  const filasPagos = d.pagos.map((p) => `
    <div class="linea"><span>${METODO_LABEL[p.metodo] ?? p.metodo}</span><span>${fmt(p.monto)}</span></div>
  `).join('')

  const qrUrl = d.claveAcceso
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(d.claveAcceso)}`
    : null

  ventana.document.write(`
    <html>
    <head>
      <title>Recibo ${d.numeroComprobante}</title>
      <style>
        @page { size: ${anchoPx} auto; margin: 0; }
        * { box-sizing: border-box; }
        body {
          width: ${anchoPx};
          margin: 0;
          padding: 6mm 4mm;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          color: #000;
        }
        .centro { text-align: center; }
        .negocio { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
        .meta { font-size: 10px; line-height: 1.4; }
        hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 9px; border-bottom: 1px solid #000; padding-bottom: 2px; }
        th.precio, td.precio { text-align: right; }
        th.cant, td.cant { width: 18px; }
        td { padding: 2px 0; vertical-align: top; word-break: break-word; }
        .linea { display: flex; justify-content: space-between; font-size: 11px; padding: 1px 0; }
        .total-grande { font-size: 16px; font-weight: 700; display: flex; justify-content: space-between; margin-top: 4px; }
        .footer { text-align: center; font-size: 10px; margin-top: 10px; line-height: 1.5; }
        .qr { text-align: center; margin: 8px 0; }
        .clave { font-size: 8px; word-break: break-all; text-align: center; margin-top: 4px; }
        @media print { body { padding: 2mm; } }
      </style>
    </head>
    <body>
      <div class="centro">
        <div class="negocio">${d.nombreNegocio}</div>
        <div class="meta">
          ${d.ruc ? `RUC: ${d.ruc}<br/>` : ''}
          ${d.direccion ? `${d.direccion}<br/>` : ''}
          ${d.fecha}
          ${d.cajero ? `<br/>Cajero: ${d.cajero}` : ''}
        </div>
      </div>
      <hr/>
      <div class="meta centro">Comprobante ${d.numeroComprobante}</div>
      <hr/>
      <table>
        <thead><tr><th class="cant">Cant</th><th>Descripción</th><th class="precio">Total</th></tr></thead>
        <tbody>${filasItems}</tbody>
      </table>
      <hr/>
      ${d.subtotalSinIva != null ? `<div class="linea"><span>Subtotal</span><span>${fmt(d.subtotalSinIva)}</span></div>` : ''}
      ${d.iva != null ? `<div class="linea"><span>IVA</span><span>${fmt(d.iva)}</span></div>` : ''}
      <div class="total-grande"><span>TOTAL</span><span>${fmt(d.total + (d.anticipoReserva ?? 0))}</span></div>
      <hr/>
      ${d.anticipoReserva && d.anticipoReserva > 0 ? `<div class="linea"><span>Anticipo reserva</span><span>${fmt(d.anticipoReserva)}</span></div>` : ''}
      ${filasPagos}
      ${d.anticipoReserva && d.anticipoReserva > 0 ? `<div class="linea" style="font-weight:700"><span>Saldo cobrado hoy</span><span>${fmt(d.pagos.reduce((s,p) => s + p.monto, 0))}</span></div>` : ''}
      ${qrUrl ? `<div class="qr"><img src="${qrUrl}" width="120" height="120" /></div>` : ''}
      ${d.claveAcceso ? `<div class="clave">${d.claveAcceso}</div>` : ''}
      <div class="footer">
        ¡Gracias por tu compra!<br/>
        Vuelve pronto 🙌
      </div>
    </body>
    </html>
  `)
  ventana.document.close()

  if (esIOS) {
    setTimeout(() => {
      ventana!.print()
      setTimeout(() => {
        const iframe = document.querySelector('iframe[style*="position: fixed"]')
        if (iframe) document.body.removeChild(iframe)
      }, 1000)
    }, 300)
  } else {
    ventana.focus()
    setTimeout(() => ventana!.print(), 300)
  }
}