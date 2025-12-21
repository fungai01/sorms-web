export function generateUniqueId(): number {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return parseInt(`${timestamp}${random.toString().padStart(3, '0')}`);
}

export function generateBookingCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BK-${timestamp}-${random}`;
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^[0-9]{10,11}$/;

export function isValidEmail(email: string): boolean {
  if (!email.trim()) return true; // Email là optional
  return EMAIL_REGEX.test(email);
}

export function isValidPhone(phone: string): boolean {
  if (!phone.trim()) return true; // Phone là optional
  const phoneRegex = /^(0|\+84)[1-9][0-9]{8,9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export function isValidFullName(name: string): boolean {
  return name.trim().length >= 2;
}

export function isValidCCCD(cccd: string): boolean {
  if (!cccd.trim()) return false;
  // CCCD/CMND phải là số và có độ dài 9 hoặc 12 chữ số
  const cleaned = cccd.replace(/\s/g, '');
  return /^\d{9}$|^\d{12}$/.test(cleaned);
}

export function isValidDateOfBirth(dob: string): boolean {
  if (!dob.trim()) return true; // DOB là optional
  const dobDate = new Date(dob);
  const today = new Date();
  const minDate = new Date();
  minDate.setFullYear(today.getFullYear() - 120); // Không quá 120 tuổi
  
  return dobDate <= today && dobDate >= minDate;
}

export interface PersonalInfoValidation {
  fullName: string;
  dateOfBirth: string;
  cccd: string;
  phone: string;
  email: string;
}

export function validatePersonalInfo(info: PersonalInfoValidation): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!info.fullName.trim()) {
    errors.push("Vui lòng nhập họ tên");
  } else if (info.fullName.trim().length < 2) {
    errors.push("Họ tên phải có ít nhất 2 ký tự");
  }

  if (!info.cccd.trim()) {
    errors.push("Vui lòng nhập số CCCD/CMND");
  } else if (!isValidCCCD(info.cccd)) {
    errors.push("Số CCCD/CMND không hợp lệ. Vui lòng nhập 9 hoặc 12 chữ số");
  }

  if (info.email.trim() && !isValidEmail(info.email)) {
    errors.push("Email không hợp lệ");
  }

  if (info.phone.trim() && !isValidPhone(info.phone)) {
    errors.push("Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam (10-11 chữ số)");
  }

  if (info.dateOfBirth.trim() && !isValidDateOfBirth(info.dateOfBirth)) {
    errors.push("Ngày sinh không hợp lệ");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

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

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

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

export function calculateDaysBetween(startDate: string | Date, endDate: string | Date): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function parseRoomCode(code: string): { building: string; roomNumber: string } {
  const match = code.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    return {
      building: match[1],
      roomNumber: match[2],
    };
  }
  return {
    building: code.charAt(0),
    roomNumber: code.slice(1),
  };
}

export function getRoomTypeName(roomType: { name?: string } | null | undefined): string {
  return roomType?.name || 'Phòng tiêu chuẩn';
}

export function getRoomCapacity(roomType: { maxOccupancy?: number } | null | undefined): number {
  return roomType?.maxOccupancy || 1;
}

export function parseAmenitiesFromDescription(description?: string): string[] {
  if (!description) return [];

  const amenitiesMatch = description.match(/(?:Amenities|Tiện nghi):\s*([^\n.]+)/i);
  if (amenitiesMatch) {
    return amenitiesMatch[1]
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);
  }

  return [];
}

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

export function mapServiceStatus(
  backendStatus: 'AVAILABLE' | 'UNAVAILABLE'
): 'AVAILABLE' | 'COMPLETED' | 'CANCELLED' {
  const statusMap: Record<string, 'AVAILABLE' | 'COMPLETED' | 'CANCELLED'> = {
    'AVAILABLE': 'AVAILABLE',
    'UNAVAILABLE': 'CANCELLED',
  };
  return statusMap[backendStatus] || 'AVAILABLE';
}

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

export function sortByDateDesc<T extends { created_at?: string; createdDate?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.created_at || a.createdDate || 0).getTime();
    const dateB = new Date(b.created_at || b.createdDate || 0).getTime();
    return dateB - dateA;
  });
}

// Service filtering and sorting utilities
export interface ServiceFilter {
  id: number;
  code: string;
  name: string;
  unitPrice: number;
  unitName: string;
  description?: string;
  isActive: boolean;
}

export function filterServices<T extends ServiceFilter>(
  services: T[],
  query: string
): T[] {
  if (!query.trim()) return services;
  
  const q = query.trim().toLowerCase();
  return services.filter(service =>
    service.code.toLowerCase().includes(q) ||
    service.name.toLowerCase().includes(q) ||
    (service.description || '').toLowerCase().includes(q) ||
    service.unitName.toLowerCase().includes(q)
  );
}

export function sortServices<T extends ServiceFilter>(
  services: T[],
  sortKey: 'code' | 'name' | 'price',
  sortOrder: 'asc' | 'desc'
): T[] {
  const dir = sortOrder === 'asc' ? 1 : -1;
  return [...services].sort((a, b) => {
    if (sortKey === 'code') {
      return a.code.localeCompare(b.code) * dir;
    }
    if (sortKey === 'name') {
      return a.name.localeCompare(b.name) * dir;
    }
    if (sortKey === 'price') {
      return (a.unitPrice - b.unitPrice) * dir;
    }
    return 0;
  });
}

export function filterAndSortServices<T extends ServiceFilter>(
  services: T[],
  query: string,
  sortKey: 'code' | 'name' | 'price',
  sortOrder: 'asc' | 'desc'
): T[] {
  const filtered = filterServices(services, query);
  return sortServices(filtered, sortKey, sortOrder);
}

