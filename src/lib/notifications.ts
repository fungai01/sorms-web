import { generateUniqueId } from './utils'

export interface Notification {
  id: number;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
  category?: 'booking' | 'task' | 'system' | 'payment';
  visibleTo?: ('admin' | 'office' | 'staff' | 'security' | 'user')[];
  createdBy?: 'admin' | 'office' | 'staff' | 'security' | 'user';
}

const NOTIFICATIONS_KEY = 'sorms_notifications';

const fixDuplicateIds = (notifications: Notification[]): Notification[] => {
  const seenIds = new Set<number>();
  const fixedNotifications: Notification[] = [];
  
  for (const notification of notifications) {
    if (seenIds.has(notification.id)) {
      const newId = generateUniqueId();
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
      const fixedNotifications = fixDuplicateIds(notifications);
      if (fixedNotifications !== notifications) {
        saveNotifications(fixedNotifications);
      }
      return fixedNotifications;
    } else {
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
  const newNotification: Notification = {
    ...notification,
    id: generateUniqueId(),
    time: 'Vừa xong',
    unread: true,
  };
  
  notifications.unshift(newNotification);
  
  if (notifications.length > 50) {
    notifications.splice(50);
  }
  
  saveNotifications(notifications);
  
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
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('notificationsUpdated', { 
      detail: { notifications: updated } 
    }));
  }
};

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
  let visibleTo: ('admin' | 'office' | 'staff' | 'security' | 'user')[] = [];
  
  switch (status) {
    case 'PENDING':
      title = 'Yêu cầu đặt phòng mới';
      message = `Có yêu cầu đặt phòng mới từ ${guestName} cho ${roomInfo}. Vui lòng xem xét và xác nhận.`;
      type = 'info';
      visibleTo = ['admin', 'office'];
      break;
    case 'CONFIRMED':
      title = 'Đặt phòng đã được xác nhận';
      message = `Yêu cầu đặt phòng của bạn cho ${roomInfo} đã được hành chính xác nhận thành công.`;
      type = 'success';
      visibleTo = ['admin', 'office', 'user'];
      break;
    case 'REJECTED':
      title = 'Đặt phòng bị từ chối';
      message = `Yêu cầu đặt phòng của bạn cho ${roomInfo} đã bị từ chối. Lý do: ${rejectionReason || 'Không có lý do cụ thể'}.`;
      type = 'warning';
      visibleTo = ['admin', 'office', 'user'];
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

export const getNotificationsByRole = (userRole: 'admin' | 'office' | 'staff' | 'security' | 'user'): Notification[] => {
  const allNotifications = getNotifications();
  
  if (userRole === 'admin') {
    return allNotifications;
  }
  
  return allNotifications.filter(notification => {
    if (!notification.visibleTo || notification.visibleTo.length === 0) {
      return true;
    }
    return notification.visibleTo.includes(userRole);
  });
};

export const createTaskNotification = (
  taskTitle: string,
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED',
  assignedBy?: string,
  rejectionReason?: string
): void => {
  let title = '';
  let message = '';
  let type: 'info' | 'success' | 'warning' | 'error' = 'info';
  let visibleTo: ('admin' | 'office' | 'staff' | 'security' | 'user')[] = [];
  
  switch (status) {
    case 'PENDING':
      title = 'Công việc mới';
      message = `Bạn có công việc mới: '${taskTitle}'. Giao bởi: ${assignedBy || 'Quản lý'}.`;
      type = 'info';
      visibleTo = ['admin', 'staff'];
      break;
    case 'ACCEPTED':
      title = 'Công việc đã được nhận';
      message = `Công việc '${taskTitle}' đã được nhận và sẵn sàng để bắt đầu.`;
      type = 'success';
      visibleTo = ['admin', 'office', 'staff'];
      break;
    case 'REJECTED':
      title = 'Công việc bị từ chối';
      message = `Công việc '${taskTitle}' đã bị từ chối. Lý do: ${rejectionReason || 'Không có lý do cụ thể'}.`;
      type = 'warning';
      visibleTo = ['admin', 'office', 'staff'];
      break;
    case 'IN_PROGRESS':
      title = 'Công việc đang thực hiện';
      message = `Công việc '${taskTitle}' đã được bắt đầu thực hiện.`;
      type = 'info';
      visibleTo = ['admin', 'office', 'staff'];
      break;
    case 'COMPLETED':
      title = 'Công việc hoàn thành';
      message = `Công việc '${taskTitle}' đã được hoàn thành thành công.`;
      type = 'success';
      visibleTo = ['admin', 'office', 'staff'];
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
