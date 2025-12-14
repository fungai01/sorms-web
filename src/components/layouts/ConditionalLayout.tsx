"use client";

import type { ReactNode } from "react";
import Header from "@/components/ui/Header";
import Sidebar from "@/components/ui/Sidebar";
import Footer from "@/components/ui/Footer";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import RoleGuard from "./RoleGuard";
interface ConditionalLayoutProps {
  children: ReactNode;
}

function ConditionalLayoutContent({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true); // Sidebar visibility (show/hide)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // Sidebar collapsed state (icon/full)
  // Removed SidebarContext dependency
  const [user, setUser] = useState<{
    name: string;
    email: string;
    role: string;
    avatar?: string;
  } | null>(null);

  // Check if current path should skip header, footer, and sidebar
  const skipLayout = pathname?.startsWith('/security/checkin') || pathname?.startsWith('/security/open-door');

  // Persist sidebar state across page navigation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSidebarVisible = localStorage.getItem('sidebarVisible');
      const savedSidebarCollapsed = localStorage.getItem('sidebarCollapsed');
      
      if (savedSidebarVisible !== null) {
        setSidebarVisible(savedSidebarVisible === 'true');
      }
      if (savedSidebarCollapsed !== null) {
        setSidebarCollapsed(savedSidebarCollapsed === 'true');
      }
    }
  }, []);

  // Save sidebar state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarVisible', sidebarVisible.toString());
      localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
    }
  }, [sidebarVisible, sidebarCollapsed]);

  // Load user data from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('userName');
      const storedEmail = localStorage.getItem('userEmail');
      const storedRole = localStorage.getItem('userRole');
      
      if (storedName && storedRole) {
        const roleMap = {
          'admin': 'Administrator',
          'office': 'Office Staff', 
          'lecturer': 'Lecturer',
          'staff': 'Staff',
          'guest': 'Guest'
        };
        setUser({ 
          name: storedName, 
          email: storedEmail || '',
          role: roleMap[storedRole as keyof typeof roleMap] || storedRole 
        });
      }
    }
  }, []);

  // If skipLayout is true, render only the content without header, footer, sidebar
  if (skipLayout) {
    return (
      <div className="min-h-screen bg-gray-50" suppressHydrationWarning>
        <RoleGuard>
          {children}
        </RoleGuard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" suppressHydrationWarning>
      {/* Desktop Sidebar - Fixed on left */}
      <div className="hidden lg:block lg:fixed lg:inset-y-0 lg:left-0 lg:z-20" suppressHydrationWarning>
        <Sidebar 
          user={user || undefined} 
          isVisible={true}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>
      
      {/* Main Content Area - Pushed to right */}
      <div className={`lg:transition-all lg:duration-300 ${sidebarCollapsed ? 'lg:ml-16 xl:ml-20' : 'lg:ml-64 xl:ml-72'}`} suppressHydrationWarning>
        {/* Header */}
        <div className="sticky top-0 z-30" suppressHydrationWarning>
          <Header onToggleSidebar={() => {
            // On mobile, open the mobile sidebar
            // On desktop, toggle the sidebar collapsed state
            if (window.innerWidth < 1024) {
              setSidebarOpen(true);
            } else {
              setSidebarCollapsed(!sidebarCollapsed);
            }
          }} />
        </div>
        
        {/* Page content */}
        <main className="min-h-screen pb-8 sm:pb-0">
          <RoleGuard>
            {children}
          </RoleGuard>
        </main>
        
        {/* Footer */}
        <Footer />
      </div>
      
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-20" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs sm:max-w-sm w-full bg-white">
            <Sidebar 
              user={user || undefined} 
              isVisible={true} 
              collapsed={false}
              onToggle={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  return (
    <ConditionalLayoutContent>
      {children}
    </ConditionalLayoutContent>
  );
}