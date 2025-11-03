export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-900 rounded-md flex items-center justify-center">
              <span className="text-white font-semibold text-xs sm:text-sm">S</span>
            </div>
            <span className="text-base sm:text-lg font-semibold text-gray-900">SORMS</span>
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
