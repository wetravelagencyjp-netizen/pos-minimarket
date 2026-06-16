import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import RegisterSW from '@/components/RegisterSW'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'POS Minimarket SaaS',
  description: 'Sistema de Punto de Venta Multivendedor',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'POS',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4f46e5',
}

const ERROR_CATCHER = `
  function mostrarError(titulo, detalle) {
    var box = document.createElement('div');
    box.style.position = 'fixed';
    box.style.inset = '0';
    box.style.zIndex = '999999';
    box.style.background = '#fff';
    box.style.color = '#b91c1c';
    box.style.padding = '20px';
    box.style.fontFamily = 'monospace';
    box.style.fontSize = '13px';
    box.style.whiteSpace = 'pre-wrap';
    box.style.overflow = 'auto';
    box.textContent = titulo + '\\n\\n' + detalle;
    document.body.appendChild(box);
  }
  window.addEventListener('error', function(e) {
    mostrarError('ERROR: ' + e.message, (e.error && e.error.stack) ? e.error.stack : '(sin stack)');
  });
  window.addEventListener('unhandledrejection', function(e) {
    var r = e.reason;
    mostrarError('PROMISE ERROR: ' + (r && r.message ? r.message : String(r)), (r && r.stack) ? r.stack : '(sin stack)');
  });
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: ERROR_CATCHER }} />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <RegisterSW />
      </body>
    </html>
  )
}