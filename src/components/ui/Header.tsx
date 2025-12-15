"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import Button from "./Button";
import Input from "./Input";
import { getNotificationsByRole, markAsRead, markAllAsRead, type Notification } from "@/lib/notifications";
import { authService } from "@/lib/auth-service";
import Image from "next/image";
import Logo from "@/img/Logo.png";

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Use real notification system
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const pathname = usePathname();
  const router = useRouter();

  const isAdmin = pathname.startsWith('/admin');
  const isOffice = pathname.startsWith('/office');
  const isLecturer = false; // merged into /user
  const isStaff = pathname.startsWith('/staff');
  const isSecurity = pathname.startsWith('/security');
  const isGuest = false; // merged into /user
  
  // Check if user is logged in (on protected pages)
  const isUser = pathname.startsWith('/user');
  const isLoggedIn = isAdmin || isOffice || isStaff || isSecurity || isUser;
  const role = useCurrentRole();

  // Auto-detect user role based on path and localStorage
  const [detectedUser, setDetectedUser] = useState<{
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
  } | null>(null);

  // Load notifications and listen for updates
  useEffect(() => {
    const getUserRole = () => {
      if (typeof window !== 'undefined') {
        if (isAdmin) return 'admin';
        if (isOffice) return 'office';
        if (isStaff) return 'staff';
        if (isSecurity) return 'security';
        if (isUser) return 'user';
        return (sessionStorage.getItem('userRole') as string) || 'user';
      }
      return 'user';
    };
    
    const userRole = getUserRole() as 'admin' | 'office' | 'staff' | 'security' | 'user';
    setNotifications(getNotificationsByRole(userRole));

    // Listen for notification updates
    const handleNotificationUpdate = (event: CustomEvent) => {
      // Re-evaluate role in case route changed
      const currentRole = getUserRole() as 'admin' | 'office' | 'staff' | 'security' | 'user';
      setNotifications(getNotificationsByRole(currentRole));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('notificationsUpdated', handleNotificationUpdate as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('notificationsUpdated', handleNotificationUpdate as EventListener);
      }
    };
  }, [isAdmin, isOffice, isStaff, isSecurity, isUser]);

  // Function to load user info including avatar
  const loadUserInfo = () => {
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('userName');
      const storedEmail = localStorage.getItem('userEmail');
      const storedRole = (role || localStorage.getItem('userRole')) as string | null;
      
      // Get avatar from userInfo in localStorage (from auth-service)
      let avatarUrl: string | undefined;
      try {
        const userInfoStr = localStorage.getItem('auth_user_info');
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          avatarUrl = userInfo.avatarUrl || userInfo.picture;
        }
      } catch (e) {
        console.error('Error parsing userInfo:', e);
      }
      
      // Fallback: try to get from localStorage directly
      if (!avatarUrl) {
        avatarUrl = localStorage.getItem('userAvatar') || undefined;
      }
      
      if (storedName && storedRole) {
        const roleMap = {
          'admin': 'Admin System',
          'office': 'Administrative',
          'staff': 'Staff',
          'security': 'Security',
          'user': 'User'
        };
        setDetectedUser({
          name: storedName,
          email: storedEmail || '',
          role: roleMap[storedRole as keyof typeof roleMap] || storedRole,
          avatarUrl: avatarUrl
        });
      }
    }
  };

  useEffect(() => {
    loadUserInfo();
    
    // Listen for storage changes (when avatar is updated in profile page)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_user_info' || e.key === 'userAvatar') {
        loadUserInfo();
      }
    };
    
    // Listen for custom event (when avatar is updated via API)
    const handleAvatarUpdate = () => {
      loadUserInfo();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('avatarUpdated', handleAvatarUpdate as EventListener);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('avatarUpdated', handleAvatarUpdate as EventListener);
      }
    };
  }, [isAdmin, isOffice, isLecturer, isStaff, isGuest, role]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-menu]')) {
        setProfileMenuOpen(false);
        setNotificationMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Don't render header on public pages (not logged in)
  if (!isLoggedIn) {
    return null;
  }

  // Show loading state while detecting user
  if (!detectedUser) {
    return (
      <header className="bg-white border-b border-gray-200" suppressHydrationWarning>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" suppressHydrationWarning>
          <div className="flex justify-between items-center h-16" suppressHydrationWarning>
            <div className="flex items-center space-x-4" suppressHydrationWarning>
              <div className="w-8 h-8 bg-gray-200 rounded-md animate-pulse" suppressHydrationWarning></div>
              <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" suppressHydrationWarning></div>
            </div>
            <div className="flex items-center space-x-4" suppressHydrationWarning>
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" suppressHydrationWarning></div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Implement search functionality
      console.log('Searching for:', searchQuery);
      // You can add search logic here
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      // Gọi backend API để logout
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Vẫn tiếp tục xóa local storage dù API call fail
      authService.clearAuth();
    }
    
    // Clear sidebar state
    try {
      localStorage.removeItem('sidebarVisible');
      localStorage.removeItem('sidebarCollapsed');
    } catch {}
    
    // Hard redirect to reset any in-memory state
    window.location.href = '/login';
  };

  // Mark notification as read and navigate to appropriate page
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read using the notification system
    markAsRead(notification.id);

    // Close notification dropdown
    setNotificationMenuOpen(false);
    
    // Store current page as previous page
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('previousPage', window.location.pathname);
    }
    
    // Navigate based on notification category
    if (notification.category === 'booking') {
      // Navigate to bookings page based on role
      if (isAdmin) {
        router.push('/admin/bookings');
      } else if (isOffice) {
        router.push('/office/bookings');
      } else {
        router.push('/notifications');
      }
    } else {
      // For other notification types, go to notifications page
      router.push('/notifications');
    }
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40" suppressHydrationWarning>
      <div className="w-full px-4 sm:px-6 lg:px-8" suppressHydrationWarning>
        <div className="flex justify-between items-center h-14 sm:h-16" suppressHydrationWarning>
          {/* Logo and Sidebar Toggle */}
          <div className="flex items-center" suppressHydrationWarning>
            {/* Sidebar Toggle Button */}
            <button
              onClick={onToggleSidebar}
              className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 110 2H4a1 1 0 01-1-1zM3 12a1 1 0 011-1h16a1 1 0 110 2H4a1 1 0 01-1-1zM3 20a1 1 0 011-1h16a1 1 0 110 2H4a1 1 0 01-1-1z" />
              </svg>
            </button>

            {/* Logo */}
            <Link
              href={isAdmin ? "/admin/dashboard" : isOffice ? "/office/dashboard" : isStaff ? "/staff/dashboard" : isUser ? "/user/dashboard" : "/"}
              className="flex items-center space-x-2 sm:space-x-3 ml-3 sm:ml-6"
            >
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden">
                <Image src={Logo} alt="SORMS logo" fill sizes="(max-width: 640px) 40px, 60px" className="object-cover" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm sm:text-lg font-semibold text-gray-900">SORMS</span>
                <span className="text-xs text-gray-500 hidden sm:block">Smart Office</span>
              </div>
            </Link>
          </div>

          {/* Right Side Menu */}
          <div className="flex items-center space-x-1 sm:space-x-2" suppressHydrationWarning>
            {/* Notifications */}
            <div className="relative" data-menu>
              <Button 
                onClick={() => setNotificationMenuOpen(!notificationMenuOpen)}
                variant="ghost"
                className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md relative"
              >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0" />
              </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {unreadCount}
                  </span>
                )}
              </Button>

              {/* Notification Dropdown */}
              {notificationMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-md border border-gray-300 z-50 shadow-lg">
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">Thông báo</h3>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{unreadCount} mới</span>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                          notification.unread ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${notification.unread ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <p className="text-sm font-semibold text-gray-900 leading-tight">{notification.title}</p>
                              {notification.unread && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Mới
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 mt-2 leading-relaxed whitespace-normal break-words">{notification.message}</p>
                            <p className="text-xs text-gray-500 mt-2 flex items-center">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {notification.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <div className="p-8 text-center text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0" />
                        </svg>
                        <p className="text-sm">Không có thông báo nào</p>
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-gray-100 bg-gray-50">
                    <Button 
                      variant="ghost" 
                      className="w-full text-center text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                      onClick={() => {
                        setNotificationMenuOpen(false);
                        // Store current page as previous page
                        if (typeof window !== 'undefined') {
                          sessionStorage.setItem('previousPage', window.location.pathname);
                        }
                        router.push('/notifications');
                      }}
                    >
                      Xem tất cả thông báo
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            {detectedUser && (
              <div className="relative" data-menu>
                <Button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  variant="ghost"
                  className="flex items-center space-x-1 sm:space-x-2 hover:bg-gray-100 rounded-md p-1.5 sm:p-2"
                >
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-200 rounded-md flex items-center justify-center overflow-hidden">
                    {detectedUser.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={detectedUser.avatarUrl} 
                        alt={detectedUser.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to initial if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('span');
                            fallback.className = 'text-gray-700 text-xs sm:text-sm font-medium';
                            fallback.textContent = detectedUser.name?.charAt(0) || 'A';
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <span className="text-gray-700 text-xs sm:text-sm font-medium">
                        {detectedUser.name?.charAt(0) || 'A'}
                      </span>
                    )}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-medium text-gray-900">
                      {detectedUser.name}
                    </div>
                    <div className="text-xs text-gray-500">{detectedUser.role}</div>
                  </div>
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>

                {/* Profile Dropdown Menu */}
                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md border border-gray-300 z-50">
                    {/* User Info Header */}
                      <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-md flex items-center justify-center overflow-hidden">
                          {detectedUser.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img 
                              src={detectedUser.avatarUrl} 
                              alt={detectedUser.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback to initial if image fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  const fallback = document.createElement('span');
                                  fallback.className = 'text-gray-700 font-medium';
                                  fallback.textContent = detectedUser.name?.charAt(0) || 'A';
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          ) : (
                            <span className="text-gray-700 font-medium">
                              {detectedUser.name?.charAt(0) || 'A'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{detectedUser.name}</div>
                          <div className="text-xs text-gray-500 truncate">{detectedUser.email}</div>
                          <div className="text-xs text-gray-600 font-medium">{detectedUser.role}</div>
                        </div>
                      </div>
                      </div>

                      {/* Menu Items */}
                      <div className="py-1">
                      <Button variant="ghost" className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 justify-start" onClick={() => {
                        // Store current page before navigating to profile
                        if (typeof window !== 'undefined') {
                          sessionStorage.setItem('previousPage', window.location.pathname);
                        }
                        window.location.href = '/profile';
                      }}>
                        <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        <span>Hồ sơ cá nhân</span>
                      </Button>
                      </div>

                      {/* Logout */}
                    <div className="border-t border-gray-100">
                      <Button 
                        onClick={handleLogout}
                        variant="ghost"
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 justify-start"
                      >
                        <svg className="w-4 h-4 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                        <span>Đăng xuất</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
