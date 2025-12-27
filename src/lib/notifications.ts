// Notification Management System
// Comprehensive notification handling with filtering, sorting, and real-time updates

export type NotificationType = 'info' | 'success' | 'warning' | 'error'
export type NotificationCategory = 'booking' | 'task' | 'system' | 'payment'| 'user'
export type UserRole = 'admin' | 'office' | 'staff'  | 'user'
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Notification {
  id: number
  title: string
  message: string
  time: string
  unread: boolean
  type?: NotificationType
  category?: NotificationCategory
  priority?: NotificationPriority
  visibleTo?: UserRole[]
  createdBy?: UserRole
  createdAt?: number // Timestamp for sorting
  actionUrl?: string // URL to navigate when clicked
  actionLabel?: string // Label for action button
  metadata?: Record<string, any> // Additional data
}

const NOTIFICATIONS_KEY = 'sorms_notifications'
const MAX_NOTIFICATIONS = 1000 // Maximum notifications to store

// Generate unique ID for notifications
function generateNotificationId(): number {
  return Date.now() + Math.floor(Math.random() * 1000)
}

// Get all notifications from localStorage (internal function)
function getAllNotificationsInternal(): Notification[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY)
    if (stored) {
      const notifications = JSON.parse(stored) as Notification[]
      // Ensure all notifications have createdAt
      return notifications.map(n => ({
        ...n,
        createdAt: n.createdAt || (n.time ? Date.parse(n.time) : Date.now())
      }))
    }
    return []
  } catch {
    return []
  }
}

// Save notifications to localStorage
function saveNotifications(notifications: Notification[]): void {
  if (typeof window === 'undefined') return
  
  try {
    // Keep only the most recent notifications
    const sorted = notifications.sort((a, b) => {
      const aTime = a.createdAt || Date.parse(a.time) || 0
      const bTime = b.createdAt || Date.parse(b.time) || 0
      return bTime - aTime
    })
    const limited = sorted.slice(0, MAX_NOTIFICATIONS)
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(limited))
    
    // Dispatch event for real-time updates
    window.dispatchEvent(new CustomEvent('notificationsUpdated', { 
      detail: { notifications: limited } 
    }))
  } catch (error) {
    console.error('Error saving notifications:', error)
  }
}

// Get all notifications (public API)
export function getNotifications(): Notification[] {
  return getAllNotificationsInternal()
}

// Format time relative to now
function formatRelativeTime(timestamp: number | string): string {
  const now = Date.now()
  const time = typeof timestamp === 'string' ? Date.parse(timestamp) : timestamp
  const diff = now - time
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 7) {
    return new Date(time).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } else if (days > 0) {
    return `${days} ngày trước`
  } else if (hours > 0) {
    return `${hours} giờ trước`
  } else if (minutes > 0) {
    return `${minutes} phút trước`
  } else {
    return 'Vừa xong'
  }
}

// Get notifications filtered by role
export function getNotificationsByRole(userRole: UserRole): Notification[] {
  const allNotifications = getAllNotificationsInternal()
  
  if (userRole === 'admin') {
    return allNotifications
  }
  
  return allNotifications.filter(notification => {
    if (!notification.visibleTo || notification.visibleTo.length === 0) {
      return true
    }
    return notification.visibleTo.includes(userRole)
  })
}

// Get unread notifications count
export function getUnreadCount(userRole?: UserRole): number {
  const notifications = userRole 
    ? getNotificationsByRole(userRole)
    : getAllNotificationsInternal()
  return notifications.filter(n => n.unread).length
}

// Get notifications by category
export function getNotificationsByCategory(
  category: NotificationCategory,
  userRole?: UserRole
): Notification[] {
  const notifications = userRole 
    ? getNotificationsByRole(userRole)
    : getAllNotificationsInternal()
  return notifications.filter(n => n.category === category)
}

