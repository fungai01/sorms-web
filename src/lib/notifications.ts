export interface Notification {
  id: number;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
  category?: 'booking' | 'task' | 'system' | 'payment';
  visibleTo?: ('admin' | 'office' | 'staff' | 'user')[]; // Who can see this notification
  createdBy?: 'admin' | 'office' | 'staff' | 'user'; // Who created this notification
}

// Store notifications in localStorage for persistence
const NOTIFICATIONS_KEY = 'sorms_notifications';

// Helper function to fix duplicate IDs
const fixDuplicateIds = (notifications: Notification[]): Notification[] => {
  const seenIds = new Set<number>();
  const fixedNotifications: Notification[] = [];
  
  for (const notification of notifications) {
    if (seenIds.has(notification.id)) {
      // Generate new unique ID for duplicate
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const newId = parseInt(`${timestamp}${random.toString().padStart(3, '0')}`);
      fixedNotifications.push({ ...notification, id: newId });
      seenIds.add(newId);
    } else {
      fixedNotifications.push(notification);
      seenIds.add(notification.id);
    }
  }
  
  return fixedNotifications;
};

export const getNotifications = (): Notification[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    if (stored) {
      const notifications = JSON.parse(stored);
      // Fix any duplicate IDs by reassigning them
      const fixedNotifications = fixDuplicateIds(notifications);
      if (fixedNotifications !== notifications) {
        saveNotifications(fixedNotifications);
      }
      return fixedNotifications;
    } else {
      // Do not seed sample data; keep empty until real events create notifications
      const empty: Notification[] = [];
      saveNotifications(empty);
      return empty;
    }
  } catch {
    return [];
  }
};

export const saveNotifications = (notifications: Notification[]): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error('Failed to save notifications:', error);
  }
};

export const addNotification = (notification: Omit<Notification, 'id' | 'time' | 'unread'>): void => {
  const notifications = getNotifications();
  
  // Generate unique ID by combining timestamp with random number
  const generateUniqueId = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return parseInt(`${timestamp}${random.toString().padStart(3, '0')}`);
  };
  
  const newNotification: Notification = {
    ...notification,
    id: generateUniqueId(),
    time: 'Vừa xong',
    unread: true,
  };
  
  // Add to beginning of array (newest first)
  notifications.unshift(newNotification);
  
  // Keep only last 50 notifications
  if (notifications.length > 50) {
    notifications.splice(50);
  }
  
  saveNotifications(notifications);
  
  // Dispatch custom event to notify other components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('notificationsUpdated', { 
      detail: { notifications } 
    }));
  }
};

export const markAsRead = (id: number): void => {
  const notifications = getNotifications();
  const updated = notifications.map(n => 
    n.id === id ? { ...n, unread: false } : n
  );
  saveNotifications(updated);
  
  // Dispatch custom event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('notificationsUpdated', { 
      detail: { notifications: updated } 
    }));
  }
};

export const markAllAsRead = (): void => {
  const notifications = getNotifications();
  const updated = notifications.map(n => ({ ...n, unread: false }));
  saveNotifications(updated);
  
  // Dispatch custom event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('notificationsUpdated', { 
      detail: { notifications: updated } 
    }));
  }
};

export const deleteNotification = (id: number): void => {
  const notifications = getNotifications();
  const updated = notifications.filter(n => n.id !== id);
  saveNotifications(updated);
  
  // Dispatch custom event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('notificationsUpdated', { 
      detail: { notifications: updated } 
    }));
  }
};

