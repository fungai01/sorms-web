import Image from "next/image";
import Logo from "@/img/Logo.png";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="relative w-[60px] h-[60px] rounded-lg overflow-hidden">
              <Image src={Logo} alt="SORMS logo" fill sizes="60px" className="object-cover" />
            </div>
            <span className="text-lg font-semibold text-gray-900">SORMS</span>
          </div>

          {/* Copyright */}
          <div className="text-gray-500 text-xs sm:text-sm text-center sm:text-right">
            © {currentYear} SORMS. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