// Get notifications by type
export function getNotificationsByType(
  type: NotificationType,
  userRole?: UserRole
): Notification[] {
  const notifications = userRole 
    ? getNotificationsByRole(userRole)
    : getAllNotificationsInternal()
  return notifications.filter(n => n.type === type)
}

// Get notifications by priority
export function getNotificationsByPriority(
  priority: NotificationPriority,
  userRole?: UserRole
): Notification[] {
  const notifications = userRole 
    ? getNotificationsByRole(userRole)
    : getAllNotificationsInternal()
  return notifications.filter(n => n.priority === priority)
}

// Search notifications
export function searchNotifications(
  query: string,
  userRole?: UserRole
): Notification[] {
  const notifications = userRole 
    ? getNotificationsByRole(userRole)
    : getAllNotificationsInternal()
  const q = query.toLowerCase().trim()
  
  if (!q) return notifications
  
  return notifications.filter(n => 
    n.title.toLowerCase().includes(q) ||
    n.message.toLowerCase().includes(q) ||
    n.category?.toLowerCase().includes(q) ||
    n.type?.toLowerCase().includes(q)
  )
}

// Add a new notification
export function addNotification(notification: Omit<Notification, 'id' | 'time' | 'unread' | 'createdAt'>): Notification {
  const notifications = getAllNotificationsInternal()
  const now = Date.now()
  
  const newNotification: Notification = {
    ...notification,
    id: generateNotificationId(),
    time: formatRelativeTime(now),
    unread: true,
    createdAt: now,
    priority: notification.priority || 'normal',
    type: notification.type || 'info'
  }
  
  notifications.unshift(newNotification)
  saveNotifications(notifications)
  
  return newNotification
}

// Mark notification as read
export function markAsRead(id: number): void {
  const notifications = getAllNotificationsInternal()
  const updated = notifications.map(n => 
    n.id === id ? { ...n, unread: false } : n
  )
  saveNotifications(updated)
}

// Mark all notifications as read
export function markAllAsRead(userRole?: UserRole): void {
  const allNotifications = getAllNotificationsInternal()
  
  const updated = allNotifications.map(n => {
    const shouldMark = userRole 
      ? (!n.visibleTo || n.visibleTo.length === 0 || n.visibleTo.includes(userRole))
      : true
    return shouldMark ? { ...n, unread: false } : n
  })
  
  saveNotifications(updated)
}

// Delete notification
export function deleteNotification(id: number): void {
  const notifications = getAllNotificationsInternal()
  const updated = notifications.filter(n => n.id !== id)
  saveNotifications(updated)
}

// Delete all notifications
export function deleteAllNotifications(userRole?: UserRole): void {
  if (userRole) {
    const notifications = getAllNotificationsInternal()
    const updated = notifications.filter(n => 
      !n.visibleTo || n.visibleTo.length === 0 || !n.visibleTo.includes(userRole)
    )
    saveNotifications(updated)
  } else {
    localStorage.removeItem(NOTIFICATIONS_KEY)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notificationsUpdated', { 
        detail: { notifications: [] } 
      }))
    }
  }
}

// Delete read notifications
export function deleteReadNotifications(userRole?: UserRole): void {
  const notifications = userRole 
    ? getNotificationsByRole(userRole)
    : getAllNotificationsInternal()
  const allNotifications = getAllNotificationsInternal()
  
  const readIds = new Set(notifications.filter(n => !n.unread).map(n => n.id))
  const updated = allNotifications.filter(n => !readIds.has(n.id))
  
  saveNotifications(updated)
}

