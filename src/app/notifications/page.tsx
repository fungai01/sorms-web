"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { getNotificationsByRole, markAsRead, markAllAsRead, deleteNotification, type Notification } from "@/lib/notifications";


export default function NotificationsPage() {
  const router = useRouter();
  
  // Set user role in sessionStorage based on previous page or default to office
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const previousPage = sessionStorage.getItem('previousPage');
      let role = 'office'; // default
      
      if (previousPage) {
        if (previousPage.startsWith('/admin')) role = 'admin';
        else if (previousPage.startsWith('/office')) role = 'office';
        else if (previousPage.startsWith('/staff')) role = 'staff';
        else if (previousPage.startsWith('/user')) role = sessionStorage.getItem('userRole') || 'user';
      }
      
      sessionStorage.setItem('userRole', role);
    }
  }, []);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load notifications and listen for updates
  useEffect(() => {
    const getUserRole = () => {
      if (typeof window !== 'undefined') {
        return sessionStorage.getItem('userRole');
      }
      return null;
    };
    
    const userRole = getUserRole() as 'admin' | 'office' | 'staff' | 'user' || 'user';
    setNotifications(getNotificationsByRole(userRole));

    // Listen for notification updates
    const handleNotificationUpdate = (event: CustomEvent) => {
      setNotifications(getNotificationsByRole(userRole));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('notificationsUpdated', handleNotificationUpdate as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('notificationsUpdated', handleNotificationUpdate as EventListener);
      }
    };
  }, []);

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'type'>('time');

  const filteredNotifications = notifications
    .filter(notif => filter === 'all' || notif.unread)
    .sort((a, b) => {
      if (sortBy === 'time') {
        return new Date(b.time).getTime() - new Date(a.time).getTime();
      }
      return (a.type || '').localeCompare(b.type || '');
    });

  const handleMarkAsRead = (id: number) => {
    // Use the notification system
    markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    // Use the notification system
    markAllAsRead();
  };

  const handleDeleteNotification = (id: number) => {
    // Use the notification system
    deleteNotification(id);
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'success':
        return <Badge tone="success">Thành công</Badge>;
      case 'warning':
        return <Badge tone="warning">Cảnh báo</Badge>;
      case 'error':
        return <Badge tone="error">Lỗi</Badge>;
      default:
        return <Badge>Thông tin</Badge>;
    }
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1 pl-4">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Thông báo</h1>
              <p className="text-sm lg:text-base text-gray-600 mt-1">Quản lý và theo dõi các thông báo hệ thống</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <Button 
                onClick={() => router.back()}
                variant="secondary"
                className="h-9 px-4 text-sm whitespace-nowrap"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Quay lại
              </Button>
              {unreadCount > 0 && (
                <Button 
                  onClick={handleMarkAllAsRead}
                  variant="secondary"
                  className="h-9 px-4 text-sm whitespace-nowrap"
                >
                  Đánh dấu tất cả đã đọc
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lọc thông báo</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                value={filter} 
                onChange={(e) => setFilter(e.target.value as any)}
              >
                <option value="all">Tất cả thông báo</option>
                <option value="unread">Chưa đọc ({unreadCount})</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sắp xếp</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="time">Theo thời gian</option>
                <option value="type">Theo loại</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                Hiển thị {filteredNotifications.length} thông báo
              </div>
            </div>
            <div className="flex items-end">
              {unreadCount > 0 && (
                <div className="text-sm text-red-600 font-medium">
                  {unreadCount} thông báo chưa đọc
                </div>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="space-y-4">
            {filteredNotifications.length === 0 ? (
              <Card>
                <CardBody className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Không có thông báo</h3>
                  <p className="text-gray-500">Hiện tại không có thông báo nào phù hợp với bộ lọc của bạn.</p>
                </CardBody>
              </Card>
            ) : (
              filteredNotifications.map((notification) => (
                <Card key={notification.id} className={`transition-all duration-200 ${
                  notification.unread ? 'ring-2 ring-blue-200 bg-blue-50' : ''
                }`}>
                  <CardBody>
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          {getTypeIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <h3 className="text-lg font-semibold text-gray-900">{notification.title}</h3>
                            {notification.unread && (
                              <Badge tone="success">Mới</Badge>
                            )}
                            {getTypeBadge(notification.type)}
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed mb-3">{notification.message}</p>
                          <div className="flex items-center text-sm text-gray-500">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {notification.time}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row lg:flex-col gap-2">
                        {notification.unread && (
                          <Button 
                            variant="secondary" 
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="w-full sm:w-auto lg:w-full"
                          >
                            Đánh dấu đã đọc
                          </Button>
                        )}
                        <Button 
                          variant="danger" 
                          onClick={() => handleDeleteNotification(notification.id)}
                          className="w-full sm:w-auto lg:w-full"
                        >
                          Xóa
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))
            )}
          </div>

          {/* Summary */}
          <Card>
            <CardHeader>
              <div className="text-sm text-gray-600">
                Tổng: {filteredNotifications.length} thông báo ({unreadCount} chưa đọc)
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    </>
  );
}
