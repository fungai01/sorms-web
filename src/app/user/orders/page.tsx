"use client";

import { useMyServiceOrders } from "@/hooks/useApi";
import { useMemo } from "react";
import type { ServiceOrder } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TBody } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

function getStatusBadgeTone(status: string): "completed" | "cancelled" | "in-progress" | "pending" {
  if (status === "COMPLETED") return "completed";
  if (status === "CANCELLED") return "cancelled";
  if (status === "IN_PROGRESS") return "in-progress";
  return "pending";
}

function getStatusText(status: string) {
  const statusMap: Record<string, string> = {
    PENDING: "Chờ xử lý",
    CONFIRMED: "Đã xác nhận",
    IN_PROGRESS: "Đang xử lý",
    COMPLETED: "Đã hoàn thành",
    CANCELLED: "Đã hủy",
  };
  return statusMap[status] || status;
}

export default function InvoicePaymentPage() {
  const { data: ordersData, loading: ordersLoading } = useMyServiceOrders();

  const orders = useMemo(() => {
    if (!ordersData) return [];
    const orderList = Array.isArray(ordersData) ? ordersData : (ordersData as any).items || [];
    return orderList.sort((a: ServiceOrder, b: ServiceOrder) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [ordersData]);

  const handleDownload = (order: ServiceOrder) => {
    // TODO: Implement download invoice
    alert(`Tải hóa đơn ${order.code}`);
  };

  const handlePay = async (order: ServiceOrder) => {
    if (!confirm(`Bạn có chắc muốn thanh toán cho đơn hàng ${order.code} với số tiền ${order.total_amount.toLocaleString("vi-VN")} VNĐ?`)) {
      return;
    }

    try {
      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.createPayment({
        serviceOrderId: order.id,
        method: "BANK_TRANSFER", // Default method, có thể cho user chọn
        returnUrl: `${window.location.origin}/user/orders`,
        cancelUrl: `${window.location.origin}/user/orders`,
      });

      if (response.success) {
        const paymentData = response.data as any;
        if (paymentData?.paymentUrl) {
          // Redirect to payment gateway
          window.location.href = paymentData.paymentUrl;
        } else {
          alert("Thanh toán đã được khởi tạo thành công!");
          // Reload page to refresh orders
          window.location.reload();
        }
      } else {
        alert(response.error || "Khởi tạo thanh toán thất bại");
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert("Có lỗi xảy ra khi khởi tạo thanh toán");
    }
  };

  return (
    <div className="px-4 lg:px-6 py-6">
      <div className="mb-4">
        <p className="text-sm text-gray-500">Hóa đơn & Thanh toán</p>
        <h1 className="text-lg font-semibold text-gray-900">Invoice & Payment</h1>
      </div>
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Danh sách hóa đơn</h2>
            <p className="text-sm text-gray-500">
              Quản lý hóa đơn và thanh toán tiền phòng, dịch vụ.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          {ordersLoading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Đang tải dữ liệu...
            </div>
          ) : (
            <>
              <Table>
                <THead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Số tiền</th>
                    <th>Ngày tạo</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </THead>
                <TBody>
                  {orders.map((order: ServiceOrder) => (
                    <tr key={order.id}>
                      <td className="font-medium">{order.code}</td>
                      <td>{order.total_amount.toLocaleString("vi-VN")} VNĐ</td>
                      <td>{new Date(order.created_at).toLocaleDateString("vi-VN")}</td>
                      <td>
                        <Badge tone={getStatusBadgeTone(order.status)}>
                          {getStatusText(order.status)}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" onClick={() => handleDownload(order)}>
                            Download
                          </Button>
                          {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
                            <Button variant="primary" onClick={() => handlePay(order)}>
                              Pay Now
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </TBody>
              </Table>

              {orders.length === 0 && (
                <div className="py-10 text-center text-sm text-gray-500">
                  Chưa có hóa đơn nào.
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}


