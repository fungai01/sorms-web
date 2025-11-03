import './globals.css'
import { Providers } from './providers'

import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'SORMS - Nhà Công Vụ Thông Minh',
  description: 'Hệ thống quản lý nhà công vụ thông minh SORMS giúp bạn quản lý phòng, dịch vụ và thanh toán hiệu quả.',
  keywords: 'SORMS, nhà công vụ, quản lý phòng, hệ thống quản lý',
  authors: [{ name: 'SORMS Team' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {/* Optimized resource hints */}
        <link rel="preload" href="/login" as="document" />
        <link rel="dns-prefetch" href="//accounts.google.com" />
        <meta name="theme-color" content="#3B82F6" />
        <meta name="robots" content="index, follow" />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
