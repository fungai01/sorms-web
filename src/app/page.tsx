"use client";
import Link from "next/link";
import { memo } from "react";
import Head from "next/head";
import Image from "next/image";
import Logo from "@/img/Logo.png";
import Bg from "@/img/bg.jpg";

const HomePage = memo(function HomePage() {
  return (
    <>
      <Head>
        <title>SORMS - Hệ thống quản lý nhà công vụ thông minh</title>
        <meta
          name="description"
          content="SORMS là hệ thống quản lý nhà công vụ thông minh, giúp bạn quản lý phòng ở, dịch vụ và thanh toán một cách hiệu quả và chuyên nghiệp."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen relative overflow-hidden font-[Inter]" suppressHydrationWarning>
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${Bg.src})`,
          }}
          suppressHydrationWarning
        />

        {/* Gradient Overlay - cool, soft blue/indigo only */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-blue-800/70 to-indigo-900/80 z-[1]" />

        {/* Pattern Background */}
        <div
          className="absolute inset-0 z-[2]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)`,
            backgroundSize: "16px 16px",
          }}
        />

        {/* Content Overlay */}
        <div className="absolute inset-0 bg-black/30 z-[3]" />

        {/* Floating Elements */}
        <div className="absolute inset-0 z-[4] pointer-events-none">
          {/* Floating circles - all cool blue tones */}
          <div className="absolute top-20 left-10 w-4 h-4 bg-blue-400/30 rounded-full animate-float-slow"></div>
          <div className="absolute top-40 right-20 w-6 h-6 bg-sky-400/30 rounded-full animate-float-medium"></div>
          <div className="absolute bottom-40 left-20 w-3 h-3 bg-indigo-400/30 rounded-full animate-float-fast"></div>
          <div className="absolute bottom-20 right-10 w-5 h-5 bg-blue-300/30 rounded-full animate-float-slow"></div>

          {/* Floating geometric shapes - blue gradient only */}
          <div className="absolute top-32 right-1/3 w-8 h-8 border-2 border-white/20 rotate-45 animate-spin-slow"></div>
          <div className="absolute bottom-32 left-1/3 w-6 h-6 bg-gradient-to-br from-blue-300/20 to-blue-500/20 rounded-lg animate-bounce-slow"></div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-4">
          {/* Enhanced Logo */}
          <div className="mb-8 animate-fade-in">
            <Image
              src={Logo}
              alt="Logo SORMS"
              width={150}
              height={150}
              priority
              className="rounded-2xl shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105"
            />
          </div>

          {/* Enhanced Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-tight mb-6 animate-slide-up drop-shadow-2xl">
            <span className="block text-shadow-lg">
              Hệ thống quản lý nhà công vụ thông minh
            </span>
            <span className="block bg-gradient-to-r from-blue-200 via-blue-300 to-blue-500 bg-clip-text text-transparent mt-2 animate-gradient-x">
              SORMS
            </span>
          </h1>

          {/* Enhanced Subtitle */}
          <p className="text-lg sm:text-xl text-gray-100 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-delayed drop-shadow-lg">
            Nền tảng giúp quản lý phòng ở, dịch vụ và thanh toán nhà công vụ một cách hiệu quả, minh bạch và chuyên nghiệp.
          </p>

          {/* Login Button */}
          <div>
            <Link
              href="/login"
              className="inline-flex items-center gap-3 px-10 py-4 bg-white/90 text-gray-900 font-semibold text-lg rounded-2xl shadow hover:shadow-md transform hover:-translate-y-1 transition-all duration-300 border border-white/30"
              suppressHydrationWarning
            >
              {/* Icon */}
              <svg className="w-6 h-6 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              {/* Button text */}
              <span>Đăng nhập ngay</span>
            </Link>
          </div>

          {/* Footer */}
          <div className="mt-8 text-sm text-gray-300">
            <p className="italic mb-2">
              © 2025 SORMS – Hệ thống quản lý nhà công vụ thông minh
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
              <Link 
                href="/policy" 
                className="text-gray-300 hover:text-white underline underline-offset-2 transition-colors duration-200"
              >
                Chính sách bảo mật
              </Link>
              <span className="text-gray-400">|</span>
              <Link 
                href="/terms" 
                className="text-gray-300 hover:text-white underline underline-offset-2 transition-colors duration-200"
              >
                Điều khoản sử dụng
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

export default HomePage;
