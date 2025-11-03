// Type definitions for SORMS application based on database schema
export type RoomStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "CLEANING" | "OUT_OF_SERVICE";
export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT';
export type TaskStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
export type ServiceOrderStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'WALLET';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type RelatedType = 'SERVICE_ORDER' | 'ROOM' | 'BOOKING';

export interface Role {
  id: number;
  code: string;
  name: string;
  description?: string;
}

export interface User {
  id: number;
  email: string;
  password_hash?: string;
  full_name: string;
  phone_number?: string;
  status: UserStatus;
  roles?: string[];
  created_at: string;
  updated_at: string;
}

export interface RoomType {
  id: number;
  code: string;
  name: string;
  description?: string;
  basePrice: number;
  maxOccupancy: number;
  isActive?: boolean;
  createdDate?: string;
  lastModifiedDate?: string;
}

export interface Room {
  id: number;
  code: string;
  name?: string;
  roomTypeId: number;
  floor?: number;
  status: RoomStatus;
  description?: string;
  isActive?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: number;
  code: string;
  userId: number;
  userName?: string;
  roomId: number;
  roomCode?: string;
  checkinDate: string;
  checkoutDate: string;
  numGuests: number;
  note?: string;
  status: BookingStatus;
  isActive?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: number;
  code: string;
  name: string;
  description?: string;
  unitPrice: number;
  unitName: string;
  isActive: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceOrder {
  id: number;
  code: string;
  booking_id: number;
  requested_by: number;
  status: ServiceOrderStatus;
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceOrderItem {
  id: number;
  service_order_id: number;
  service_id: number;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface PaymentTransaction {
  id: number;
  service_order_id: number;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  provider_txn_id?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StaffTask {
  id: number;
  related_type: RelatedType;
  related_id: number;
  title: string;
  description?: string;
  assigned_to?: number;
  created_by: number;
  priority: TaskPriority;
  status: TaskStatus;
  due_at?: string;
  created_at: string;
  updated_at: string;
}
