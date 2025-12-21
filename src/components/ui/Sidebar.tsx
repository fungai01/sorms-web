"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentRole } from "@/hooks/useCurrentRole";

interface SidebarProps {
  user?: {
    name: string;
    email: string;
    role: string;
    avatar?: string;
  };
  isVisible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  onToggleCollapsed?: () => void;
  isMobile?: boolean; // Add flag to identify mobile sidebar
}

export default function Sidebar({ user, isVisible = false, collapsed = true, onToggle, onToggleCollapsed, isMobile = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Use collapsed prop from parent instead of local state
  const sidebarCollapsed = collapsed;

  const isAdmin = pathname.startsWith('/admin');
  const isOffice = pathname.startsWith('/office');
  const isStaff = pathname.startsWith('/staff');
  const isUser = pathname.startsWith('/user');

  const role = useCurrentRole();
  const isProfile = pathname.startsWith('/profile');
  const isNotifications = pathname.startsWith('/notifications');

  // Get user role from sessionStorage if available
  const getUserRole = () => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('userRole');
    }
    return null;
  };

  const userRole = getUserRole();

  // Use user prop only (no mock data)
  const detectedUser = user || null;

  // Icon components for minimalist line art
  const Icons = {
    Dashboard: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    Rooms: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    RoomTypes: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
      </svg>
    ),
    Bookings: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    Checkin: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    Services: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    ServiceOrders: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    Payments: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    Tasks: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    Users: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    ),
    Staff: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    Roles: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    Home: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    About: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    Contact: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    Bed: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
      </svg>
    ),
    Service: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    Invoice: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  };

  // Simplified navigation - no submenus, only single links
  const getNavigation = () => {
    // Route-specific pages (ensure stable SSR/CSR output)
    if (isProfile) {
      return [
        { name: 'Hồ sơ cá nhân', href: '/profile', icon: <Icons.Dashboard />, current: pathname === '/profile' },
      ];
    }
    if (isNotifications) {
      return [
        { name: 'Thông báo', href: '/notifications', icon: <Icons.Dashboard />, current: pathname === '/notifications' },
      ];
    }

    // Check userRole from sessionStorage first, then fallback to path detection
    const currentRole = (role || userRole || (isAdmin ? 'admin' : isOffice ? 'office' : isStaff ? 'staff' : isUser ? 'user' : null)) as string | null;
    
    if (isAdmin || currentRole === 'admin') {
      return [
        {
          name: 'Tổng quan hệ thống',
          href: '/admin/dashboard',
          icon: <Icons.Dashboard />,
          current: pathname === '/admin/dashboard',
        },
        {
          name: 'Quản lý phòng',
          href: '/admin/rooms',
          icon: <Icons.Rooms />,
          current: pathname.startsWith('/admin/rooms'),
        },
        {
          name: 'Quản lý tòa nhà',
          href: '/admin/room-types',
          icon: <Icons.RoomTypes />,
          current: pathname.startsWith('/admin/room-types'),
        },
        {
          name: 'Quản lý đặt phòng',
          href: '/admin/bookings',
          icon: <Icons.Bookings />,
          current: pathname.startsWith('/admin/bookings'),
        },
        {
          name: 'Quản lý dịch vụ',
          href: '/admin/services',
          icon: <Icons.Services />,
          current: pathname.startsWith('/admin/services'),
        },
        {
          name: 'Yêu cầu dịch vụ',
          href: '/admin/service-orders',
          icon: <Icons.ServiceOrders />,
          current: pathname.startsWith('/admin/service-orders'),
        },
        {
          name: 'Quản lý công việc',
          href: '/admin/tasks',
          icon: <Icons.Tasks />,
          current: pathname.startsWith('/admin/tasks'),
        },
        {
          name: 'Quản lý người dùng',
          href: '/admin/users',
          icon: <Icons.Users />,
          current: pathname.startsWith('/admin/users'),
        },
        {
          name: 'Quản lý nhân sự',
          href: '/admin/staff-profiles',
          icon: <Icons.Staff />,
          current: pathname.startsWith('/admin/staff-profiles'),
        },
        {
          name: 'Quản lý vai trò',
          href: '/admin/roles',
          icon: <Icons.Roles />,
          current: pathname.startsWith('/admin/roles'),
        },
        {
          name: 'Báo cáo',
          href: '/admin/reports',
          icon: <Icons.Payments />,
          current: pathname.startsWith('/admin/reports'),
        },
      ];
    } else if (isOffice || currentRole === 'office') {
      return [
        { name: 'Tổng quan', href: '/office/dashboard', icon: <Icons.Dashboard />, current: pathname.startsWith('/office/dashboard') },
        { name: 'Duyệt đặt phòng', href: '/office/bookings', icon: <Icons.Bookings />, current: pathname.startsWith('/office/bookings') },
        { name: 'Quản lý phòng', href: '/office/rooms', icon: <Icons.Rooms />, current: pathname.startsWith('/office/rooms') },
        { name: 'Báo cáo', href: '/office/reports', icon: <Icons.Payments />, current: pathname.startsWith('/office/reports') },
      ];
  
    } else if (isStaff || currentRole === 'staff') {
      return [
        { name: 'Tổng quan', href: '/staff/dashboard', icon: <Icons.Dashboard />, current: pathname.startsWith('/staff/dashboard') },
      ];
    
    }
    if (isUser || currentRole === 'user') {
      return [
        { name: 'Tổng quan', href: '/user/dashboard', icon: <Icons.Dashboard />, current: pathname === '/user/dashboard' },
        { name: 'Xem & Đặt phòng', href: '/user/rooms', icon: <Icons.Rooms />, current: pathname.startsWith('/user/rooms') || pathname.startsWith('/user/booking') },
        { name: 'Dịch vụ', href: '/user/services', icon: <Icons.Services />, current: pathname.startsWith('/user/services') },
        { name: 'Đơn hàng & Thanh toán', href: '/user/orders', icon: <Icons.ServiceOrders />, current: pathname.startsWith('/user/orders') || pathname.startsWith('/user/payment') },
        { name: 'Lịch sử', href: '/user/history', icon: <Icons.Invoice />, current: pathname.startsWith('/user/history') },
        { name: 'Đăng ký khuôn mặt', href: '/user/face-register', icon: <Icons.Checkin />, current: pathname.startsWith('/user/face-register') },
      ];
    } else if (isProfile) {
      return [
        { name: 'Hồ sơ cá nhân', href: '/profile', icon: <Icons.Dashboard />, current: pathname === '/profile' },
      ];
    } else {
      return [
        { name: 'Trang chủ', href: '/', icon: <Icons.Dashboard />, current: pathname === '/' },
      ];
    }
  };

  const navigation = getNavigation();

  return (
    <div 
      data-sidebar
      className={`bg-white/95 backdrop-blur-sm border-r border-gray-200/50 transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      } ${!isVisible ? 'hidden' : ''}`}
      suppressHydrationWarning
    >
      {/* Toggle Button - Only show on desktop */}
      {!isMobile && (
        <div className="p-3 border-b border-gray-100/50" suppressHydrationWarning>
          <button
            onClick={onToggleCollapsed}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'} p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all duration-200`}
            title={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="p-3 space-y-2">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            onClick={() => {
              // On mobile (when sidebar is not collapsed and isVisible is true), close sidebar after navigation
              // Only close sidebar on mobile, not on desktop
              if (typeof window !== 'undefined' && window.innerWidth < 1024 && !sidebarCollapsed && isVisible && onToggle) {
                onToggle();
              }
            }}
            className={`group flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
              item.current
                ? 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-900 shadow-lg transform scale-105'
                : 'text-gray-700 hover:text-blue-900 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-md hover:transform hover:scale-105'
            } ${sidebarCollapsed ? 'justify-center px-3' : ''}`}
            title={sidebarCollapsed ? item.name : undefined}
          >
            <span className={`text-lg mr-3 group-hover:scale-110 transition-transform duration-200 ${
              item.current ? 'text-blue-600' : 'text-gray-500 group-hover:text-blue-600'
            }`}>{item.icon}</span>
            {!sidebarCollapsed && (
              <div className="flex items-center justify-between flex-1">
                <span className="text-sm font-medium">{item.name}</span>
                {item.name === 'Dashboard' && (
                  <span className="text-xs bg-blue-200 text-blue-800 rounded-full px-2 py-1 font-bold">
                  </span>
                )}
              </div>
            )}
            {sidebarCollapsed && (
              <div className="absolute left-20 ml-3 px-4 py-3 bg-gray-900 text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 shadow-2xl" suppressHydrationWarning>
                <div className="font-semibold" suppressHydrationWarning>{item.name}</div>
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900" suppressHydrationWarning></div>
              </div>
            )}
          </Link>
        ))}
      </nav>

      
    </div>
  );
}
