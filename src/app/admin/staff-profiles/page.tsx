"use client";

import { useEffect, useMemo, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { StaffProfile } from "@/lib/types";
import { useStaffProfilesFiltered, useRoles } from "@/hooks/useApi";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

type RoleItem = { id?: number; code: string; name: string; description?: string; isActive?: boolean }

export default function StaffProfilesPage() {
  const [rows, setRows] = useState<StaffProfile[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const { data, refetch } = useStaffProfilesFiltered(
    statusFilter !== 'ALL' ? (statusFilter === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE') : undefined,
    departmentFilter !== 'ALL' ? departmentFilter : undefined
  );
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [flash, setFlash] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<StaffProfile | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<StaffProfile>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [openBasic, setOpenBasic] = useState(true);
  const [openJob, setOpenJob] = useState(true);
  const [openReview, setOpenReview] = useState(true);
  const [openSkills, setOpenSkills] = useState(true);
  // Multi-roles selection for user assignment
  const { data: rolesData } = useRoles({ page: 0, size: 100 });
  const roles: RoleItem[] = Array.isArray((rolesData as any)?.items) ? (rolesData as any).items : (Array.isArray(rolesData as any) ? rolesData as any : []);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const formatCurrency = (value?: number | null) =>
    typeof value === "number" && !Number.isNaN(value) ? `${value.toLocaleString("vi-VN")} VND` : "—";

  const formatNumberDisplay = (value?: number | null) =>
    typeof value === "number" && !Number.isNaN(value) ? value : "—";

  useEffect(() => {
    if (data && Array.isArray(data)) {
      setRows(data as StaffProfile[]);
    }
  }, [data]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.department) set.add(r.department);
    });
    return ["ALL", ...Array.from(set)];
  }, [rows]);

  const filtered = useMemo(() => {
    // Rely on backend-side filters (status, department). Only sort on client.
    return [...rows].sort((a, b) => a.employeeId.localeCompare(b.employeeId));
  }, [rows]);

  function openCreate() {
    setEdit({
      employeeId: "",
      department: "",
      position: "",
      jobTitle: "",
      employmentType: "",
      workSchedule: "",
      salary: 0,
      hourlyRate: 0,
      officeLocation: "",
      workPhone: "",
      workEmail: "",
      hireDate: new Date().toISOString().slice(0, 10),
      isActive: true,
    } as Partial<StaffProfile>);
    setEditOpen(true);
  }

  function openEdit(row: StaffProfile) {
    setEdit({ ...row });
    setEditOpen(true);
  }

  function isValidEdit() {
    if (!edit.employeeId || !edit.employeeId.trim()) return false;
    if (!edit.department || !edit.department.trim()) return false;
    if (!edit.jobTitle || !edit.jobTitle.trim()) return false;
    if (!edit.workEmail || !edit.workEmail.trim()) return false;
    return true;
  }

  async function save() {
    setSubmitted(true);
    if (!isValidEdit()) {
      setFlash({ type: "error", text: "Vui lòng nhập đủ Employee ID, Department, Job Title và Work Email." });
      return;
    }
    setIsSaving(true);
    try {
      const payload: any = {
        accountId: edit.accountId ?? 0,
        employeeId: edit.employeeId,
        department: edit.department,
        position: edit.position || "",
        jobTitle: edit.jobTitle,
        hireDate: edit.hireDate || new Date().toISOString().slice(0, 10),
        employmentType: edit.employmentType || "",
        workSchedule: edit.workSchedule || "",
        salary: Number(edit.salary || 0),
        hourlyRate: Number(edit.hourlyRate || 0),
        managerId: edit.managerId ?? null,
        officeLocation: edit.officeLocation || "",
        workPhone: edit.workPhone || "",
        workEmail: edit.workEmail,
        skills: edit.skills || "",
        certifications: edit.certifications || "",
        performanceRating: Number(edit.performanceRating || 0),
        lastReviewDate: edit.lastReviewDate || null,
        nextReviewDate: edit.nextReviewDate || null,
        vacationDaysRemaining: Number(edit.vacationDaysRemaining || 0),
        sickDaysRemaining: Number(edit.sickDaysRemaining || 0),
        isActive: edit.isActive ?? true,
        terminationDate: edit.terminationDate || null,
        terminationReason: edit.terminationReason || null,
        notes: edit.notes || "",
      };

      let res: Response;
      if (edit.id) {
        res = await fetch("/api/system/staff-profiles", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: edit.id, ...payload }),
        });
      } else {
        res = await fetch("/api/system/staff-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Lưu hồ sơ nhân viên thất bại");
      }
      // Sau khi lưu hồ sơ, nếu có chọn vai trò thì gán roles cho user theo email công việc
      if ((selectedRoles || []).length > 0 && (edit.workEmail || payload.workEmail)) {
        try {
          const email = (edit.workEmail || payload.workEmail) as string
          const assignRes = await fetch('/api/system/users/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userEmail: email, roles: selectedRoles })
          })
          if (!assignRes.ok) {
            const err = await assignRes.json().catch(() => ({}))
            throw new Error(err.error || 'Gán vai trò thất bại')
          }
        } catch (e: any) {
          setFlash({ type: 'error', text: e?.message || 'Gán vai trò thất bại' })
        }
      }
      setEditOpen(false);
      setFlash({ type: "success", text: edit.id ? "Đã cập nhật hồ sơ nhân viên." : "Đã tạo hồ sơ nhân viên mới." });
      await refetch();
    } catch (e: any) {
      setFlash({ type: "error", text: e?.message || "Có lỗi xảy ra khi lưu." });
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteProfile(id: number) {
    if (!id) return;
    if (!window.confirm("Bạn có chắc muốn xóa hồ sơ nhân viên này?")) return;
    try {
      const res = await fetch(`/api/system/staff-profiles?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Xóa hồ sơ nhân viên thất bại");
      }
      setFlash({ type: "success", text: "Đã xóa hồ sơ nhân viên." });
      await refetch();
    } catch (e: any) {
      setFlash({ type: "error", text: e?.message || "Có lỗi xảy ra khi xóa." });
    }
  }

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.121 17.804A4 4 0 018 17h8a4 4 0 012.879 1.196M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Quản lý hồ sơ nhân viên</h1>
              <p className="text-xs text-gray-500">{filtered.length} hồ sơ</p>
            </div>
          </div>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm">
            Thêm hồ sơ
          </Button>
        </div>
      </div>

      {flash && (
        <div
          className={`px-4 py-2 text-sm ${
            flash.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {flash.text}
        </div>
      )}

      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 mt-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Input
                placeholder="Tìm theo employeeId, chức danh, phòng ban, email..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-4 pr-10 py-2 text-sm border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang làm việc</option>
              <option value="INACTIVE">Ngừng làm việc</option>
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === "ALL" ? "Tất cả phòng ban" : d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-gray-50 border-b border-gray-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Danh sách hồ sơ nhân viên</h2>
              <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                {filtered.length} hồ sơ
              </span>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <colgroup>
                  <col className="w-[10%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[20%]" />
                  <col className="w-[10%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <th className="px-4 py-3 text-left font-semibold">Employee ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Họ tên (job title)</th>
                    <th className="px-4 py-3 text-left font-semibold">Vị trí</th>
                    <th className="px-4 py-3 text-left font-semibold">Phòng ban</th>
                    <th className="px-4 py-3 text-left font-semibold">Email công việc</th>
                    <th className="px-4 py-3 text-center font-semibold">Trạng thái</th>
                    <th className="px-4 py-3 text-center font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice((page - 1) * size, page * size).map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 border-b border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900">{row.employeeId}</td>
                      <td className="px-4 py-3 text-gray-700">{row.jobTitle}</td>
                      <td className="px-4 py-3 text-gray-700">{row.position}</td>
                      <td className="px-4 py-3 text-gray-700">{row.department}</td>
                      <td className="px-4 py-3 text-gray-700">{row.workEmail}</td>
                      <td className="px-4 py-3 text-center">
                        {row.isActive ? <Badge tone="success">Đang làm việc</Badge> : <Badge tone="muted">Ngừng làm</Badge>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="secondary"
                            className="h-8 px-3 text-xs"
                            onClick={() => {
                              setSelected(row);
                              setDetailOpen(true);
                            }}
                          >
                            Xem
                          </Button>
                          <Button className="h-8 px-3 text-xs" onClick={() => openEdit(row)}>
                            Sửa
                          </Button>
                          <Button variant="danger" className="h-8 px-3 text-xs" onClick={() => deleteProfile(row.id)}>
                            Xóa
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden">
              {filtered.slice((page - 1) * size, page * size).map((row) => (
                <div key={row.id} className="border-b border-gray-100 p-4 hover:bg-gray-50/50 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-500">Employee ID</span>
                        <span className="text-sm font-semibold text-gray-900">{row.employeeId}</span>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{row.jobTitle}</div>
                      <div className="text-xs text-gray-600">{row.department}</div>
                    </div>
                    <div>{row.isActive ? <Badge tone="success">Đang làm</Badge> : <Badge tone="muted">Ngừng</Badge>}</div>
                  </div>
                  <div className="text-xs text-gray-600 mb-3">
                    <div>Email: {row.workEmail}</div>
                    {row.workPhone && <div>Điện thoại: {row.workPhone}</div>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="secondary"
                      className="h-9 text-xs"
                      onClick={() => {
                        setSelected(row);
                        setDetailOpen(true);
                      }}
                    >
                      Xem
                    </Button>
                    <Button className="h-9 text-xs" onClick={() => openEdit(row)}>
                      Sửa
                    </Button>
                    <Button variant="danger" className="h-9 text-xs" onClick={() => deleteProfile(row.id)}>
                      Xóa
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {filtered.length > size && (
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-4 border-t border-gray-200/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                  Hiển thị{" "}
                  <span className="font-semibold">
                    {(page - 1) * size + 1} - {Math.min(page * size, filtered.length)}
                  </span>{" "}
                  trên {filtered.length} hồ sơ
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-3 text-xs"
                  >
                    Trước
                  </Button>
                  <span className="text-sm">
                    Trang {page} / {Math.max(1, Math.ceil(filtered.length / size))}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={page >= Math.ceil(filtered.length / size)}
                    onClick={() => setPage((p) => Math.min(Math.ceil(filtered.length / size), p + 1))}
                    className="h-8 px-3 text-xs"
                  >
                    Sau
                  </Button>
                  <select
                    value={size}
                    onChange={(e) => {
                      setPage(1);
                      setSize(parseInt(e.target.value, 10));
                    }}
                    className="h-8 border border-gray-300 rounded-md text-xs px-2"
                  >
                    <option value={10}>10 / trang</option>
                    <option value={20}>20 / trang</option>
                    <option value={50}>50 / trang</option>
                  </select>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết hồ sơ nhân viên">
        {selected && (
          <div className="p-4 space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5.121 17.804A4 4 0 018 17h8a4 4 0 012.879 1.196M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {selected.jobTitle} - {selected.employeeId}
                    </h3>
                    {selected.isActive ? <Badge tone="success">Đang làm việc</Badge> : <Badge tone="muted">Ngừng làm</Badge>}
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {selected.department} • {selected.position}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Email công việc</div>
                <div className="font-medium text-gray-900 break-all">{selected.workEmail}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Điện thoại</div>
                <div className="font-medium text-gray-900">{selected.workPhone || "—"}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Ngày vào làm</div>
                <div className="font-medium text-gray-900">{selected.hireDate}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Loại hợp đồng</div>
                <div className="font-medium text-gray-900">{selected.employmentType || "—"}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Lịch làm việc</div>
                <div className="font-medium text-gray-900">{selected.workSchedule || "—"}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Văn phòng</div>
                <div className="font-medium text-gray-900">{selected.officeLocation || "—"}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Mức lương tháng</div>
                <div className="font-medium text-gray-900">{formatCurrency(selected.salary)}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Lương theo giờ</div>
                <div className="font-medium text-gray-900">{formatCurrency(selected.hourlyRate)}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Ngày nghỉ phép còn lại</div>
                <div className="font-medium text-gray-900">{formatNumberDisplay(selected.vacationDaysRemaining)}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Ngày nghỉ ốm còn lại</div>
                <div className="font-medium text-gray-900">{formatNumberDisplay(selected.sickDaysRemaining)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Điểm đánh giá</div>
                <div className="font-medium text-gray-900">{formatNumberDisplay(selected.performanceRating)}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Quản lý trực tiếp</div>
                <div className="font-medium text-gray-900">{selected.managerId ?? "—"}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Đánh giá gần nhất</div>
                <div className="font-medium text-gray-900">{selected.lastReviewDate || "—"}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Đánh giá kế tiếp</div>
                <div className="font-medium text-gray-900">{selected.nextReviewDate || "—"}</div>
              </div>
            </div>

            {(selected.terminationDate || selected.terminationReason) && (
              <div className="rounded-lg border border-red-100 p-3 bg-red-50 text-sm">
                <div className="text-gray-500 mb-1">Thông tin nghỉ việc</div>
                <div className="text-gray-900">
                  {selected.terminationDate ? `Ngày nghỉ việc: ${selected.terminationDate}` : ""}
                  {selected.terminationReason ? ` • Lý do: ${selected.terminationReason}` : ""}
                </div>
              </div>
            )}

            {(selected.createdDate || selected.lastModifiedDate) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {selected.createdDate && (
                  <div className="rounded-lg border border-gray-200 p-3 bg-white">
                    <div className="text-gray-500">Ngày tạo</div>
                    <div className="font-medium text-gray-900">
                      {new Date(selected.createdDate).toLocaleString("vi-VN")}
                    </div>
                  </div>
                )}
                {selected.lastModifiedDate && (
                  <div className="rounded-lg border border-gray-200 p-3 bg-white">
                    <div className="text-gray-500">Cập nhật gần nhất</div>
                    <div className="font-medium text-gray-900">
                      {new Date(selected.lastModifiedDate).toLocaleString("vi-VN")}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selected.notes && (
              <div className="rounded-lg border border-gray-200 p-3 bg-white text-sm">
                <div className="text-gray-500 mb-1">Ghi chú</div>
                <div className="text-gray-900 whitespace-pre-line">{selected.notes}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={edit.id ? "Sửa hồ sơ nhân viên" : "Thêm hồ sơ nhân viên"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Hủy
            </Button>
            <Button disabled={!isValidEdit() || isSaving} onClick={save}>
              {isSaving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        }
      >
        <div className="p-1 space-y-5">
          {/* Nhóm: Thông tin cơ bản */}
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/40 px-3 py-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-semibold text-gray-800"
              onClick={() => setOpenBasic(v => !v)}
            >
              <span>Thông tin cơ bản</span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${openBasic ? "rotate-0" : "-rotate-90"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openBasic && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mã nhân viên *</label>
                <Input
                  value={edit.employeeId || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, employeeId: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Chức danh công việc *</label>
                <Input
                  value={edit.jobTitle || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, jobTitle: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vị trí</label>
                <Input
                  value={edit.position || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, position: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phòng ban *</label>
                <Input
                  value={edit.department || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, department: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email công việc *</label>
                <Input
                  type="email"
                  value={edit.workEmail || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, workEmail: e.target.value }))}
                />
                {submitted && (!edit.workEmail || !edit.workEmail.trim()) && (
                  <p className="mt-1 text-xs text-red-600">Email công việc là bắt buộc.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Số điện thoại công việc</label>
                <Input
                  value={edit.workPhone || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, workPhone: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ngày vào làm</label>
                <Input
                  type="date"
                  value={edit.hireDate || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, hireDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Văn phòng / Địa điểm làm việc</label>
                <Input
                  value={edit.officeLocation || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, officeLocation: e.target.value }))}
                />
              </div>
            </div>
            )}
          </div>

          {/* Nhóm: Công việc & lương */}
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/40 px-3 py-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-semibold text-gray-800"
              onClick={() => setOpenJob(v => !v)}
            >
              <span>Thông tin công việc & lương</span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${openJob ? "rotate-0" : "-rotate-90"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openJob && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Loại hợp đồng</label>
                <Input
                  value={edit.employmentType || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, employmentType: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lịch làm việc</label>
                <Input
                  value={edit.workSchedule || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, workSchedule: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mức lương (theo tháng)</label>
                <Input
                  type="number"
                  min="0"
                  value={edit.salary ?? ""}
                  onChange={(e) =>
                    setEdit((prev) => ({
                      ...prev,
                      salary: e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lương theo giờ</label>
                <Input
                  type="number"
                  min="0"
                  value={edit.hourlyRate ?? ""}
                  onChange={(e) =>
                    setEdit((prev) => ({
                      ...prev,
                      hourlyRate: e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mã quản lý trực tiếp</label>
                <Input
                  type="number"
                  min="0"
                  value={edit.managerId ?? ""}
                  onChange={(e) =>
                    setEdit((prev) => ({
                      ...prev,
                      managerId: e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Đánh giá hiệu suất (0 - 10)</label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={edit.performanceRating ?? ""}
                  onChange={(e) =>
                    setEdit((prev) => ({
                      ...prev,
                      performanceRating: e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Số ngày nghỉ phép còn lại</label>
                <Input
                  type="number"
                  min="0"
                  value={edit.vacationDaysRemaining ?? ""}
                  onChange={(e) =>
                    setEdit((prev) => ({
                      ...prev,
                      vacationDaysRemaining: e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Số ngày nghỉ ốm còn lại</label>
                <Input
                  type="number"
                  min="0"
                  value={edit.sickDaysRemaining ?? ""}
                  onChange={(e) =>
                    setEdit((prev) => ({
                      ...prev,
                      sickDaysRemaining: e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            )}
          </div>

          {/* Nhóm: Đánh giá & ngày nghỉ, nghỉ việc */}
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/40 px-3 py-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-semibold text-gray-800"
              onClick={() => setOpenReview(v => !v)}
            >
              <span>Đánh giá hiệu suất & nghỉ phép / Nghỉ việc</span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${openReview ? "rotate-0" : "-rotate-90"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openReview && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" title="Quản lý lịch đánh giá hiệu suất, ngày phép còn lại và thông tin nghỉ việc (nếu có).">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ngày đánh giá gần nhất</label>
                <Input
                  type="date"
                  value={edit.lastReviewDate || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, lastReviewDate: e.target.value || null }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ngày đánh giá kế tiếp</label>
                <Input
                  type="date"
                  value={edit.nextReviewDate || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, nextReviewDate: e.target.value || null }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ngày nghỉ việc</label>
                <Input
                  type="date"
                  value={edit.terminationDate || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, terminationDate: e.target.value || null }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lý do nghỉ việc</label>
                <Input
                  value={edit.terminationReason || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, terminationReason: e.target.value }))}
                />
              </div>
            </div>
            )}
          </div>

          {/* Nhóm: Kỹ năng & chứng chỉ + Trạng thái + Ghi chú */}
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/40 px-3 py-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-semibold text-gray-800"
              onClick={() => setOpenSkills(v => !v)}
            >
              <span>Kỹ năng & chứng chỉ / Trạng thái</span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${openSkills ? "rotate-0" : "-rotate-90"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openSkills && (
            <div
              className="space-y-3"
              title="Kỹ năng, chứng chỉ liên quan và trạng thái đang làm việc của nhân viên."
            >
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kỹ năng</label>
                <textarea
                  value={edit.skills || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, skills: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Chứng chỉ</label>
                <textarea
                  value={edit.certifications || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, certifications: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <input
                id="isActive"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                checked={edit.isActive ?? true}
                onChange={(e) => setEdit((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              <label htmlFor="isActive" className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 border border-green-200">
                Đang làm việc
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú</label>
              <textarea
                value={edit.notes || ""}
                onChange={(e) => setEdit((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Nhóm: Gán vai trò (Multi-roles) */}
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/40 px-3 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">Gán vai trò (Multi-roles)</span>
              <span className="text-xs text-gray-500">{selectedRoles.length} vai trò</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(roles || []).filter(r => r.isActive !== false).map((r) => (
                <label key={r.code} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedRoles.includes(r.code)}
                    onChange={(e) => {
                      setSelectedRoles((prev) => e.target.checked ? [...prev, r.code] : prev.filter(x => x !== r.code))
                    }}
                  />
                  <span className="font-medium text-gray-800">{r.name}</span>
                  <span className="text-xs text-gray-500">({r.code})</span>
                </label>
              ))}
            </div>
            <div className="text-xs text-gray-500">Chọn một hoặc nhiều vai trò để gán cho nhân viên (dựa trên email công việc).</div>
          </div>
        </div>
      </Modal>
    </>
  );
}


