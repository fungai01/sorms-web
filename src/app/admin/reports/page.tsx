"use client";

import React, { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TBody } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useBookings, useRooms, useServiceOrders, useUsers, useStaffProfiles } from "@/hooks/useApi";
import type ExcelJS from "exceljs";

type UiBookingStatus = "ALL" | "PENDING" | "APPROVED" | "CHECKED_IN" | "CHECKED_OUT";

type RoomReportRow = {
  roomKey: string;
  roomName: string;
  status: "Phòng trống" | "Có người sử dụng" | "Bảo trì" | "Khác";
  bookingCount: number;
  services: any[];
  totalServiceCount: number;
  staff: string[];
  bookingDates: string[];
  totalGuests: number;
  paidAmount: number;
  dueAmount: number;
  revenue: number;
  notes: string[];
  bookings: any[];
};

function normalizeDate(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatCurrencyVnd(v: number) {
  return `${Math.max(0, Math.round(v)).toLocaleString("vi-VN")}₫`;
}

// Utility: Extract booking code
function getBookingCode(booking: any): string {
  return booking.code || (booking.id != null ? `#${booking.id}` : "—");
}

// Utility: Extract service order code
function getServiceOrderCode(so: any): string {
  return so.code || so.orderCode || so.id || "—";
}

// Utility: Extract service names from items
function getServiceNames(items: any[]): string {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items
    .map((it: any) => it.name || it.serviceName || it.service?.name || "")
    .filter(Boolean)
    .join(", ");
}

// Utility: Calculate service order financials
function calculateServiceOrderFinancials(so: any): {
  total: number;
  paid: number;
  due: number;
  isPaid: boolean;
} {
  const total = getNumberValue(so, "totalAmount", "total_amount", "totalPrice", "total_price");
  const paid = getNumberValue(so, "paidAmount", "paid_amount", "amountPaid", "amount_paid");
  const due = Math.max(0, total - paid);
  const isPaid = due === 0 && total > 0;
  return { total, paid, due, isPaid };
}

// Excel Styles Factory
async function createExcelStyles() {
  const ExcelJSImport = await import("exceljs");
  const ExcelJS = ExcelJSImport.default;

  const titleStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1F2937' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0F2FE' }
    }
  };

  const sectionTitleStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1F2937' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' }
    }
  };

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0EA5E9' }
    },
    border: {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    }
  };

  const dataStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', size: 11 },
    alignment: { vertical: 'middle' },
    border: {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    }
  };

  const totalRowStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', size: 12, bold: true, color: { argb: 'FF065F46' } },
    alignment: { horizontal: 'right', vertical: 'middle' },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0FDF4' }
    },
    border: {
      top: { style: 'medium', color: { argb: 'FF10B981' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'medium', color: { argb: 'FF10B981' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    }
  };

  return { titleStyle, sectionTitleStyle, headerStyle, dataStyle, totalRowStyle };
}

// Excel Helper: Add header row
function addExcelHeader(
  worksheet: ExcelJS.Worksheet,
  row: number,
  title: string,
  colSpan: number,
  style: Partial<ExcelJS.Style>
): number {
  const cell = worksheet.getCell(row, 1);
  cell.value = title;
  cell.style = style;
  worksheet.mergeCells(row, 1, row, colSpan);
  return row + 1;
}

// Excel Helper: Add total row
function addExcelTotalRow(
  worksheet: ExcelJS.Worksheet,
  row: number,
  totals: { amount: number; paid: number; due: number },
  labelColSpan: number,
  styles: Awaited<ReturnType<typeof createExcelStyles>>
): void {
  worksheet.mergeCells(row, 1, row, labelColSpan);
  const totalLabelCell = worksheet.getCell(row, 1);
  totalLabelCell.value = 'TỔNG CỘNG:';
  totalLabelCell.style = { ...styles.totalRowStyle, alignment: { horizontal: 'right', vertical: 'middle' } };

  const totalAmountCell = worksheet.getCell(row, labelColSpan + 1);
  totalAmountCell.value = totals.amount;
  totalAmountCell.numFmt = '#,##0"₫"';
  totalAmountCell.style = styles.totalRowStyle;

  const totalPaidCell = worksheet.getCell(row, labelColSpan + 2);
  totalPaidCell.value = totals.paid;
  totalPaidCell.numFmt = '#,##0"₫"';
  totalPaidCell.style = styles.totalRowStyle;

  const totalDueCell = worksheet.getCell(row, labelColSpan + 3);
  totalDueCell.value = totals.due;
  totalDueCell.numFmt = '#,##0"₫"';
  totalDueCell.style = { ...styles.totalRowStyle, font: { ...styles.totalRowStyle.font, color: { argb: 'FF000000' } } };
  if (totals.due > 0) {
    totalDueCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF1F2' }
    };
  }
}