// Helper function to create booking notifications
export const createBookingNotification = (
  bookingId: number,
  guestName: string,
  roomInfo: string,
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED',
  rejectionReason?: string
): void => {
  let title = '';
  let message = '';
  let type: 'info' | 'success' | 'warning' | 'error' = 'info';
  let visibleTo: ('admin' | 'office' | 'staff' | 'user')[] = [];
  
  switch (status) {
    case 'PENDING':
      title = 'Yêu cầu đặt phòng mới';
      message = `Có yêu cầu đặt phòng mới từ ${guestName} cho ${roomInfo}. Vui lòng xem xét và xác nhận.`;
      type = 'info';
      visibleTo = ['admin', 'office']; // Only admin and office can see pending requests
      break;
    case 'CONFIRMED':
      title = 'Đặt phòng đã được xác nhận';
      message = `Yêu cầu đặt phòng của bạn cho ${roomInfo} đã được hành chính xác nhận thành công.`;
      type = 'success';
      visibleTo = ['admin', 'user']; // Admin and user can see confirmations
      break;
    case 'REJECTED':
      title = 'Đặt phòng bị từ chối';
      message = `Yêu cầu đặt phòng của bạn cho ${roomInfo} đã bị từ chối. Lý do: ${rejectionReason || 'Không có lý do cụ thể'}.`;
      type = 'warning';
      visibleTo = ['admin', 'user']; // Admin and user can see rejections
      break;
  }
  
  addNotification({
    title,
    message,
    type,
    category: 'booking',
    visibleTo,
    createdBy: status === 'PENDING' ? 'user' : 'office'
  });
};

// Get notifications filtered by user role
export const getNotificationsByRole = (userRole: 'admin' | 'office' | 'staff' | 'user'): Notification[] => {
  const allNotifications = getNotifications();
  
  // Admin can see all notifications
  if (userRole === 'admin') {
    return allNotifications;
  }
  
  // Filter notifications based on visibleTo field
  return allNotifications.filter(notification => {
    // If no visibleTo specified, show to everyone
    if (!notification.visibleTo || notification.visibleTo.length === 0) {
      return true;
    }
    
    // Check if user role is in visibleTo array
    return notification.visibleTo.includes(userRole);
  });
};

// Helper function to create task notifications
export const createTaskNotification = (
  taskTitle: string,
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED',
  assignedBy?: string,
  rejectionReason?: string
): void => {
  let title = '';
  let message = '';
  let type: 'info' | 'success' | 'warning' | 'error' = 'info';
  let visibleTo: ('admin' | 'office' | 'staff' | 'user')[] = [];
  
  switch (status) {
    case 'PENDING':
      title = 'Công việc mới';
      message = `Bạn có công việc mới: '${taskTitle}'. Giao bởi: ${assignedBy || 'Quản lý'}.`;
      type = 'info';
      visibleTo = ['admin', 'staff']; // Admin and staff can see new tasks
      break;
    case 'ACCEPTED':
      title = 'Công việc đã được nhận';
      message = `Công việc '${taskTitle}' đã được nhận và sẵn sàng để bắt đầu.`;
      type = 'success';
      visibleTo = ['admin', 'office', 'staff']; // Admin, office, and staff can see acceptances
      break;
    case 'REJECTED':
      title = 'Công việc bị từ chối';
      message = `Công việc '${taskTitle}' đã bị từ chối. Lý do: ${rejectionReason || 'Không có lý do cụ thể'}.`;
      type = 'warning';
      visibleTo = ['admin', 'office', 'staff']; // Admin, office, and staff can see rejections
      break;
    case 'IN_PROGRESS':
      title = 'Công việc đang thực hiện';
      message = `Công việc '${taskTitle}' đã được bắt đầu thực hiện.`;
      type = 'info';
      visibleTo = ['admin', 'office', 'staff']; // Admin, office, and staff can see progress
      break;
    case 'COMPLETED':
      title = 'Công việc hoàn thành';
      message = `Công việc '${taskTitle}' đã được hoàn thành thành công.`;
      type = 'success';
      visibleTo = ['admin', 'office', 'staff']; // Admin, office, and staff can see completions
      break;
  }
  
  addNotification({
    title,
    message,
    type,
    category: 'task',
    visibleTo,
    createdBy: status === 'PENDING' ? 'office' : 'staff'
  });
};
