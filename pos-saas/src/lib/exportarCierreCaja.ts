interface DatosCierre {
  nombreNegocio: string
  ruc?: string | null
  cajero: string
  cajaId: number
  fechaApertura: string
  fechaCierre: string
  montoInicial: number
  porMetodo: Record<string, number>
  porBanco: Record<string, number>
  totalEgresos: number
  efectivoEsperado: number
  efectivoDeclarado: number
  diferencia: number
}

export function exportarCierreCSV(d: DatosCierre) {
  const filas: string[][] = [
    ['Reporte de Cierre de Caja'],
    ['Negocio', d.nombreNegocio],
    ['RUC', d.ruc ?? '—'],
    ['Cajero', d.cajero],
    ['ID Caja', String(d.cajaId)],
    ['Apertura', new Date(d.fechaApertura).toLocaleString('es-EC')],
    ['Cierre', new Date(d.fechaCierre).toLocaleString('es-EC')],
    [],
    ['Métodos de pago', 'Monto'],
    ...Object.entries(d.porMetodo).map(([m, v]) => [m, v.toFixed(2)]),
    [],
    ...(Object.keys(d.porBanco).length ? [['Por banco', 'Monto'], ...Object.entries(d.porBanco).map(([b, v]) => [b, v.toFixed(2)]), []] : []),
    ['Flujo de efectivo', ''],
    ['Monto inicial', d.montoInicial.toFixed(2)],
    ['Egresos', d.totalEgresos.toFixed(2)],
    ['Efectivo esperado', d.efectivoEsperado.toFixed(2)],
    ['Efectivo declarado', d.efectivoDeclarado.toFixed(2)],
    ['Diferencia', d.diferencia.toFixed(2)],
  ]

  import('xlsx').then((XLSX) => {
    const ws = XLSX.utils.aoa_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cierre de Caja')
    const fecha = new Date(d.fechaCierre).toISOString().slice(0, 10)
    XLSX.writeFile(wb, `cierre_caja_${d.cajaId}_${fecha}.xlsx`)
  })
}

export function exportarCierrePDF(d: DatosCierre) {
  const fmt = (n: number) => `$${n.toFixed(2)}`
  const ventana = window.open('', '_blank')
  if (!ventana) return

  const filasMetodo = Object.entries(d.porMetodo)
    .map(([m, v]) => `<tr><td>${m}</td><td style="text-align:right">${fmt(v)}</td></tr>`)
    .join('')

  const filasBanco = Object.entries(d.porBanco)
    .map(([b, v]) => `<tr><td>${b}</td><td style="text-align:right">${fmt(v)}</td></tr>`)
    .join('')

  const colorDif = d.diferencia < 0 ? '#dc2626' : d.diferencia > 0 ? '#2563eb' : '#059669'

  ventana.document.write(`
    <html>
    <head>
      <title>Cierre de Caja ${d.cajaId}</title>
      <style>
        body { font-family: -apple-system, Arial, sans-serif; padding: 32px; color: #1e293b; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .sub { color: #64748b; font-size: 12px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        td { padding: 6px 4px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
        .seccion { font-weight: 600; font-size: 13px; margin: 16px 0 6px; color: #334155; }
        .total { font-weight: 700; }
        .diferencia { font-weight: 700; color: ${colorDif}; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${d.nombreNegocio}</h1>
      <p class="sub">${d.ruc ? `RUC: ${d.ruc} · ` : ''}Cierre de Caja #${d.cajaId} · Cajero: ${d.cajero}</p>
      <p class="sub">Apertura: ${new Date(d.fechaApertura).toLocaleString('es-EC')} · Cierre: ${new Date(d.fechaCierre).toLocaleString('es-EC')}</p>

      <div class="seccion">Conciliación de métodos de pago</div>
      <table>${filasMetodo}</table>

      ${Object.keys(d.porBanco).length ? `<div class="seccion">Por banco</div><table>${filasBanco}</table>` : ''}

      <div class="seccion">Flujo de efectivo</div>
      <table>
        <tr><td>Monto inicial</td><td style="text-align:right">${fmt(d.montoInicial)}</td></tr>
        <tr><td>Egresos autorizados</td><td style="text-align:right">-${fmt(d.totalEgresos)}</td></tr>
        <tr><td class="total">Efectivo esperado</td><td style="text-align:right" class="total">${fmt(d.efectivoEsperado)}</td></tr>
        <tr><td>Efectivo declarado</td><td style="text-align:right">${fmt(d.efectivoDeclarado)}</td></tr>
        <tr><td class="diferencia">Diferencia</td><td style="text-align:right" class="diferencia">${d.diferencia > 0 ? '+' : ''}${fmt(d.diferencia)}</td></tr>
      </table>
    </body>
    </html>
  `)
  ventana.document.close()
  ventana.focus()
  setTimeout(() => ventana.print(), 300)
}