// Excel Helper: Download file
async function downloadExcelFile(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Filter Utilities
function filterBookingsByDate(bookings: any[], dateFrom?: string, dateTo?: string): any[] {
  if (!dateFrom && !dateTo) return bookings;
  const from = dateFrom || "0000-00-00";
  const to = dateTo || "9999-12-31";
  return bookings.filter((b: any) => {
    const bookingDate = normalizeDate(b.createdDate || b.created_at || b.checkinDate);
    if (!bookingDate) return true;
    return bookingDate >= from && bookingDate <= to;
  });
}

function filterBookingsByStatus(bookings: any[], statusFilter: string): any[] {
  if (statusFilter === "ALL") return bookings;
  return bookings.filter((b: any) => {
    const s = bookingStatusToLabel(b.status);
    return (
      (statusFilter === "CHECKED_IN" && s === "Đã check-in") ||
      (statusFilter === "CHECKED_OUT" && s === "Check-out") ||
      (statusFilter === "PENDING" && s === "Chờ duyệt") ||
      (statusFilter === "OTHER" && s === "Khác")
    );
  });
}

function filterBookingsBySearch(bookings: any[], search: string): any[] {
  if (!search.trim()) return bookings;
  const searchLower = search.toLowerCase().trim();
  return bookings.filter((b: any) => {
    const code = (getBookingCode(b) || "").toLowerCase();
    const guestName = (
      b.guestName ??
      b.guest_name ??
      b.customerName ??
      b.customer_name ??
      b.guest?.name ??
      ""
    )
      .toString()
      .toLowerCase();
    const note = (
      (b.note ?? b.notes ?? b.specialRequest ?? b.special_request ?? "")?.toString() || ""
    ).toLowerCase();
    return (
      code.includes(searchLower) ||
      guestName.includes(searchLower) ||
      note.includes(searchLower)
    );
  });
}

// Helper: Escape CSV values để tránh lệch định dạng
function escapeCsvValue(value: string | number): string {
  const str = String(value || "");
  // Nếu có dấu phẩy, dấu ngoặc kép, hoặc xuống dòng, cần bọc trong dấu ngoặc kép
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    // Escape dấu ngoặc kép bằng cách nhân đôi
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Helper: Lấy tên nhân viên từ service order
function getStaffNameFromServiceOrder(
  so: any,
  userNameMap: Record<string | number, string>,
  staffAccountIdMap: Record<string | number, string>
): string {
  // Thử lấy tên trực tiếp từ các field
  const directName =
    so.staffName ??
    so.staff_name ??
    so.employeeName ??
    so.employee_name ??
    so.staff?.name ??
    so.staff?.fullName ??
    so.staff?.full_name ??
    so.createdBy?.name ??
    so.createdBy?.fullName ??
    so.createdBy?.full_name ??
    so.staffProfile?.jobTitle ??
    so.requestedBy?.name ??
    so.requestedBy?.fullName ??
    so.requestedBy?.full_name ??
    "";

  if (directName) return directName;

  // Lấy các ID có thể
  const staffId =
    so.staffId ??
    so.staff_id ??
    so.employeeId ??
    so.employee_id ??
    so.assignedTo ??
    so.assigned_to ??
    so.staff?.id ??
    so.staff?.userId ??
    so.createdById ??
    so.created_by_id ??
    so.createdBy?.id ??
    so.requestedBy?.id ??
    so.requested_by ??
    so.userId ??
    so.requestedBy;

  const staffAccountId =
    so.staffProfile?.accountId ??
    so.staffProfile?.account_id ??
    so.staff?.accountId ??
    so.staff?.account_id;

  // Map từ ID
  if (staffId != null) {
    if (userNameMap[String(staffId)]) {
      return userNameMap[String(staffId)];
    }
    return `ID: ${staffId}`;
  }

  if (staffAccountId != null) {
    if (userNameMap[String(staffAccountId)]) {
      return userNameMap[String(staffAccountId)];
    }
    if (staffAccountIdMap[String(staffAccountId)]) {
      return staffAccountIdMap[String(staffAccountId)];
    }
    return `ID: ${staffAccountId}`;
  }

  return "—";
}

// Helper: Lấy giá trị số từ object với nhiều field names
function getNumberValue(obj: any, ...fieldNames: string[]): number {
  for (const field of fieldNames) {
    const value = obj?.[field];
    if (value != null) {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
  }
  return 0;
}

// Helper: Lấy giá trị string từ object với nhiều field names
function getStringValue(obj: any, ...fieldNames: string[]): string {
  for (const field of fieldNames) {
    const value = obj?.[field];
    if (value != null) return String(value);
  }
  return "";
}

// Helper: Escape HTML để tránh lỗi định dạng và XSS
function escapeHtml(text: string | number): string {
  const str = String(text || "");
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

// Helper: Export booking details to Excel với định dạng đẹp
async function exportBookingToExcel(booking: any, serviceOrders: any[], userNameMap: Record<string | number, string>, staffAccountIdMap: Record<string | number, string> = {}) {
  const bookingCode = getBookingCode(booking);
  const checkin = normalizeDate(booking.checkinDate);
  const checkout = normalizeDate(booking.checkoutDate);
  const bookerName = booking.userId ? userNameMap[String(booking.userId)] || "" : "";
  
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Báo cáo Booking ${bookingCode}`);
  const styles = await createExcelStyles();
  
  let currentRow = 1;
  
  // Tiêu đề chính
  currentRow = addExcelHeader(worksheet, currentRow, `BÁO CÁO BOOKING ${bookingCode}`, 8, styles.titleStyle);
  currentRow += 1;
  
  // Thông tin Booking
  currentRow = addExcelHeader(worksheet, currentRow, 'Thông tin Booking', 2, styles.sectionTitleStyle);
  
  const infoLabels = ['Mã booking', 'Trạng thái', 'Ngày check-in', 'Ngày check-out', 'Số lượng khách', 'Người đặt', 'Ghi chú'];
  const infoValues = [
    bookingCode,
    bookingStatusToLabel(booking.status),
    checkin || "—",
    checkout || "—",
    getNumberValue(booking, "numGuests", "num_guests") || 1,
    bookerName,
    getStringValue(booking, "note", "notes", "specialRequest", "special_request") || "—"
  ];
  
  infoLabels.forEach((label, idx) => {
    const labelCell = worksheet.getCell(currentRow, 1);
    labelCell.value = label + ':';
    labelCell.style = { 
      ...styles.dataStyle, 
      font: { name: 'Arial', size: 11, bold: true },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFBEB' }
      }
    };
    
    const valueCell = worksheet.getCell(currentRow, 2);
    valueCell.value = infoValues[idx];
    if (typeof infoValues[idx] === 'number') {
      valueCell.numFmt = '0';
    }
    valueCell.style = { 
      ...styles.dataStyle, 
      font: { ...styles.dataStyle.font, color: { argb: 'FF000000' } },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFBEB' }
      }
    };
    currentRow++;
  });
  
  currentRow += 1;
  
  // Hóa đơn dịch vụ
  if (serviceOrders.length > 0) {
    currentRow = addExcelHeader(worksheet, currentRow, 'Hóa đơn dịch vụ', 8, styles.sectionTitleStyle);
    
    // Header
    const serviceHeaders = ['Mã hóa đơn', 'Ngày tạo', 'Dịch vụ', 'Nhân viên', 'Trạng thái', 'Tổng tiền', 'Đã thu', 'Còn thiếu'];
    serviceHeaders.forEach((header, col) => {
      const cell = worksheet.getCell(currentRow, col + 1);
      cell.value = header;
      cell.style = styles.headerStyle;
    });
    currentRow++;
    
    let totalInvoiceAmount = 0;
    let totalInvoicePaid = 0;
    let totalInvoiceDue = 0;
    
    serviceOrders.forEach((so: any) => {
      const soCode = getServiceOrderCode(so);
      const soCreated = normalizeDate(so.createdDate || so.created_at || so.createdAt);
      const financials = calculateServiceOrderFinancials(so);
      const items = so.items || so.serviceItems || so.lines || [];
      const serviceNames = getServiceNames(items);
      const staffName = getStaffNameFromServiceOrder(so, userNameMap, staffAccountIdMap);
      
      totalInvoiceAmount += financials.total;
      totalInvoicePaid += financials.paid;
      totalInvoiceDue += financials.due;
      
      const rowData = [
        soCode,
        soCreated || "—",
        serviceNames,
        staffName,
        financials.isPaid ? "Đã thanh toán" : financials.due > 0 ? "Chưa thanh toán" : "—",
        financials.total,
        financials.paid,
        financials.due
      ];
      
      rowData.forEach((value, col) => {
        const cell = worksheet.getCell(currentRow, col + 1);
        cell.value = value;
        cell.style = styles.dataStyle;
        
        if (col >= 0 && col <= 4) {
          cell.alignment = { ...cell.alignment, horizontal: 'center' };
        }
        
        if (col >= 5 && col <= 7) { 
          cell.numFmt = '#,##0"₫"';
          cell.alignment = { ...cell.alignment, horizontal: 'right' };
        }
      });
      currentRow++;
    });
    
    addExcelTotalRow(worksheet, currentRow, {
      amount: totalInvoiceAmount,
      paid: totalInvoicePaid,
      due: totalInvoiceDue
    }, 5, styles);
  }
  
  worksheet.columns.forEach((column, index) => {
    if (index === 0) column.width = 18; 
    else if (index === 1) column.width = 12; 
    else if (index === 2) column.width = 30; 
    else if (index === 3) column.width = 20; 
    else if (index === 4) column.width = 14; 
    else if (index >= 5 && index <= 9) column.width = 15; 
    else column.width = 15;
  });
  
  await downloadExcelFile(workbook, `booking-${bookingCode}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Helper: Export service order to PDF
async function exportServiceOrderToPDF(so: any, userNameMap: Record<string | number, string>, staffAccountIdMap: Record<string | number, string> = {}) {
  const soCode = getServiceOrderCode(so);
  const soCreated = normalizeDate(so.createdDate || so.created_at || so.createdAt);
  const financials = calculateServiceOrderFinancials(so);
  const items = so.items || so.serviceItems || so.lines || [];
  const serviceNames = getServiceNames(items);
  const staffName = getStaffNameFromServiceOrder(so, userNameMap, staffAccountIdMap);
  
  // Tạo HTML template cho PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Inter', 'Arial', 'Helvetica', 'DejaVu Sans', sans-serif;
          padding: 40px;
          background: #fff;
          color: #1f2937;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          width: 794px;
          max-width: 794px;
        }
        .header {
          border-bottom: 4px solid #0ea5e9;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #0ea5e9;
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .header .invoice-code {
          color: #6b7280;
          font-size: 16px;
        }
        .info-section {
          margin-bottom: 25px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-label {
          font-weight: 600;
          color: #4b5563;
          width: 180px;
        }
        .info-value {
          color: #111827;
          flex: 1;
          text-align: right;
        }
        .status-badge {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          ${financials.isPaid 
            ? 'background: #d1fae5; color: #065f46; border: 1px solid #10b981;' 
            : financials.due > 0 
              ? 'background: #fef3c7; color: #92400e; border: 1px solid #f59e0b;'
              : 'background: #f3f4f6; color: #374151; border: 1px solid #9ca3af;'
          }
        }
        .amount-highlight {
          font-size: 24px;
          font-weight: bold;
          color: #059669;
        }
        .table-section {
          margin-top: 30px;
        }
        .table-header {
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          color: white;
          padding: 15px;
          border-radius: 8px 8px 0 0;
          font-weight: 600;
          font-size: 16px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        thead {
          background: #f8fafc;
        }
        th {
          padding: 12px 15px;
          text-align: left;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
        }
        td {
          padding: 12px 15px;
          border-bottom: 1px solid #e5e7eb;
          color: #1f2937;
        }
        tbody tr:hover {
          background: #f9fafb;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
        .total-row {
          background: #f0fdf4;
          font-weight: 600;
          color: #065f46;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>HÓA ĐƠN DỊCH VỤ</h1>
        <div class="invoice-code">Mã hóa đơn: ${escapeHtml(soCode)}</div>
      </div>
      
      <div class="info-section">
        <div class="info-row">
          <span class="info-label">Ngày tạo:</span>
          <span class="info-value">${escapeHtml(soCreated || "—")}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Trạng thái:</span>
          <span class="info-value">
            <span class="status-badge">${escapeHtml(financials.isPaid ? "Đã thanh toán" : financials.due > 0 ? "Chưa thanh toán" : "—")}</span>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Nhân viên thực hiện:</span>
          <span class="info-value">${escapeHtml(staffName)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tổng tiền:</span>
          <span class="info-value amount-highlight">${escapeHtml(formatCurrencyVnd(financials.total))}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Đã thu:</span>
          <span class="info-value" style="color: #059669; font-weight: 600;">${escapeHtml(formatCurrencyVnd(financials.paid))}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Còn thiếu:</span>
          <span class="info-value" style="color: ${financials.due > 0 ? '#dc2626' : '#059669'}; font-weight: 600;">${escapeHtml(formatCurrencyVnd(financials.due))}</span>
        </div>
      </div>
      
      ${Array.isArray(items) && items.length > 0 ? `
      <div class="table-section">
        <div class="table-header">CHI TIẾT DỊCH VỤ</div>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Tên dịch vụ</th>
              <th class="text-center">Số lượng</th>
              <th class="text-right">Đơn giá</th>
              <th class="text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it: any, idx: number) => {
              const name = it.name || it.serviceName || it.service?.name || "—";
              const qty = Number(it.qty ?? it.quantity ?? 1) || 1;
              const price = getNumberValue(it, "unitPrice", "unit_price", "price", "unit_price", "unitPrice");
              // Tính thành tiền: ưu tiên lấy từ field total, nếu không có thì tính từ price * qty
              let total = getNumberValue(it, "totalAmount", "total_amount", "totalPrice", "total_price", "lineTotal", "line_total");
              if (total === 0 && price > 0) {
                total = price * qty;
              }
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${escapeHtml(name)}</td>
                  <td class="text-center">${escapeHtml(qty)}</td>
                  <td class="text-right">${escapeHtml(formatCurrencyVnd(price))}</td>
                  <td class="text-right">${escapeHtml(formatCurrencyVnd(total))}</td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td colspan="4" class="text-right" style="font-weight: bold;">TỔNG CỘNG:</td>
              <td class="text-right" style="font-size: 18px;">${escapeHtml(formatCurrencyVnd(financials.total))}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : `<div style="padding: 20px; background: #f9fafb; border-radius: 8px; text-align: center; color: #6b7280;">
        ${escapeHtml(serviceNames || "Không có chi tiết dịch vụ")}
      </div>`}
      
      <div class="footer">
        <p>Hóa đơn được tạo tự động từ hệ thống quản lý</p>
        <p>Ngày xuất: ${escapeHtml(new Date().toLocaleDateString('vi-VN'))}</p>
      </div>
    </body>
    </html>
  `;
  
  // Tạo iframe để render HTML độc lập
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.width = '794px';
  iframe.style.height = '1123px'; // A4 height in pixels at 96 DPI
  iframe.style.border = 'none';
  document.body.appendChild(iframe);
  
  try {
    // Viết HTML trực tiếp vào iframe
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error('Cannot access iframe document');
    }
    
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();
    
    // Đợi font và hình ảnh load xong
    await new Promise((resolve) => {
      if (iframeDoc.fonts && iframeDoc.fonts.ready) {
        iframeDoc.fonts.ready.then(() => setTimeout(resolve, 500));
      } else {
        setTimeout(resolve, 1000);
      }
    });
    
    // Đợi thêm một chút để đảm bảo render hoàn tất
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    const bodyElement = iframeDoc.body;
    if (!bodyElement) {
      throw new Error('Cannot find body element');
    }
    
    // Convert HTML to canvas then to PDF
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(bodyElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      width: 794,
      height: bodyElement.scrollHeight,
      windowWidth: 794,
      windowHeight: bodyElement.scrollHeight,
      backgroundColor: '#ffffff',
      allowTaint: false,
    });
    
    const imgData = canvas.toDataURL('image/png', 1.0);

    // Lazy-load jsPDF để giảm bundle size (tốt cho LCP)
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    pdf.save(`hoadon-${soCode}-${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Có lỗi xảy ra khi tạo PDF. Vui lòng thử lại.');
    throw error;
  } finally {
    document.body.removeChild(iframe);
  }
}

// Helper: Export room report to Excel với định dạng đẹp
async function exportRoomReportToExcel(room: RoomReportRow, userNameMap: Record<string | number, string>, staffAccountIdMap: Record<string | number, string> = {}) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Báo cáo phòng ${room.roomName}`);
  const styles = await createExcelStyles();
  
  let currentRow = 1;
  
  // Tiêu đề chính
  currentRow = addExcelHeader(worksheet, currentRow, `BÁO CÁO PHÒNG ${room.roomName}`, 9, styles.titleStyle);
  currentRow += 1;
  
  // Thông tin phòng
  currentRow = addExcelHeader(worksheet, currentRow, 'Thông tin phòng', 2, styles.sectionTitleStyle);
  
  const infoLabels = ['Tên phòng', 'Mã phòng', 'Trạng thái', 'Tổng lượt đặt', 'Tổng số khách', 'Doanh thu dịch vụ', 'Tổng số dịch vụ'];
  const infoValues = [
    room.roomName,
    room.roomKey,
    room.status,
    room.bookingCount,
    room.totalGuests,
    room.revenue,
    room.totalServiceCount
  ];
  
  infoLabels.forEach((label, idx) => {
    const labelCell = worksheet.getCell(currentRow, 1);
    labelCell.value = label + ':';
    labelCell.style = { 
      ...styles.dataStyle, 
      font: { name: 'Arial', size: 11, bold: true },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFBEB' }
      }
    };
    
    const valueCell = worksheet.getCell(currentRow, 2);
    if (idx === 5) { // Doanh thu dịch vụ (index 5)
      valueCell.value = room.revenue;
      valueCell.numFmt = '#,##0"₫"';
    } else {
      valueCell.value = infoValues[idx];
      if (typeof infoValues[idx] === 'number') {
        valueCell.numFmt = '0';
      }
    }
    valueCell.style = { 
      ...styles.dataStyle, 
      font: { ...styles.dataStyle.font, color: { argb: 'FF000000' } }, 
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFBEB' }
      }
    };
    currentRow++;
  });
  
  currentRow += 1;
  
  // Danh sách Booking
  if (room.bookings.length > 0) {
    currentRow = addExcelHeader(worksheet, currentRow, 'Danh sách Booking', 9, styles.sectionTitleStyle);
    
    // Header
    const bookingHeaders = ['Mã booking', 'Trạng thái', 'Check-in', 'Check-out', 'Số khách', 'Người đặt', 'Tổng tiền dịch vụ', 'Đã thu', 'Còn thiếu'];
    bookingHeaders.forEach((header, col) => {
      const cell = worksheet.getCell(currentRow, col + 1);
      cell.value = header;
      cell.style = styles.headerStyle;
    });
    currentRow++;
    
    let totalServiceAmount = 0;
    let totalServicePaid = 0;
    let totalServiceDue = 0;
    
    room.bookings.forEach((b: any) => {
      const bookingCode = getBookingCode(b);
      const checkin = normalizeDate(b.checkinDate);
      const checkout = normalizeDate(b.checkoutDate);
      const guests = getNumberValue(b, "numGuests", "num_guests") || 1;
      const bookerName = b.userId ? userNameMap[String(b.userId)] || "" : "";
      
      const serviceOrdersForBooking = room.services?.filter((so: any) => so.__booking === b) || [];
      const serviceTotal = serviceOrdersForBooking.reduce(
        (sum: number, so: any) => sum + calculateServiceOrderFinancials(so).total,
        0
      );
      const servicePaid = serviceOrdersForBooking.reduce(
        (sum: number, so: any) => sum + calculateServiceOrderFinancials(so).paid,
        0
      );
      const serviceDue = Math.max(0, serviceTotal - servicePaid);
      
      totalServiceAmount += serviceTotal;
      totalServicePaid += servicePaid;
      totalServiceDue += serviceDue;
      
      const rowData = [
        bookingCode,
        bookingStatusToLabel(b.status),
        checkin || "—",
        checkout || "—",
        guests,
        bookerName,
        serviceTotal,
        servicePaid,
        serviceDue
      ];
      
      rowData.forEach((value, col) => {
        const cell = worksheet.getCell(currentRow, col + 1);
        cell.value = value;
        cell.style = styles.dataStyle;
        
        if (col >= 0 && col <= 5) {
          cell.alignment = { ...cell.alignment, horizontal: 'center' };
        }
        
        if (col >= 6 && col <= 8) { 
          cell.numFmt = '#,##0"₫"';
          cell.alignment = { ...cell.alignment, horizontal: 'right' };
        } 
      });
      currentRow++;
    });
    
    addExcelTotalRow(worksheet, currentRow, {
      amount: totalServiceAmount,
      paid: totalServicePaid,
      due: totalServiceDue
    }, 6, styles);
    
    currentRow += 2;
  }
  
  // Chi tiết Hóa đơn Dịch vụ
  if (room.services && room.services.length > 0) {
    currentRow = addExcelHeader(worksheet, currentRow, 'Chi tiết Hóa đơn Dịch vụ', 9, styles.sectionTitleStyle);
    
    // Header
    const serviceHeaders = ['Mã hóa đơn', 'Mã booking', 'Ngày tạo', 'Dịch vụ', 'Nhân viên', 'Trạng thái', 'Tổng tiền', 'Đã thu', 'Còn thiếu'];
    serviceHeaders.forEach((header, col) => {
      const cell = worksheet.getCell(currentRow, col + 1);
      cell.value = header;
      cell.style = styles.headerStyle;
    });
    currentRow++;
    
    let totalInvoiceAmount = 0;
    let totalInvoicePaid = 0;
    let totalInvoiceDue = 0;
    
    room.services.forEach((so: any) => {
      const b = so.__booking || {};
      const bookingCode = getBookingCode(b);
      const soCode = getServiceOrderCode(so);
      const soCreated = normalizeDate(so.createdDate || so.created_at || so.createdAt);
      const financials = calculateServiceOrderFinancials(so);
      const items = so.items || so.serviceItems || so.lines || [];
      const serviceNames = getServiceNames(items);
      const staffName = getStaffNameFromServiceOrder(so, userNameMap, staffAccountIdMap);
      
      totalInvoiceAmount += financials.total;
      totalInvoicePaid += financials.paid;
      totalInvoiceDue += financials.due;
      
      const rowData = [
        soCode,
        bookingCode,
        soCreated || "—",
        serviceNames,
        staffName,
        financials.isPaid ? "Đã thanh toán" : financials.due > 0 ? "Chưa thanh toán" : "—",
        financials.total,
        financials.paid,
        financials.due
      ];
      
      rowData.forEach((value, col) => {
        const cell = worksheet.getCell(currentRow, col + 1);
        cell.value = value;
        cell.style = styles.dataStyle;
        
        if (col >= 0 && col <= 5) {
          cell.alignment = { ...cell.alignment, horizontal: 'center' };
        }
        
        if (col >= 6 && col <= 8) { 
          cell.numFmt = '#,##0"₫"';
          cell.alignment = { ...cell.alignment, horizontal: 'right' };
        }
      });
      currentRow++;
    });
    
    addExcelTotalRow(worksheet, currentRow, {
      amount: totalInvoiceAmount,
      paid: totalInvoicePaid,
      due: totalInvoiceDue
    }, 6, styles);
  }
  
  // Điều chỉnh độ rộng cột
  worksheet.columns.forEach((column, index) => {
    if (index >= 0 && index <= 10) column.width = 20;
    else column.width = 20;
  });
  
  await downloadExcelFile(workbook, `baocao-phong-${room.roomName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Map trạng thái phòng (room.status) -> label hiển thị
function roomStatusToLabel(status?: string): RoomReportRow["status"] {
  const s = (status || "").toUpperCase();
  if (s === "AVAILABLE") return "Phòng trống";
  if (s === "OCCUPIED") return "Có người sử dụng";
  if (s === "MAINTENANCE" || s === "OUT_OF_ORDER") return "Bảo trì";
  return "Khác";
}

// Map trạng thái booking -> label hiển thị (dùng trong chi tiết từng booking)
function bookingStatusToLabel(status?: string): "Đã check-in" | "Check-out" | "Chờ duyệt" | "Khác" {
  const s = (status || "").toUpperCase();
  if (s === "CHECKED_IN") return "Đã check-in";
  if (s === "CHECKED_OUT") return "Check-out";
  if (s === "PENDING") return "Chờ duyệt";
  return "Khác";
}

function Pill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
    return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function IconBack() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function DetailTabs({
  value,
  onChange,
  tabs,
}: {
  value: string;
  onChange: (v: string) => void;
  tabs: { key: string; label: string }[];
}) {
            return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-200 px-6">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`h-10 px-4 rounded-t-xl text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
            value === t.key
              ? "text-sky-700 border-sky-600 bg-sky-50"
              : "text-gray-600 border-transparent hover:text-gray-800 hover:bg-gray-50"
          }`}
        >
          {t.label}
        </button>
      ))}
      </div>
  );
}

function AccordionSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
    return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
      >
        <div className="font-bold text-gray-900">{title}</div>
        <span className="text-gray-500 text-sm">{open ? "Ẩn" : "Xem"}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
        </div>
  );
}

export default function ReportsPage() {
  // Filters
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [bookingStatus, setBookingStatus] = useState<UiBookingStatus>("ALL");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("ALL");
  const [roomSearch, setRoomSearch] = useState<string>("");

  // Level-2 screen
  const [selectedRoom, setSelectedRoom] = useState<RoomReportRow | null>(null);
  const [detailTab, setDetailTab] = useState<"bookings" | "services" | "staff">("bookings");
  const [accordionOpen, setAccordionOpen] = useState<Record<string, boolean>>({
    bookings: true,
    services: false,
    staff: false,
  });
  const [detailSearch, setDetailSearch] = useState<string>("");
  const [detailBookingStatus, setDetailBookingStatus] = useState<string>("ALL");
  const [detailDateFrom, setDetailDateFrom] = useState<string>("");
  const [detailDateTo, setDetailDateTo] = useState<string>("");

  // Data sources với loading states
  const { data: roomList, loading: roomsLoading } = useRooms();
  const rooms = (roomList as any[]) || [];

  const { data: bookingList, loading: bookingsLoading } = useBookings(bookingStatus === "ALL" ? undefined : bookingStatus);
  const bookings = (bookingList as any[]) || [];

  const { data: serviceOrdersData, loading: serviceOrdersLoading } = useServiceOrders();
  const serviceOrders = (serviceOrdersData as any[]) || [];
  
  // NOTE: Currently not wired to API; kept as placeholders
  const tasks: any[] = [];

  // Lazy load users - chỉ fetch sau khi data chính đã load
  const shouldLoadUsers = !roomsLoading && !bookingsLoading && !serviceOrdersLoading;
  const { data: usersData, loading: usersLoading } = useUsers(shouldLoadUsers ? { size: 1000 } : undefined);
  const users = useMemo(() => {
    if (!usersData) return [];
    // Handle different response structures
    const items = (usersData as any)?.items || (usersData as any)?.data?.content || (usersData as any)?.content || (Array.isArray(usersData) ? usersData : []);
    return items;
  }, [usersData]);

  // Lazy load staff profiles - chỉ fetch sau khi users đã load
  const shouldLoadStaff = shouldLoadUsers && !usersLoading;
  const { data: staffProfilesData, loading: staffProfilesLoading } = useStaffProfiles(shouldLoadStaff ? "/api/system/staff-profiles" : null as any);
  const staffProfiles = (staffProfilesData as any[]) || [];

  // Combined loading state
  const isLoading = roomsLoading || bookingsLoading || serviceOrdersLoading || (shouldLoadUsers && usersLoading) || (shouldLoadStaff && staffProfilesLoading);

  // Map userId -> userName (từ users)
  const userNameMap = useMemo(() => {
    const map: Record<string | number, string> = {};
    users.forEach((u: any) => {
      const id = u.id ?? u.userId;
      if (id != null) {
        const name = u.fullName || u.full_name || u.name || (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : null) || u.email || `User ${id}`;
        map[String(id)] = name;
      }
    });
    return map;
  }, [users]);

  // Map accountId từ staff profiles -> userName
  const staffAccountIdMap = useMemo(() => {
    const map: Record<string | number, string> = {};
    staffProfiles.forEach((sp: any) => {
      const accountId = sp.accountId ?? sp.account_id;
      if (accountId != null && userNameMap[String(accountId)]) {
        map[String(accountId)] = userNameMap[String(accountId)];
      }
    });
    return map;
  }, [staffProfiles, userNameMap]);

  const rows: RoomReportRow[] = useMemo(() => {
    // Early return nếu đang loading để tránh tính toán không cần thiết
    if (isLoading || !rooms || !bookings || !serviceOrders) {
      return [];
    }

    const from = dateFrom || "0000-00-00";
    const to = dateTo || "9999-12-31";

    const filteredBookings = bookings.filter((b: any) => {
      const d = normalizeDate(b.checkinDate || b.createdDate || b.created_at);
      if (d && (d < from || d > to)) return false;

      if (selectedRoomId !== "ALL") {
        const roomId = (b.roomId ?? b.room_id ?? b.room?.id ?? b.room?.code ?? "")?.toString();
        if (roomId !== selectedRoomId) return false;
      }

      return true;
    });

    const servicesByBookingId = new Map<number | string, any[]>();
    for (const s of serviceOrders) {
      const bookingId = s.bookingId ?? s.booking_id;
      if (bookingId == null) continue;
      const arr = servicesByBookingId.get(bookingId) || [];
      arr.push(s);
      servicesByBookingId.set(bookingId, arr);
    }

    const staffByRoomKey = new Map<string, Set<string>>();
    for (const t of tasks) {
      const staffName = t.staffName || t.assigneeName || t.assignee?.name || t.staff?.name;
      if (!staffName) continue;

      const roomKey = (t.roomId ?? t.room_id ?? t.relatedRoomId ?? t.related_room_id ?? "")?.toString() || "";
      const bookingId = (t.bookingId ?? t.booking_id ?? t.relatedBookingId ?? t.related_booking_id) as
        | number
        | string
        | undefined;

      const key = roomKey || (bookingId != null ? `booking:${bookingId}` : "");
      if (!key) continue;

      if (!staffByRoomKey.has(key)) staffByRoomKey.set(key, new Set());
      staffByRoomKey.get(key)!.add(staffName);
    }

    const byRoom = new Map<string, RoomReportRow>();
    
    // Khởi tạo tất cả phòng từ danh sách rooms, dùng trạng thái phòng
    for (const room of rooms) {
      const roomId = (room.id ?? room.code ?? "")?.toString();
      const roomName = room.name ?? room.code ?? `Phòng ${roomId}`;
      const roomKey = roomId || "—";
      
      if (selectedRoomId !== "ALL" && roomKey !== selectedRoomId) continue;

      if (!byRoom.has(roomKey)) {
        byRoom.set(roomKey, {
          roomKey,
          roomName,
          status: roomStatusToLabel(room.status), 
          bookingCount: 0,
          services: [],
          totalServiceCount: 0,
          staff: [],
          bookingDates: [],
          totalGuests: 0,
          paidAmount: 0,
          dueAmount: 0,
          revenue: 0,
          notes: [],
          bookings: [],
        });
      }
    }

    // Cập nhật thông tin từ bookings (không thay đổi trạng thái phòng)
    for (const b of filteredBookings) {
      const roomId = (b.roomId ?? b.room_id ?? b.room?.id ?? b.room?.code ?? "—")?.toString();
      const roomKey = roomId || "—";
      
      const roomFromList = rooms.find((r: any) => {
        const rId = (r.id ?? r.code ?? "")?.toString();
        return rId === roomKey;
      });
      
      const roomName = roomFromList 
        ? (roomFromList.name ?? roomFromList.code ?? `Phòng ${roomKey}`)
        : (b.room?.name ?? b.roomCode ?? b.room?.code ?? `Phòng ${roomKey}`);

      if (!byRoom.has(roomKey)) {
        byRoom.set(roomKey, {
          roomKey,
          roomName,
          status: roomStatusToLabel(roomFromList?.status),
          bookingCount: 0,
          services: [],
          totalServiceCount: 0,
          staff: [],
          bookingDates: [],
          totalGuests: 0,
          paidAmount: 0,
          dueAmount: 0,
          revenue: 0,
          notes: [],
          bookings: [],
        });
      }

      const row = byRoom.get(roomKey)!;

      row.bookings.push(b);
      row.bookingCount += 1;

      const bookingDate = normalizeDate(b.createdDate || b.created_at || b.checkinDate);
      if (bookingDate) row.bookingDates.push(bookingDate);

      row.totalGuests += getNumberValue(b, "numGuests", "num_guests") || 1;

      const paid = getNumberValue(b, "paidAmount", "paid_amount", "amountPaid");
      const total = getNumberValue(b, "totalAmount", "total_amount", "totalPrice", "total_price");
      row.paidAmount += paid;
      row.dueAmount += Math.max(0, total - paid);

      const note = getStringValue(b, "note", "notes", "specialRequest", "special_request");
      if (note) row.notes.push(note);

      const bookingId = b.id ?? b.bookingId ?? b.booking_id;
      const services = bookingId != null ? servicesByBookingId.get(bookingId) || [] : [];
      for (const s of services) {
        // Doanh thu dịch vụ: cộng tổng tiền của từng service order
        row.revenue += getNumberValue(s, "totalAmount", "total_amount", "totalPrice", "total_price");

        // Lưu chi tiết theo từng hoá đơn dịch vụ (không gộp)
        row.services.push({ ...s, __booking: b });

        // Tổng số lượng dịch vụ đã đặt
        const items = s.items || s.serviceItems || s.lines || [];
        if (Array.isArray(items) && items.length) {
          row.totalServiceCount += items.reduce((sum, it) => sum + (Number(it.qty ?? it.quantity ?? 1) || 0), 0);
        } else {
          row.totalServiceCount += Number(s.qty ?? s.quantity ?? 1) || 0;
        }
      }

      const staffSet =
        staffByRoomKey.get(roomKey) || (bookingId != null ? staffByRoomKey.get(`booking:${bookingId}`) : undefined);
      if (staffSet) {
        for (const name of staffSet) row.staff.push(name);
      }
    }

    const out = Array.from(byRoom.values()).map((r) => {
      const uniq = <T,>(arr: T[]) => Array.from(new Set(arr.filter(Boolean) as any)) as T[];

      return {
        ...r,
        bookingDates: uniq(r.bookingDates).sort(),
        staff: uniq(r.staff),
        notes: uniq(r.notes),
        // services giữ nguyên dạng danh sách hoá đơn dịch vụ (service orders), không gộp
        services: r.services,
      };
    });

    out.sort((a, b) => a.roomKey.localeCompare(b.roomKey));
    return out;
  }, [bookings, serviceOrders, tasks, dateFrom, dateTo, selectedRoomId, rooms]);

  const filteredRows = useMemo(() => {
    if (!roomSearch.trim()) return rows;
    const searchLower = roomSearch.toLowerCase().trim();
    return rows.filter(
      (r) =>
        r.roomName.toLowerCase().includes(searchLower) ||
        r.roomKey.toLowerCase().includes(searchLower),
    );
  }, [rows, roomSearch]);

  const totalBookings = useMemo(() => rows.reduce((sum, r) => sum + r.bookingCount, 0), [rows]);
  const totalPaid = useMemo(() => rows.reduce((sum, r) => sum + r.paidAmount, 0), [rows]);
  const totalDue = useMemo(() => rows.reduce((sum, r) => sum + r.dueAmount, 0), [rows]);
  const totalRevenue = useMemo(() => rows.reduce((sum, r) => sum + r.revenue, 0), [rows]);

  const selectedRoomLive = useMemo(() => {
    if (!selectedRoom) return null;
    return rows.find((r) => r.roomKey === selectedRoom.roomKey) || selectedRoom;
  }, [rows, selectedRoom]);

  const pillClassByStatus = (label: RoomReportRow["status"]) =>
    label === "Phòng trống"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : label === "Có người sử dụng"
        ? "bg-sky-50 text-sky-700 border-sky-200"
        : label === "Bảo trì"
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-slate-50 text-slate-700 border-slate-200";

  const DetailBookings = ({
    room,
    search,
    statusFilter,
    dateFrom,
    dateTo,
  }: {
    room: RoomReportRow;
    search: string;
    statusFilter: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const [expandedServiceInvoicesByBooking, setExpandedServiceInvoicesByBooking] = useState<Record<string, boolean>>({});
    const filteredBookings = useMemo(() => {
      let result = room.bookings;
      result = filterBookingsByDate(result, dateFrom, dateTo);
      result = filterBookingsByStatus(result, statusFilter);
      result = filterBookingsBySearch(result, search);
      return result;
    }, [room.bookings, search, statusFilter, dateFrom, dateTo]);

    return (
      <div className="space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 bg-white rounded-xl border border-gray-200">
            Không có dữ liệu đặt phòng.
          </div>
        ) : (
          filteredBookings.map((b: any) => {
            const bookingDate = normalizeDate(b.createdDate || b.created_at || b.checkinDate);
            const checkin = normalizeDate(b.checkinDate);
            const checkout = normalizeDate(b.checkoutDate);
            const guests = Number(b.numGuests ?? b.num_guests ?? 1);
            const note = (b.note ?? b.notes ?? b.specialRequest ?? b.special_request ?? "")?.toString();

            const bookingKey = (b.id ?? b.code ?? `${room.roomKey}-${bookingDate}-${checkin}`)?.toString();

              const guestName =
                b.guestName ??
                b.guest_name ??
                b.customerName ??
                b.customer_name ??
                b.guest?.name ??
                "";

              // Lấy các hoá đơn dịch vụ thuộc về booking này (đã được gắn __booking khi build rows)
              const serviceOrdersForBooking =
                room.services?.filter((so: any) => so.__booking === b) || [];

              // Tính toán tài chính dịch vụ
              const serviceTotal = serviceOrdersForBooking.reduce(
                (sum: number, so: any) => sum + calculateServiceOrderFinancials(so).total,
                0
              );
              const servicePaid = serviceOrdersForBooking.reduce(
                (sum: number, so: any) => sum + calculateServiceOrderFinancials(so).paid,
                0
              );
              const serviceDue = Math.max(0, serviceTotal - servicePaid);
    
              return (
                <div
                  id={bookingKey ? `booking-${bookingKey}` : undefined}
                  key={bookingKey}
                  className="relative bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden"
                >
                  {/* Header Booking */}
                  <div className="bg-gradient-to-r from-sky-50 to-white px-6 py-4 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-4">
                      {/* Thông tin booking - Bên trái */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-xl font-bold text-gray-900">
                            {getBookingCode(b)}
                          </div>
                          <Pill
                            className={
                              bookingStatusToLabel(b.status) === "Đã check-in"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : bookingStatusToLabel(b.status) === "Check-out"
                                  ? "bg-gray-100 text-gray-700 border-gray-200"
                                  : bookingStatusToLabel(b.status) === "Chờ duyệt"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-slate-50 text-slate-700 border-slate-200"
                            }
                          >
                            {bookingStatusToLabel(b.status)}
                          </Pill>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-600">
                          {b.userId && userNameMap[String(b.userId)] && (
                            <div>
                              <span className="font-medium text-gray-700">Người đặt:</span>{" "}
                              <span className="text-gray-900">{userNameMap[String(b.userId)]}</span>
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-gray-700">Số lượng khách:</span>{" "}
                            <span className="text-gray-900">{guests}</span>
                          </div>
                          {guestName && (
                            <div>
                              <span className="font-medium text-gray-700">Khách:</span>{" "}
                              <span className="text-gray-900">{String(guestName)}</span>
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-gray-700">Ngày check-in:</span>{" "}
                            <span className="text-gray-900">{checkin || "—"}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Ngày check-out:</span>{" "}
                            <span className="text-gray-900">{checkout || "—"}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Tóm tắt tài chính dịch vụ - Ở giữa */}
                      <div className="flex flex-col gap-2 min-w-[180px] bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                         Tổng tiền dịch vụ
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Tổng:</span>
                          <span className="text-sm font-bold text-gray-900">
                            {formatCurrencyVnd(serviceTotal)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Đã thu:</span>
                          <span className="text-sm font-bold text-emerald-700">
                            {formatCurrencyVnd(servicePaid)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                          <span className="text-sm font-medium text-gray-700">Còn thiếu:</span>
                          <span
                            className={`text-sm font-bold ${
                              serviceDue > 0 ? "text-rose-700" : "text-emerald-700"
                            }`}
                          >
                            {formatCurrencyVnd(serviceDue)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Nút tải xuống - Bên phải */}
                      <div className="flex-shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await exportBookingToExcel(b, serviceOrdersForBooking, userNameMap, staffAccountIdMap);
                            } catch (error) {
                              console.error('Error exporting Excel:', error);
                              alert('Có lỗi xảy ra khi tạo file Excel. Vui lòng thử lại.');
                            }
                          }}
                          className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
                          title="Tải thông tin booking"
                        >
                          <IconDownload />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Ghi chú */}
                  {note ? (
                    <div className="px-6 py-3 bg-amber-50/50 border-b border-gray-100">
                      <div className="text-sm text-gray-700">
                        <span className="font-semibold text-gray-900">Ghi chú:</span> {note}
                      </div>
                    </div>
                  ) : null}

                  {/* Chi tiết các hoá đơn dịch vụ của booking */}
                  {serviceOrdersForBooking.length > 0 ? (
                    <div className="px-6 py-4 bg-gray-50/30">
                      
                      <div className="space-y-3">
                        {(() => {
                          const bookingKey = (b.id ?? b.code ?? `${room.roomKey}-${bookingDate}-${checkin}`)?.toString();
                          const expanded = !!expandedServiceInvoicesByBooking[bookingKey];
                          const visibleCount = expanded
                            ? serviceOrdersForBooking.length
                            : Math.min(1, serviceOrdersForBooking.length);
                          const visibleOrders = serviceOrdersForBooking.slice(0, visibleCount);

                          return (
                            <>
                              {visibleOrders.map((so: any, soIdx: number) => {
                                const soCreated = normalizeDate(
                                  so.createdDate || so.created_at || so.createdAt,
                                );
                                const financials = calculateServiceOrderFinancials(so);
                                const items = so.items || so.serviceItems || so.lines || [];
                                const staffName = getStaffNameFromServiceOrder(so, userNameMap, staffAccountIdMap);
                                const serviceNamesArray = Array.isArray(items)
                                  ? Array.from(
                                      new Set(
                                        items
                                          .map((it: any) => {
                                            const n =
                                              it.name || it.serviceName || it.service?.name;
                                            return n ? String(n) : "";
                                          })
                                          .filter(Boolean),
                                      ),
                                    )
                                  : [];

                                return (
                                  <div
                                    key={so.id ?? so.code ?? `${b.id ?? b.code}-so-${soIdx}`}
                                    className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                                  >
                                    {/* Header hóa đơn */}
                                    <div className="px-5 py-4 bg-gradient-to-r from-slate-50 via-gray-50 to-white border-b border-gray-100">
                                      {/* Dòng 1: Thông tin || Trạng thái || Tải xuống */}
                                      <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center mb-3">
                                        <div className="text-lg font-bold text-gray-900 tracking-tight">
                                          {getServiceOrderCode(so)}
                                        </div>
                                        <div className="text-center">
                                        <div className="text-right">
  <Pill
    className={
      financials.isPaid
        ? "bg-emerald-50 text-emerald-700 border-emerald-200 px-2.5 py-1 text-xs font-semibold"
        : financials.due > 0
        ? "bg-amber-50 text-amber-800 border-amber-200 px-2.5 py-1 text-xs font-semibold"
        : "bg-gray-50 text-gray-700 border-gray-200 px-2.5 py-1 text-xs font-semibold"
    }
  >
    {financials.isPaid ? "Đã thanh toán" : financials.due > 0 ? "Chưa thanh toán" : "—"}
  </Pill>
</div>

                                        </div>
                                        <div className="flex justify-end flex-shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => exportServiceOrderToPDF(so, userNameMap, staffAccountIdMap)}
                                            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                                            title="Tải hóa đơn dịch vụ"
                                          >
                                            <IconDownload />
                                          </button>
                                        </div>
                                      </div>
                                      
                                      {/* Dòng 2: Ngày tạo || Số tiền (dưới trạng thái) */}
                                      <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center mb-3">
                                        {soCreated ? (
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ngày tạo:</span>
                                            <span className="text-sm font-medium text-gray-900">{soCreated}</span>
                                          </div>
                                        ) : (
                                          <div></div>
                                        )}
                                        <div className="text-right">
                                          <div className="text-2xl font-bold text-emerald-700 tracking-tight">
                                            {formatCurrencyVnd(financials.total)}
                                          </div>
                                        </div>
                                                    </div>
                                      
                                      {/* Dòng 3: Dịch vụ */}
                                      {serviceNamesArray.length > 0 && (
                                        <div className="mb-3">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[80px]">Dịch vụ:</span>
                                            <span className="text-sm font-medium text-gray-900">{serviceNamesArray.join(", ")}</span>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Dòng 4: Nhân viên */}
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[80px]">Nhân viên:</span>
                                          <span className="text-sm font-medium text-gray-900">{staffName}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

                              {serviceOrdersForBooking.length > 1 && (
                                <div className="mt-2 flex justify-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextExpanded = !expanded;
                                      setExpandedServiceInvoicesByBooking((prev) => ({
                                        ...prev,
                                        [bookingKey]: nextExpanded,
                                      }));
                                      if (!nextExpanded) {
                                        requestAnimationFrame(() => {
                                          document
                                            .getElementById(`booking-${bookingKey}`)
                                            ?.scrollIntoView({ behavior: "smooth", block: "start" });
                                        });
                                      }
                                    }}
                                    className="inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold text-sky-700 hover:underline"
                                  >
                                  {expanded
                                    ? "Thu gọn"
                                    : `Xem thêm (${serviceOrdersForBooking.length - visibleCount} hoá đơn)`}
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        ))}
      </div>
    );
  };

  const DetailServices = ({ room, search }: { room: RoomReportRow; search: string }) => {
    // room.services hiện là danh sách các hoá đơn dịch vụ (service orders) kèm booking (__booking)
    const filteredServiceOrders = useMemo(() => {
      let result = room.services || [];

      if (search.trim()) {
        const searchLower = search.toLowerCase().trim();
        result = result.filter((so: any) => {
          const b = so.__booking || {};
          const bookingCode = getBookingCode(b).toLowerCase();
          const items = so.items || so.serviceItems || so.lines || [];
          const itemText = getServiceNames(items).toLowerCase();
          const serviceOrderCode = getServiceOrderCode(so).toLowerCase();
          return (
            bookingCode.includes(searchLower) ||
            serviceOrderCode.includes(searchLower) ||
            itemText.includes(searchLower)
          );
        });
      }

      return result;
    }, [room.services, search]);
    
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredServiceOrders.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">Không có hoá đơn dịch vụ.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredServiceOrders.map((so: any, i: number) => {
              const b = so.__booking || {};
              const bookingLabel = getBookingCode(b);
              const created = normalizeDate(so.createdDate || so.created_at || so.createdAt);
              const financials = calculateServiceOrderFinancials(so);
              const items = so.items || so.serviceItems || so.lines || [];

              return (
                <div key={so.id ?? so.code ?? `${room.roomKey}-so-${i}`} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        Hoá đơn DV: {getServiceOrderCode(so)}
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        Booking: {bookingLabel} {created ? `• ${created}` : ""}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-emerald-700 flex-shrink-0">{formatCurrencyVnd(financials.total)}</div>
                  </div>

                  {Array.isArray(items) && items.length ? (
                    <div className="mt-3 space-y-2">
                      {items.map((it: any, idx: number) => {
                        const name = it.name || it.serviceName || it.service?.name || "—";
                        const qty = Number(it.qty ?? it.quantity ?? 1) || 1;
                        const price = getNumberValue(it, "unitPrice", "unit_price", "price", "unit_price", "unitPrice");
                        // Tính thành tiền: ưu tiên lấy từ field total, nếu không có thì tính từ price * qty
                        let lineTotal = getNumberValue(it, "totalAmount", "total_amount", "totalPrice", "total_price", "lineTotal", "line_total");
                        if (lineTotal === 0 && price > 0) {
                          lineTotal = price * qty;
                        }

                        return (
                          <div
                            key={`${so.id ?? i}-item-${idx}`}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 truncate">{String(name)}</div>
                            </div>
                            {lineTotal > 0 ? (
                              <div className="text-xs font-semibold text-gray-700 flex-shrink-0">
                                {formatCurrencyVnd(lineTotal)}
                              </div>
                            ) : (
                              <Pill className="bg-gray-50 text-gray-700 border-gray-200">x{qty}</Pill>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-gray-700">
                      {(so.serviceName || so.service?.name || so.name) ? (
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-gray-900">
                            {String(so.serviceName || so.service?.name || so.name)}
                          </div>
                          <Pill className="bg-gray-50 text-gray-700 border-gray-200">x{Number(so.qty ?? so.quantity ?? 1) || 0}</Pill>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">Không có chi tiết dịch vụ.</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const DetailStaff = ({ room, search }: { room: RoomReportRow; search: string }) => {
    const filteredStaff = useMemo(() => {
      if (!search.trim()) return room.staff;
      const searchLower = search.toLowerCase().trim();
      return room.staff.filter((name) => name.toLowerCase().includes(searchLower));
    }, [room.staff, search]);

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredStaff.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">Không có thông tin nhân viên.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredStaff.map((name) => (
              <div key={name} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="font-semibold text-gray-900">{name}</div>
                <Pill className="bg-violet-50 text-violet-700 border-violet-200">Phụ trách</Pill>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };


    return (
    <div className="px-6 pt-4 pb-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {selectedRoomLive ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
            <button
                type="button"
              onClick={() => {
                  setSelectedRoom(null);
                  setDetailTab("bookings");
                  setDetailDateFrom("");
                  setDetailDateTo("");
                }}
                className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <IconBack />
                Quay lại
            </button>

              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">{selectedRoomLive.roomName}</div>
              </div>
          </div>

            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-sky-50 to-white">
                <div className="flex items-start justify-between gap-4">
              <div>
                    <h1 className="text-2xl lg:text-3xl font-black text-gray-900">Phòng {selectedRoomLive.roomName}</h1>
              </div>
                  <div className="flex items-center gap-3">
                    <Pill className={`${pillClassByStatus(selectedRoomLive.status)} px-3 py-1.5 text-sm font-semibold`}>{selectedRoomLive.status}</Pill>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await exportRoomReportToExcel(selectedRoomLive, userNameMap, staffAccountIdMap);
                        } catch (error) {
                          console.error('Error exporting Excel:', error);
                          alert('Có lỗi xảy ra khi tạo file Excel. Vui lòng thử lại.');
                        }
                      }}
                      className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
                      title="Tải báo cáo phòng"
                    >
                      <IconDownload />
                    </button>
                  </div>
                </div>
              </div>

              {/* Desktop: filter + danh sách booking */}
              <div className="hidden md:block">
                <div className="p-6 space-y-4">
                  <div className="flex flex-nowrap items-end gap-3 overflow-x-auto">
                    <div className="flex-1 min-w-[360px]">
                      <span className="mb-1 block text-xs font-semibold text-gray-700">Tìm kiếm</span>
                      <input
                        type="text"
                        placeholder="Tìm theo mã booking, tên khách hoặc ghi chú..."
                        value={detailSearch}
                        onChange={(e) => setDetailSearch(e.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="w-[160px] flex-shrink-0">
                      <span className="mb-1 block text-xs font-semibold text-gray-700">Từ ngày</span>
                      <input
                        type="date"
                        value={detailDateFrom}
                        onChange={(e) => setDetailDateFrom(e.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="w-[160px] flex-shrink-0">
                      <span className="mb-1 block text-xs font-semibold text-gray-700">Đến ngày</span>
                      <input
                        type="date"
                        value={detailDateTo}
                        onChange={(e) => setDetailDateTo(e.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="w-[220px] flex-shrink-0">
                      <span className="mb-1 block text-xs font-semibold text-gray-700">Trạng thái</span>
                      <select
                        value={detailBookingStatus}
                        onChange={(e) => setDetailBookingStatus(e.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="ALL">Tất cả trạng thái</option>
                        <option value="CHECKED_IN">Đã check-in</option>
                        <option value="CHECKED_OUT">Check-out</option>
                        <option value="PENDING">Chờ duyệt</option>
                        <option value="OTHER">Khác</option>
                      </select>
                    </div>
            </div>

                  <DetailBookings
                    room={selectedRoomLive}
                    search={detailSearch}
                    statusFilter={detailBookingStatus}
                    dateFrom={detailDateFrom}
                    dateTo={detailDateTo}
                  />
            </div>
          </div>

              {/* Mobile: chỉ còn 1 accordion cho lịch sử đặt phòng */}
              <div className="md:hidden p-4 space-y-3">
                <div className="space-y-3 mb-4">
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-gray-700">
                        Lọc theo thời gian
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={detailDateFrom}
                          onChange={(e) => setDetailDateFrom(e.target.value)}
                          className="flex-1 h-9 rounded-lg border border-gray-300 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <span className="text-xs text-gray-600">đến</span>
                        <input
                          type="date"
                          value={detailDateTo}
                          onChange={(e) => setDetailDateTo(e.target.value)}
                          className="flex-1 h-9 rounded-lg border border-gray-300 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                    </div>

                  <input
                    type="text"
                    placeholder="Tìm theo mã booking, tên khách hoặc ghi chú..."
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                    <select
                      value={detailBookingStatus}
                      onChange={(e) => setDetailBookingStatus(e.target.value)}
                      className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="ALL">Tất cả trạng thái</option>
                      <option value="CHECKED_IN">Đã check-in</option>
                      <option value="CHECKED_OUT">Check-out</option>
                      <option value="PENDING">Chờ duyệt</option>
                      <option value="OTHER">Khác</option>
                    </select>
              </div>

                <AccordionSection
                  title="Lịch sử đặt phòng"
                  open={!!accordionOpen.bookings}
                  onToggle={() => setAccordionOpen((p) => ({ ...p, bookings: !p.bookings }))}
                >
                  <DetailBookings
                    room={selectedRoomLive}
                    search={detailSearch}
                    statusFilter={detailBookingStatus}
                    dateFrom={detailDateFrom}
                    dateTo={detailDateTo}
                  />
                </AccordionSection>
            </div>
              </div>
              </div>
                ) : (
          <>
            {/* Header Card + Filters */}
            <div
              className="shadow-sm border border-gray-200 rounded-2xl overflow-hidden"
              style={{ backgroundColor: "#dcebff" }}
            >
            <div className="px-6 py-4 border-b border-gray-200/50">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-3 min-h-[40px]">
                      <h1 className="text-3xl font-bold text-gray-900 leading-tight">
                        Report theo phòng
                      </h1>
                      {isLoading && (
                        <span
                          className="inline-block h-4 w-4 rounded-full border-2 border-gray-400/40 border-t-[hsl(var(--primary))] animate-spin"
                          aria-label="Đang tải dữ liệu"
                        />
                      )}
                    </div>
                  
              </div>
                  <span className="self-start md:self-auto text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                    {filteredRows.length} / {rows.length} phòng
                  </span>
            </div>
          </div>

              {/* Date & Room filters */}
              <div className="bg-white px-6 py-4 space-y-3">
                <div className="flex flex-col lg:flex-row gap-3">
                  <div className="flex flex-1 flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Từ ngày
                      </label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Đến ngày
                      </label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 items-end">
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const iso = today.toISOString().slice(0, 10);
                        setDateFrom(iso);
                        setDateTo(iso);
                      }}
                      className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const y = now.getFullYear();
                        const m = now.getMonth(); // 0-based
                        const from = new Date(y, m, 1);
                        const to = new Date(y, m + 1, 0);
                        const fromIso = from.toISOString().slice(0, 10);
                        const toIso = to.toISOString().slice(0, 10);
                        setDateFrom(fromIso);
                        setDateTo(toIso);
                      }}
                      className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Tháng này
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const y = now.getFullYear();
                        const from = new Date(y, 0, 1);
                        const to = new Date(y, 11, 31);
                        const fromIso = from.toISOString().slice(0, 10);
                        const toIso = to.toISOString().slice(0, 10);
                        setDateFrom(fromIso);
                        setDateTo(toIso);
                      }}
                      className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Năm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                      }}
                      className="h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      Xóa lọc ngày
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Tìm theo tên phòng
                  </label>
                <input
                  type="text"
                    placeholder="Gõ để tìm phòng..."
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                </div>
              </div>
            </div>

            {/* Room list Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Danh sách phòng</h2>
              </div>
              </CardHeader>
              <CardBody className="p-0">
                {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto" style={{ minHeight: 420 }}>
                    <Table>
                      <THead>
                        <tr>
                        <th className="px-4 py-3 text-center text-sm font-bold">Tên phòng</th>
                        <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái</th>
                        <th className="px-4 py-3 text-center text-sm font-bold">Lượt đặt</th>
                        <th className="px-4 py-3 text-center text-sm font-bold">Số khách</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Doanh thu</th>
                        <th className="px-4 py-3 text-center text-sm font-bold">Dịch vụ</th>
                        <th className="px-4 py-3 text-center text-sm font-bold">Thao tác</th>
                    </tr>
                      </THead>
                      <TBody>
                      {isLoading ? (
                        // Skeleton rows để giảm CLS
                        Array.from({ length: 8 }).map((_, idx) => (
                          <tr key={`sk-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-100'}>
                            <td className="px-4 py-3"><div className="h-4 w-40 mx-auto rounded bg-gray-200 animate-pulse" /></td>
                            <td className="px-4 py-3"><div className="h-6 w-28 mx-auto rounded-full bg-gray-200 animate-pulse" /></td>
                            <td className="px-4 py-3"><div className="h-4 w-10 mx-auto rounded bg-gray-200 animate-pulse" /></td>
                            <td className="px-4 py-3"><div className="h-4 w-10 mx-auto rounded bg-gray-200 animate-pulse" /></td>
                            <td className="px-4 py-3"><div className="h-4 w-24 mx-auto rounded bg-gray-200 animate-pulse" /></td>
                            <td className="px-4 py-3"><div className="h-4 w-10 mx-auto rounded bg-gray-200 animate-pulse" /></td>
                            <td className="px-4 py-3"><div className="h-8 w-24 mx-auto rounded bg-gray-200 animate-pulse" /></td>
                          </tr>
                        ))
                      ) : filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            {rows.length === 0
                              ? "Không có dữ liệu theo bộ lọc hiện tại."
                              : "Không tìm thấy phòng nào."}
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((r, index) => (
                          <tr
                            key={r.roomKey}
                            className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-gray-50`}
                          >
                            <td className="px-4 py-3 text-center">
                              <div className="font-semibold text-gray-900">{r.roomName}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Pill className={pillClassByStatus(r.status)}>{r.status}</Pill>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 font-semibold">{r.bookingCount}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{r.totalGuests}</td>
                            <td className="px-4 py-3 text-center text-emerald-700 font-semibold">{formatCurrencyVnd(r.revenue)}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{r.totalServiceCount}</td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                variant="secondary"
                                className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                                onClick={() => {
                                  setSelectedRoom(r);
                                  setDetailTab("bookings");
                                  setDetailSearch("");
                                  setDetailBookingStatus("ALL");
                                  setDetailDateFrom("");
                                  setDetailDateTo("");
                                }}
                              >
                                Xem chi tiết
                              </Button>
                              </td>
                        </tr>
                      ))
                    )}
                  </TBody>
                </Table>
              </div>

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-3 p-4">
                  {isLoading ? (
                    <div className="space-y-3" aria-label="Đang tải danh sách phòng">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={`msk-${idx}`} className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
                            <div className="h-6 w-20 rounded-full bg-gray-200 animate-pulse" />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="h-10 rounded-xl bg-gray-100 border border-gray-200 animate-pulse" />
                            <div className="h-10 rounded-xl bg-gray-100 border border-gray-200 animate-pulse" />
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="h-10 rounded-xl bg-gray-100 border border-gray-200 animate-pulse" />
                            <div className="h-10 rounded-xl bg-gray-100 border border-gray-200 animate-pulse" />
                          </div>
                          <div className="mt-3">
                            <div className="h-9 rounded bg-gray-200 animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredRows.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">
                      {rows.length === 0
                        ? "Không có dữ liệu theo bộ lọc hiện tại."
                        : "Không tìm thấy phòng nào."}
                      </div>
                ) : (
                    filteredRows.map((r) => (
                      <div
                        key={r.roomKey}
                        className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-gray-900 text-base">{r.roomName}</div>
                          </div>
                          <Pill className={pillClassByStatus(r.status)}>{r.status}</Pill>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                            <span className="text-gray-600">Lượt đặt:</span> <span className="font-bold text-gray-900">{r.bookingCount}</span>
                          </div>
                          <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                            <span className="text-gray-600">Số khách:</span> <span className="font-bold text-gray-900">{r.totalGuests}</span>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                            <span className="text-gray-600">Doanh thu:</span> <span className="font-bold text-emerald-700">{formatCurrencyVnd(r.revenue)}</span>
                          </div>
                          <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                            <span className="text-gray-600">Dịch vụ:</span> <span className="font-bold text-gray-900">{r.totalServiceCount}</span>
                          </div>
                        </div>
                        <div className="mt-3">
                          <Button
                            variant="secondary"
                            className="w-full h-9 text-sm bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                            onClick={() => {
                              setSelectedRoom(r);
                              setDetailTab("bookings");
                              setDetailSearch("");
                              setDetailBookingStatus("ALL");
                            }}
                          >
                            Xem chi tiết
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                    </div>
            </CardBody>
          </Card>
          </>
        )}
        </div>
      </div>
  );
}

