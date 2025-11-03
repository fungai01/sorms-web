import clsx from "clsx";

type Tone = 
  | "default" | "success" | "warning" | "error" | "info" 
  | "pending" | "completed" | "cancelled" | "in-progress" | "muted"
  | "active" | "inactive" | "approved" | "rejected"
  | "available" | "occupied" | "maintenance" | "reserved"
  | "paid" | "unpaid" | "partial" | "refunded"
  | "confirmed" | "waiting" | "checked-in" | "checked-out"
  | "on-hold";

export default function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    // Trạng thái cơ bản
    default: "bg-gray-100 text-gray-700 border border-gray-200",
    success: "bg-green-100 text-green-800 border border-green-200",
    warning: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    error: "bg-red-100 text-red-800 border border-red-200",
    info: "bg-blue-100 text-blue-800 border border-blue-200",
    muted: "bg-gray-100 text-gray-500 border border-gray-200",
    
    // Trạng thái công việc
    pending: "bg-orange-100 text-orange-800 border border-orange-200",
    completed: "bg-green-100 text-green-800 border border-green-200",
    cancelled: "bg-red-100 text-red-800 border border-red-200",
    "in-progress": "bg-blue-100 text-blue-800 border border-blue-200",
    "on-hold": "bg-yellow-100 text-yellow-800 border border-yellow-200",
    
    // Trạng thái hệ thống
    active: "bg-green-100 text-green-800 border border-green-200",
    inactive: "bg-gray-100 text-gray-600 border border-gray-200",
    approved: "bg-green-100 text-green-800 border border-green-200",
    rejected: "bg-red-100 text-red-800 border border-red-200",
    
    // Trạng thái phòng
    available: "bg-green-100 text-green-800 border border-green-200",
    occupied: "bg-red-100 text-red-800 border border-red-200",
    maintenance: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    reserved: "bg-blue-100 text-blue-800 border border-blue-200",
    
    // Trạng thái thanh toán
    paid: "bg-green-100 text-green-800 border border-green-200",
    unpaid: "bg-red-100 text-red-800 border border-red-200",
    partial: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    refunded: "bg-gray-100 text-gray-600 border border-gray-200",
    
    // Trạng thái đặt phòng
    confirmed: "bg-green-100 text-green-800 border border-green-200",
    waiting: "bg-orange-100 text-orange-800 border border-orange-200",
    "checked-in": "bg-blue-100 text-blue-800 border border-blue-200",
    "checked-out": "bg-gray-100 text-gray-600 border border-gray-200",
  };
  return <span className={clsx("inline-block rounded-md px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}