// Create booking notification
export function createBookingNotification(
  bookingId: number,
  guestName: string,
  roomInfo: string,
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT',
  rejectionReason?: string
): Notification {
  let title = ''
  let message = ''
  let type: NotificationType = 'info'
  let visibleTo: UserRole[] = []
  let priority: NotificationPriority = 'normal'
  
  switch (status) {
    case 'PENDING':
      title = 'Yêu cầu đặt phòng mới'
      message = `Có yêu cầu đặt phòng mới từ ${guestName} cho phòng${roomInfo}. Vui lòng xem xét và xác nhận.`
      type = 'info'
      visibleTo = ['admin', 'office']
      priority = 'high'
      break
    case 'CONFIRMED':
      title = 'Đặt phòng đã được xác nhận'
      message = `Yêu cầu đặt phòng của bạn cho phòng${roomInfo} đã được hành chính xác nhận thành công.`
      type = 'success'
      visibleTo = ['admin', 'office', 'user']
      priority = 'normal'
      break
    case 'REJECTED':
      title = 'Đặt phòng bị từ chối'
      message = `Yêu cầu đặt phòng của bạn cho phòng${roomInfo} đã bị từ chối. Lý do: ${rejectionReason || 'Không có lý do cụ thể'}.`
      type = 'warning'
      visibleTo = ['admin', 'office', 'user']
      priority = 'normal'
      break
    case 'CANCELLED':
      title = 'Đặt phòng đã bị hủy'
      message = `Đặt phòng ${roomInfo} đã được hủy bởi ${guestName}.`
      type = 'warning'
      visibleTo = ['admin', 'office', 'user']
      priority = 'normal'
      break
    case 'CHECKED_IN':
      title = 'Đã check-in'
      message = `${guestName} đã check-in vào phòng ${roomInfo}.`
      type = 'success'
      visibleTo = ['admin', 'office', 'staff']
      priority = 'normal'
      break
    case 'CHECKED_OUT':
      title = 'Đã check-out'
      message = `${guestName} đã check-out khỏi phòng ${roomInfo}.`
      type = 'success'
      visibleTo = ['admin', 'office', 'staff']
      priority = 'normal'
      break
  }
  
  return addNotification({
    title,
    message,
    type,
    category: 'booking',
    visibleTo,
    priority,
    createdBy: status === 'PENDING' ? 'user' : 'office',
    actionUrl: `/admin/bookings`,
    actionLabel: 'Xem chi tiết',
    metadata: { bookingId, guestName, roomInfo, status }
  })
}

// Create task notification
export function createTaskNotification(
  taskId: number,
  taskTitle: string,
  assignedTo: string,
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED',
  priority?: NotificationPriority
): Notification {
  let title = ''
  let message = ''
  let type: NotificationType = 'info'
  let visibleTo: UserRole[] = ['admin', 'office', 'staff']
  
  switch (status) {
    case 'OPEN':
      title = 'Nhiệm vụ mới'
      message = `Nhiệm vụ "${taskTitle}" đã được tạo và cần được xử lý.`
      type = 'info'
      break
    case 'ASSIGNED':
      title = 'Nhiệm vụ được giao'
      message = `Bạn đã được giao nhiệm vụ "${taskTitle}".`
      type = 'info'
      visibleTo = ['staff']
      break
    case 'IN_PROGRESS':
      title = 'Nhiệm vụ đang thực hiện'
      message = `Nhiệm vụ "${taskTitle}" đang được thực hiện bởi ${assignedTo}.`
      type = 'info'
      break
    case 'DONE':
      title = 'Nhiệm vụ hoàn thành'
      message = `Nhiệm vụ "${taskTitle}" đã được hoàn thành bởi ${assignedTo}.`
      type = 'success'
      break
    case 'CANCELLED':
      title = 'Nhiệm vụ bị hủy'
      message = `Nhiệm vụ "${taskTitle}" đã bị hủy.`
      type = 'warning'
      break
  }
  
  return addNotification({
    title,
    message,
    type,
    category: 'task',
    visibleTo,
    priority: priority || 'normal',
    createdBy: 'admin',
    actionUrl: `/admin/tasks`,
    actionLabel: 'Xem chi tiết',
    metadata: { taskId, taskTitle, assignedTo, status }
  })
}

