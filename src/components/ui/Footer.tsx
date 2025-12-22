import Image from "next/image";
import Logo from "@/img/Logo.png";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3" suppressHydrationWarning>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0" suppressHydrationWarning>
          {/* Logo */}
          <div className="flex items-center space-x-3" suppressHydrationWarning>
            <div className="relative w-[60px] h-[60px] rounded-lg overflow-hidden" suppressHydrationWarning>
              <Image src={Logo} alt="Logo SORMS" fill sizes="60px" className="object-cover" />
            </div>
            <span className="text-lg font-semibold text-foreground">SORMS</span>
          </div>

          {/* Copyright */}
          <div className="text-muted-foreground text-xs sm:text-sm text-center sm:text-right" suppressHydrationWarning>
            © {currentYear} SORMS. Bản quyền thuộc về hệ thống quản lý nhà công vụ thông minh.
          </div>
        </div>
      </div>
    </footer>
  );
}
