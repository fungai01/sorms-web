"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import Button from "./Button";

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
}

export default function Sidebar({ user, isVisible = false, collapsed = true, onToggle, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Use collapsed prop from parent instead of local state
  const sidebarCollapsed = collapsed;

  const isAdmin = pathname.startsWith('/admin');
  const isOffice = pathname.startsWith('/office');
  const isStaff = pathname.startsWith('/staff');
  const isSecurity = pathname.startsWith('/security');
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
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
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
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
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
    // Check userRole from sessionStorage first, then fallback to path detection
    const currentRole = (role || userRole || (isAdmin ? 'admin' : isOffice ? 'office' : isStaff ? 'staff' : isUser ? 'user' : null)) as string | null;
    
    if (isAdmin || currentRole === 'admin') {
      return [
        { 
          name: 'Dashboard', 
          href: '/admin/dashboard', 
          icon: <Icons.Dashboard />, 
          current: pathname === '/admin/dashboard'
        },
        { 
          name: 'Phòng', 
          href: '/admin/rooms', 
          icon: <Icons.Rooms />, 
          current: pathname.startsWith('/admin/rooms')
        },
        { 
          name: 'Loại phòng', 
          href: '/admin/room-types', 
          icon: <Icons.RoomTypes />, 
          current: pathname.startsWith('/admin/room-types')
        },
        { 
          name: 'Đặt phòng', 
          href: '/admin/bookings', 
          icon: <Icons.Bookings />, 
          current: pathname.startsWith('/admin/bookings')
        },
        { 
          name: 'Dịch vụ', 
          href: '/admin/services', 
          icon: <Icons.Services />, 
          current: pathname.startsWith('/admin/services')
        },
        // Đã ẩn: Đơn dịch vụ không còn được sử dụng
        // { 
        //   name: 'Đơn dịch vụ', 
        //   href: '/admin/service-orders', 
        //   icon: <Icons.ServiceOrders />, 
        //   current: pathname.startsWith('/admin/service-orders')
        // },
        { 
          name: 'Thanh toán', 
          href: '/admin/payments', 
          icon: <Icons.Payments />, 
          current: pathname.startsWith('/admin/payments')
        },
        { 
          name: 'Công việc', 
          href: '/admin/tasks', 
          icon: <Icons.Tasks />, 
          current: pathname.startsWith('/admin/tasks')
        },
        { 
          name: 'Người dùng', 
          href: '/admin/users', 
          icon: <Icons.Users />, 
          current: pathname.startsWith('/admin/users')
        },
        { 
          name: 'Nhân sự', 
          href: '/admin/staff-profiles', 
          icon: <Icons.Users />, 
          current: pathname.startsWith('/admin/staff-profiles')
        },
        { 
          name: 'Phân quyền', 
          href: '/admin/roles', 
          icon: <Icons.Roles />, 
          current: pathname.startsWith('/admin/roles')
        },
        { 
          name: 'Báo cáo', 
          href: '/admin/reports', 
          icon: <Icons.Payments />, 
          current: pathname.startsWith('/admin/reports')
        },
      ];
    } else if (isOffice || currentRole === 'office') {
      return [
        { name: 'Dashboard', href: '/office/dashboard', icon: <Icons.Dashboard />, current: pathname.startsWith('/office/dashboard') },
        { name: 'Duyệt đặt phòng', href: '/office/bookings', icon: <Icons.Bookings />, current: pathname.startsWith('/office/bookings') },
        { name: 'Quản lý phòng', href: '/office/rooms', icon: <Icons.Rooms />, current: pathname.startsWith('/office/rooms') },
        { name: 'Báo cáo', href: '/office/reports', icon: <Icons.Payments />, current: pathname.startsWith('/office/reports') },
      ];
  
    } else if (isStaff || currentRole === 'staff') {
      return [
        { name: 'Dashboard', href: '/staff/dashboard', icon: <Icons.Dashboard />, current: pathname.startsWith('/staff/dashboard') },
      ];
    
    } else if (isSecurity || currentRole === 'security') {
      return [
        { name: 'Dashboard', href: '/security/dashboard', icon: <Icons.Dashboard />, current: pathname.startsWith('/security/dashboard') },
      ];

    } else if (isUser || currentRole === 'user') {
      return [
        { name: 'Dashboard', href: '/user/dashboard', icon: <Icons.Dashboard />, current: pathname.startsWith('/user/dashboard') },
      ];
    } else if (isProfile) {
      return [
        { name: 'Hồ sơ cá nhân', href: '/profile', icon: <Icons.Dashboard />, current: pathname === '/profile' },
      ];
    } else {
      return [
        { name: 'Dashboard', href: '/', icon: <Icons.Dashboard />, current: pathname === '/' },
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
      {/* Header */}
      <div className="p-4 border-b border-gray-100/50 bg-gradient-to-r from-gray-50 to-white" suppressHydrationWarning>
        {sidebarCollapsed ? (
          <div className="flex justify-center" suppressHydrationWarning>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg" suppressHydrationWarning>
              <span className="text-white font-bold text-sm">S</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between" suppressHydrationWarning>
            <div className="flex items-center space-x-3" suppressHydrationWarning>
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg" suppressHydrationWarning>
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-gray-900">SORMS</span>
                <span className="text-xs text-gray-500 font-medium">Smart Office</span>
              </div>
            </div>
            <Button
              onClick={onToggleCollapsed}
              variant="ghost"
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </Button>
          </div>
        )}
      </div>

      

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
                ? 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-900 border-l-4 border-blue-500 shadow-lg transform scale-105'
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