// Create payment notification
export function createPaymentNotification(
  paymentId: number,
  amount: number,
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED',
  method: string
): Notification {
  let title = ''
  let message = ''
  let type: NotificationType = 'info'
  const formattedAmount = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount)
  
  switch (status) {
    case 'PENDING':
      title = 'Thanh toán đang chờ xử lý'
      message = `Thanh toán ${formattedAmount} bằng ${method} đang chờ xử lý.`
      type = 'info'
      break
    case 'SUCCEEDED':
      title = 'Thanh toán thành công'
      message = `Thanh toán ${formattedAmount} bằng ${method} đã thành công.`
      type = 'success'
      break
    case 'FAILED':
      title = 'Thanh toán thất bại'
      message = `Thanh toán ${formattedAmount} bằng ${method} đã thất bại. Vui lòng thử lại.`
      type = 'error'
      break
    case 'REFUNDED':
      title = 'Hoàn tiền'
      message = `Đã hoàn tiền ${formattedAmount} cho thanh toán bằng ${method}.`
      type = 'warning'
      break
  }
  
  return addNotification({
    title,
    message,
    type,
    category: 'payment',
    visibleTo: ['admin', 'office', 'user'],
    priority: status === 'FAILED' ? 'high' : 'normal',
    createdBy: 'admin',
    actionUrl: `/admin/payments`,
    actionLabel: 'Xem chi tiết',
    metadata: { paymentId, amount, status, method }
  })
}

// Create system notification
export function createSystemNotification(
  title: string,
  message: string,
  type: NotificationType = 'info',
  visibleTo: UserRole[] = ['admin'],
  priority: NotificationPriority = 'normal'
): Notification {
  return addNotification({
    title,
    message,
    type,
    category: 'system',
    visibleTo,
    priority,
    createdBy: 'admin',
    metadata: {}
  })
}

// Sort notifications
export function sortNotifications(
  notifications: Notification[],
  sortBy: 'time' | 'priority' | 'type' | 'category' = 'time',
  order: 'asc' | 'desc' = 'desc'
): Notification[] {
  const sorted = [...notifications]
  const direction = order === 'asc' ? 1 : -1
  
  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'time':
        const aTime = a.createdAt || Date.parse(a.time) || 0
        const bTime = b.createdAt || Date.parse(b.time) || 0
        return (bTime - aTime) * direction
      case 'priority':
        const priorityOrder: Record<NotificationPriority, number> = {
          urgent: 4,
          high: 3,
          normal: 2,
          low: 1
        }
        const aPriority = priorityOrder[a.priority || 'normal']
        const bPriority = priorityOrder[b.priority || 'normal']
        return (bPriority - aPriority) * direction
      case 'type':
        return (a.type || '').localeCompare(b.type || '') * direction
      case 'category':
        return (a.category || '').localeCompare(b.category || '') * direction
      default:
        return 0
    }
  })
  
  return sorted
}

// Filter notifications
export function filterNotifications(
  notifications: Notification[],
  filters: {
    unread?: boolean
    type?: NotificationType
    category?: NotificationCategory
    priority?: NotificationPriority
    search?: string
  }
): Notification[] {
  let filtered = [...notifications]
  
  if (filters.unread !== undefined) {
    filtered = filtered.filter(n => filters.unread ? n.unread : !n.unread)
  }
  
  if (filters.type) {
    filtered = filtered.filter(n => n.type === filters.type)
  }
  
  if (filters.category) {
    filtered = filtered.filter(n => n.category === filters.category)
  }
  
  if (filters.priority) {
    filtered = filtered.filter(n => n.priority === filters.priority)
  }
  
  if (filters.search) {
    const query = filters.search.toLowerCase()
    filtered = filtered.filter(n =>
      n.title.toLowerCase().includes(query) ||
      n.message.toLowerCase().includes(query)
    )
  }
  
  return filtered
}

// Export default functions for backward compatibility
export default {
  getNotificationsByRole,
  getNotifications,
  getUnreadCount,
  addNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  createBookingNotification,
  createTaskNotification,
  createPaymentNotification,
  createSystemNotification,
  sortNotifications,
  filterNotifications
}