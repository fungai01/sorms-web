// Unified services: Face recognition, QR codes, Notifications
import { API_CONFIG } from './config'
import { authService } from './auth-service'
import { generateUniqueId } from './utils'

// ========== Face Recognition Service ==========

function getAuthHeaders(): HeadersInit {
  const token = authService.getAccessToken()
  const headers: HeadersInit = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

function getUserInfo() {
  return authService.getUserInfo()
}

export async function getFaceStatus(bookingId: number) {
  const userInfo = getUserInfo()
  if (!userInfo?.id) {
    throw new Error('Not authenticated')
  }

  const headers = getAuthHeaders()
  const res = await fetch(
    `${API_CONFIG.BASE_URL}/ai/recognition/faces/${userInfo.id}`,
    {
      method: 'GET',
      headers,
    }
  )

  if (!res.ok) {
    if (res.status === 404) {
      return { registered: false }
    }
    const errorData = await res.json().catch(() => ({}))
    // Handle backend error format
    const errorMessage = errorData.error || errorData.message || errorData.responseCode || `HTTP ${res.status}`
    throw new Error(errorMessage)
  }

  const data = await res.json().catch(() => ({}))
  // Handle backend response format
  const faceData = data.responseCode === 'S0000' ? (data.data || data) : (data.data || data)
  
  return {
    registered: true,
    data: faceData,
  }
}

export async function registerFace(bookingId: number, formData: FormData) {
  const userInfo = getUserInfo()
  if (!userInfo?.id) {
    throw new Error('Not authenticated')
  }

  // Backend expects "images" parameter (List<MultipartFile>)
  // Convert all image files to "images" array
  const newFormData = new FormData()
  
  // Collect all image files from the original FormData
  const imageFiles: File[] = []
  for (const [key, value] of formData.entries()) {
    if (value instanceof File && (key.includes('face') || key.includes('image') || key.includes('cccd'))) {
      imageFiles.push(value)
    }
  }

  // Backend requires at least 3 images, preferably 3-5
  if (imageFiles.length < 3) {
    throw new Error('Cần ít nhất 3 ảnh để đăng ký khuôn mặt (khuyến nghị 3-5 ảnh)')
  }

  // Add all images to "images" parameter (backend expects List<MultipartFile>)
  imageFiles.forEach((file) => {
    newFormData.append('images', file)
  })

  // Don't include Authorization header for multipart/form-data (browser will set it)
  const url = `${API_CONFIG.BASE_URL}/ai/recognition/face/register?student_id=${userInfo.id}`

  const res = await fetch(url, {
    method: 'POST',
    // Don't set Content-Type header, browser will set it with boundary
    body: newFormData,
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    let error: any = {}
    try {
      error = JSON.parse(errorText)
    } catch {
      error = { message: errorText || `HTTP ${res.status}` }
    }
    throw new Error(error.error || error.message || error.responseCode || `HTTP ${res.status}`)
  }

  const data = await res.json().catch(() => ({}))
  // Handle backend response format
  if (data.responseCode === 'S0000') {
    return data.data || data
  }
  return data.data || data
}

export async function updateFace(bookingId: number, formData: FormData) {
  const userInfo = getUserInfo()
  if (!userInfo?.id) {
    throw new Error('Not authenticated')
  }

  const headers = getAuthHeaders()
  const res = await fetch(
    `${API_CONFIG.BASE_URL}/ai/recognition/faces/${userInfo.id}`,
    {
      method: 'PUT',
      headers,
      body: formData,
    }
  )

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || error.message || `HTTP ${res.status}`)
  }

  return res.json()
}

export async function deleteFace(bookingId: number) {
  const userInfo = getUserInfo()
  if (!userInfo?.id) {
    throw new Error('Not authenticated')
  }

  const headers = getAuthHeaders()
  const res = await fetch(
    `${API_CONFIG.BASE_URL}/ai/recognition/faces/${userInfo.id}`,
    {
      method: 'DELETE',
      headers,
    }
  )

  if (!res.ok) {
    if (res.status === 404) {
      return {
        success: true,
        message: 'Face data not found or already deleted',
      }
    }
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || error.message || `HTTP ${res.status}`)
  }

  return res.json()
}

// ========== QR Code Service ==========

export async function getBookingQr(bookingId: number) {
  const res = await fetch(`/api/system/bookings?bookingId=${bookingId}&action=qr`, {
    credentials: 'include',
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || error.message || `HTTP ${res.status}`)
  }

  return res.json()
}

// ========== Notifications Service ==========

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
  } catch {
    // ignore storage errors
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


