import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SORMS - Hệ thống quản lý nhà công vụ thông minh',
  description:
    'SORMS là hệ thống quản lý nhà công vụ thông minh, giúp quản lý phòng ở, dịch vụ và thanh toán một cách hiệu quả.',
  keywords: 'SORMS, nhà công vụ, quản lý phòng, hệ thống quản lý',
  authors: [{ name: 'SORMS Team' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {/* Tối ưu tài nguyên */}
        <link rel="preload" href="/login" as="document" />
        <link rel="dns-prefetch" href="//accounts.google.com" />
        <meta name="theme-color" content="#3B82F6" />
        <meta name="robots" content="index, follow" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
