/**
 * Shared utility functions to avoid code duplication
 */

// ============================================
// ID GENERATION UTILITIES
// ============================================

/**
 * Generate unique ID using timestamp + random number
 * Used for notifications, temporary IDs, etc.
 */
export function generateUniqueId(): number {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return parseInt(`${timestamp}${random.toString().padStart(3, '0')}`);
}

/**
 * Generate booking code
 * Format: BK-{timestamp}-{random}
 */
export function generateBookingCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BK-${timestamp}-${random}`;
}

// ============================================
// VALIDATION UTILITIES
// ============================================

/**
 * Email validation regex
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Phone number validation regex (10-11 digits)
 */
export const PHONE_REGEX = /^[0-9]{10,11}$/;

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Validate phone number format
 */
export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone);
}

/**
 * Validate full name (at least 3 characters)
 */
export function isValidFullName(name: string): boolean {
  return name.trim().length >= 3;
}

/**
 * Get validation errors for user form
 */
export function getUserFormErrors(data: {
  full_name: string;
  email: string;
  phone_number?: string;
}): string[] {
  const errors: string[] = [];
  
  if (!data.full_name.trim()) {
    errors.push('Họ tên bắt buộc.');
  } else if (!isValidFullName(data.full_name)) {
    errors.push('Họ tên phải có ít nhất 3 ký tự.');
  }
  
  if (!isValidEmail(data.email)) {
    errors.push('Email không hợp lệ.');
  }
  
  if (data.phone_number && !isValidPhone(data.phone_number)) {
    errors.push('Số điện thoại phải có 10-11 chữ số.');
  }
  
  return errors;
}

// ============================================
// DATA FORMATTING UTILITIES
// ============================================

/**
 * Format currency to VND
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

/**
 * Format date to Vietnamese format
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Format datetime to Vietnamese format
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Calculate days between two dates
 */
export function calculateDaysBetween(startDate: string | Date, endDate: string | Date): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// ============================================
// ROOM & BOOKING UTILITIES
// ============================================

/**
 * Parse room code to extract building and room number
 * Example: "A101" -> { building: "A", roomNumber: "101" }
 */
export function parseRoomCode(code: string): { building: string; roomNumber: string } {
  const match = code.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    return {
      building: match[1],
      roomNumber: match[2],
    };
  }
  // Fallback for non-standard codes
  return {
    building: code.charAt(0),
    roomNumber: code.slice(1),
  };
}

/**
 * Get room type name from room type object
 * Use real data from API instead of hardcoded mapping
 */
export function getRoomTypeName(roomType: { name?: string } | null | undefined): string {
  return roomType?.name || 'Phòng tiêu chuẩn';
}

/**
 * Get room capacity from room type object
 * Use real data from API instead of hardcoded mapping
 */
export function getRoomCapacity(roomType: { maxOccupancy?: number } | null | undefined): number {
  return roomType?.maxOccupancy || 1;
}

/**
 * Parse amenities from room type description
 * Backend doesn't have amenities field, so we parse from description
 * Format: "Description text. Amenities: WiFi, TV, AC"
 */
export function parseAmenitiesFromDescription(description?: string): string[] {
  if (!description) return [];

  // Try to find "Amenities:" or "Tiện nghi:" section
  const amenitiesMatch = description.match(/(?:Amenities|Tiện nghi):\s*([^\n.]+)/i);
  if (amenitiesMatch) {
    return amenitiesMatch[1]
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);
  }

  return [];
}

// ============================================
// STATUS MAPPING UTILITIES
// ============================================

/**
 * Map booking status from backend to frontend
 */
export function mapBookingStatus(
  backendStatus: 'PENDING' | 'APPROVED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'REJECTED'
): 'PENDING' | 'CONFIRMED' | 'REJECTED' {
  const statusMap: Record<string, 'PENDING' | 'CONFIRMED' | 'REJECTED'> = {
    'PENDING': 'PENDING',
    'APPROVED': 'CONFIRMED',
    'CHECKED_IN': 'CONFIRMED',
    'CHECKED_OUT': 'CONFIRMED',
    'CANCELLED': 'REJECTED',
    'REJECTED': 'REJECTED',
  };
  return statusMap[backendStatus] || 'PENDING';
}

/**
 * Map service status from backend to frontend
 */
export function mapServiceStatus(
  backendStatus: 'AVAILABLE' | 'UNAVAILABLE'
): 'AVAILABLE' | 'COMPLETED' | 'CANCELLED' {
  const statusMap: Record<string, 'AVAILABLE' | 'COMPLETED' | 'CANCELLED'> = {
    'AVAILABLE': 'AVAILABLE',
    'UNAVAILABLE': 'CANCELLED',
  };
  return statusMap[backendStatus] || 'AVAILABLE';
}

// ============================================
// ERROR HANDLING UTILITIES
// ============================================

/**
 * Backend error code mappings
 */
export const ERROR_MESSAGES: Record<string, string> = {
  'SYSTEM_ERROR': 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.',
  'S0001': 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.',
  'E0001': 'Dữ liệu không hợp lệ.',
  'E0002': 'Không tìm thấy dữ liệu.',
  'E0003': 'Không có quyền truy cập.',
  'E0004': 'Phiên đăng nhập đã hết hạn.',
  'E0005': 'Lỗi kết nối cơ sở dữ liệu.',
  'E0006': 'Dịch vụ tạm thời không khả dụng.',
  'E0007': 'Dữ liệu đã tồn tại.',
  'E0008': 'Dữ liệu không được phép xóa.',
  'E0009': 'Lỗi xác thực.',
  'E0010': 'Thao tác không được phép.',
  'U0002': 'Email đã tồn tại trong hệ thống.',
};

/**
 * Map error code to user-friendly message
 */
export function getErrorMessage(errorCode: string, fallbackMessage?: string): string {
  return ERROR_MESSAGES[errorCode] || fallbackMessage || 'Có lỗi xảy ra. Vui lòng thử lại.';
}

// ============================================
// ARRAY UTILITIES
// ============================================

/**
 * Remove duplicates from array by ID
 */
export function removeDuplicatesById<T extends { id: number | string }>(items: T[]): T[] {
  const seen = new Set<number | string>();
  return items.filter(item => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

/**
 * Sort array by date (newest first)
 */
export function sortByDateDesc<T extends { created_at?: string; createdDate?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.created_at || a.createdDate || 0).getTime();
    const dateB = new Date(b.created_at || b.createdDate || 0).getTime();
    return dateB - dateA;
  });
}

