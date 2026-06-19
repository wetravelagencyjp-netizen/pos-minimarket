import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { EstablecimientoProvider } from '@/core/context/EstablecimientoContext'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'POS Minimarket SaaS',
  description: 'Sistema de Punto de Venta Multivendedor',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          <EstablecimientoProvider>
            {children}
          </EstablecimientoProvider>
        </AuthProvider>
      </body>
    </html>
  )
}