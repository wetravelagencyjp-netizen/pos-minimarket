<header className="flex items-center justify-between border-b border-gray-100 bg-white px-5 py-3">
  <div>
    <h1 className="text-sm font-semibold text-gray-900">Punto de venta</h1>
    <p className="text-xs text-gray-400">{vendedores.length} vendedores</p>
  </div>
  <div className="flex items-center gap-2">
    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-700">Abierta</span>
    {usuario?.rol !== 'cajero' && (
      <button onClick={() => router.push('/dashboard')} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors">📊 Dashboard</button>
    )}
    <button onClick={() => router.push('/caja')} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors">🏦 Caja</button>
    {usuario?.rol !== 'cajero' && (
      <button onClick={() => router.push('/admin')} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors">⚙️ Admin</button>
    )}
    {(usuario as any)?.es_superadmin && (
      <button onClick={() => router.push('/superadmin')} className="rounded-lg border border-yellow-300 bg-yellow-50 px-2.5 py-1.5 text-xs text-yellow-700 hover:bg-yellow-100 transition-colors">⚡ Super</button>
    )}
    <span className="text-xs text-gray-500">{usuario?.nombre ?? 'Cajero'}</span>
    <button onClick={logout} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">Salir</button>
  </div>
</header>
