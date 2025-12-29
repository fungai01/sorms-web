import './globals.css';
import type { Metadata } from 'next';
import { SWRConfig } from 'swr';

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
        {/* Google Site Verification - Thêm verification code từ Google OAuth Console */}
        {process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && (
          <meta
            name="google-site-verification"
            content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION}
          />
        )}
      </head>
      <body className="antialiased">
        <SWRConfig
          value={{
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 8000,
            errorRetryCount: 1,
          }}
        >
          {children}
        </SWRConfig>
      </body>
    </html>
  );
}
