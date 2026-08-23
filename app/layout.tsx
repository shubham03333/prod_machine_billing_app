import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import PwaRegister from '@/components/PwaRegister'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rental Tracker',
  description: 'Machinery rental income tracking system',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Rentra GPS',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}
