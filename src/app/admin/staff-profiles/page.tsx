"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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
  
  // Refs to prevent spam requests
  const isInitialLoadRef = useRef(false)
  const filterDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const isProcessingRef = useRef(false)
  
  // Debounced filters
  const [debouncedStatusFilter, setDebouncedStatusFilter] = useState<StatusFilter>("ALL");
  const [debouncedDepartmentFilter, setDebouncedDepartmentFilter] = useState<string>("ALL");
  
  // Memoize filter values to prevent unnecessary re-fetches
  const statusFilterValue = useMemo(() => 
    debouncedStatusFilter !== 'ALL' ? (debouncedStatusFilter === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE') : undefined,
    [debouncedStatusFilter]
  );
  const departmentFilterValue = useMemo(() => 
    debouncedDepartmentFilter !== 'ALL' ? debouncedDepartmentFilter : undefined,
    [debouncedDepartmentFilter]
  );
  
  const { data, refetch } = useStaffProfilesFiltered(statusFilterValue, departmentFilterValue);
  
  // Debounce filter changes - only update if values actually changed 
  useEffect(() => {
    if (!isInitialLoadRef.current) {
      isInitialLoadRef.current = true
      setDebouncedStatusFilter(statusFilter)
      setDebouncedDepartmentFilter(departmentFilter)
      return
    }
    
    // Skip if values haven't changed
    if (statusFilter === debouncedStatusFilter && departmentFilter === debouncedDepartmentFilter) {
      return
    }
    
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current)
    }
    
    filterDebounceRef.current = setTimeout(() => {
      setDebouncedStatusFilter(statusFilter)
      setDebouncedDepartmentFilter(departmentFilter)
    }, 500)
    
    return () => {
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current)
      }
    }
  }, [statusFilter, departmentFilter, debouncedStatusFilter, debouncedDepartmentFilter])
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [flash, setFlash] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<StaffProfile | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<StaffProfile>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Search user modal
  const [searchUserOpen, setSearchUserOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Multi-roles selection for user assignment - memoize params to prevent re-fetch
  const rolesParams = useMemo(() => ({ page: 0, size: 100 }), []);
  const { data: rolesData } = useRoles(rolesParams);
  const roles: RoleItem[] = useMemo(() => {
    return Array.isArray((rolesData as any)?.items) 
      ? (rolesData as any).items 
      : (Array.isArray(rolesData as any) ? rolesData as any : []);
  }, [rolesData]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const formatCurrency = (value?: number | null) =>
    typeof value === "number" && !Number.isNaN(value) ? `${value.toLocaleString("vi-VN")} VND` : "—";

  const formatNumberDisplay = (value?: number | null) =>
    typeof value === "number" && !Number.isNaN(value) ? value : "—";

  useEffect(() => {
    if (data) {
      // Handle both { items: [...] } and direct array response
      const items = (data as any)?.items ?? (Array.isArray(data) ? data : []);
      // Only update if data actually changed
      setRows((prevRows) => {
        const newRows = items as StaffProfile[];
        // Quick check: if length and first item are same, likely same data
        if (prevRows.length === newRows.length && 
            prevRows.length > 0 && 
            prevRows[0]?.id === newRows[0]?.id) {
          return prevRows;
        }
        return newRows;
      });
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
  
  // Memoize paginated data to prevent recalculation
  const paginatedData = useMemo(() => {
    return filtered.slice((page - 1) * size, page * size);
  }, [filtered, page, size]);

  // Tạo mã nhân viên tự động EMP-001, EMP-002...
  function generateEmployeeId(): string {
    const existingIds = rows.map(r => r.employeeId).filter(id => id.startsWith("EMP-"));
    let maxNum = 0;
    existingIds.forEach(id => {
      const num = parseInt(id.replace("EMP-", ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });
    const nextNum = maxNum + 1;
    return `EMP-${String(nextNum).padStart(3, "0")}`;
  }

  // Tìm kiếm user theo email hoặc tên
  async function searchUsers() {
    if (!searchKeyword.trim()) return;
    setIsSearching(true);
    try {
      // Tìm theo email hoặc fullName
      const params = new URLSearchParams();
      params.set("page", "0");
      params.set("size", "20");
      // Gửi cả email và fullName để backend tìm
      if (searchKeyword.includes("@")) {
        params.set("email", searchKeyword);
      } else {
        params.set("fullName", searchKeyword);
      }
      const res = await fetch(`/api/system/users/search?${params.toString()}`, {
        credentials: "include", // Gửi cookies kèm theo để API route lấy được token
      });
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  // Chọn user từ kết quả tìm kiếm và điền vào form
  function selectUser(user: any) {
    // Lấy ID của user - convert sang number nếu có thể
    // Nếu là UUID (string) thì cần xử lý khác, nhưng tạm thời chỉ lấy số
    let userId: number | undefined;
    if (typeof user.id === 'number') {
      userId = user.id;
    } else if (typeof user.id === 'string') {
      // Nếu là số dạng string thì convert
      const numId = Number(user.id);
      if (!isNaN(numId)) {
        userId = numId;
      } else {
        // Nếu là UUID, có thể cần lấy từ field khác hoặc bỏ qua
        // Tạm thời để undefined và user sẽ phải nhập thủ công
        console.warn('User ID là UUID, không thể convert sang number:', user.id);
        userId = undefined;
      }
    }
    
    setEdit({
      accountId: userId,
      employeeId: generateEmployeeId(),
      workEmail: user.email || "",
      workPhone: user.phoneNumber || "",
      officeLocation: user.address || "",
      hireDate: new Date().toISOString().slice(0, 10),
      isActive: true,
      role: "STAFF" as any,
      department: "Nhân viên",
      position: "Nhân viên",
      jobTitle: "Nhân viên",
    } as Partial<StaffProfile>);
    setSearchUserOpen(false);
    setSearchKeyword("");
    setSearchResults([]);
    setSelectedRoles([]);
    setSubmitted(false);
    setEditOpen(true);
  }

  function openCreate() {
    // Mở modal tìm kiếm user trước
    setSearchKeyword("");
    setSearchResults([]);
    setSearchUserOpen(true);
  }

  // Tạo mới không cần tìm user
  function openCreateManual() {
    const defaultStaffData = {
      employeeId: generateEmployeeId(),
      role: "STAFF" as any,
      department: "Nhân viên",
      position: "Nhân viên",
      jobTitle: "Nhân viên",
    } as Partial<StaffProfile>;
    setEdit(defaultStaffData);
    setSelectedRoles([]);
    setSubmitted(false);
    setSearchUserOpen(false);
    setEditOpen(true);
  }

  function openEdit(row: StaffProfile) {
    // Auto-fill nếu role là STAFF và các trường chưa có giá trị
    const editData = { ...row };
    if ((editData as any).role === "STAFF" || !(editData as any).role) {
      if (!editData.department) editData.department = "Nhân viên";
      if (!editData.position) editData.position = "Nhân viên";
      if (!editData.jobTitle) editData.jobTitle = "Nhân viên";
      (editData as any).role = "STAFF";
    }
    setEdit(editData);
    setEditOpen(true);
  }

  // Auto-fill dựa trên vai trò hệ thống
  function handleRoleChange(role: string) {
    const roleDefaults: Record<string, { department: string; position: string; jobTitle: string }> = {
      "STAFF": { department: "Nhân viên", position: "Nhân viên", jobTitle: "Nhân viên" },
    };
    const defaults = roleDefaults[role] || {};
    setEdit((prev) => ({
      ...prev,
      role,
      // Tự động fill các trường khi chọn role STAFF
      department: defaults.department || prev.department || "",
      position: defaults.position || prev.position || "",
      jobTitle: defaults.jobTitle || prev.jobTitle || "",
    }));
  }

  // Auto-fill khi form mở và role là STAFF
  useEffect(() => {
    if (editOpen && ((edit as any).role === "STAFF" || !(edit as any).role)) {
      const needsUpdate = !edit.department || !edit.position || !edit.jobTitle;
      if (needsUpdate) {
        setEdit((prev) => ({
          ...prev,
          role: "STAFF" as any,
          department: prev.department || "Nhân viên",
          position: prev.position || "Nhân viên",
          jobTitle: prev.jobTitle || "Nhân viên",
        }));
      }
    }
  }, [editOpen, edit.department, edit.position, edit.jobTitle]);

  function isValidEdit() {
    if (edit.accountId === undefined || edit.accountId === null) return false;
    if (!edit.employeeId || !edit.employeeId.trim()) return false;
    if (!edit.department || !edit.department.trim()) return false;
    if (!edit.jobTitle || !edit.jobTitle.trim()) return false;
    if (!edit.workEmail || !edit.workEmail.trim()) return false;
    return true;
  }

  async function save() {
    setSubmitted(true);
    if (!isValidEdit()) {
      return;
    }
    setIsSaving(true);
    try {
      const payload: any = {
        accountId: edit.accountId ?? 0,
        employeeId: edit.employeeId,
        role: (edit as any).role || "STAFF",
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
            // Silent fail for role assignment
          }
        } catch {
          // Silent fail for role assignment
        }
      }
      setEditOpen(false);
      setSubmitted(false);
      setFlash({ type: "success", text: edit.id ? "Đã cập nhật hồ sơ nhân viên." : "Đã tạo hồ sơ nhân viên mới." });
      await refetch();
    } catch {
      // Silent fail - validation messages shown inline
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
        return;
      }
      setFlash({ type: "success", text: "Đã xóa hồ sơ nhân viên." });
      await refetch();
    } catch {
      // Silent fail
    }
  }

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Quản lý hồ sơ nhân viên</h1>
            <p className="text-xs text-gray-500">{filtered.length} hồ sơ</p>
          </div>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm">
            Thêm hồ sơ
          </Button>
        </div>
      </div>

      {flash && flash.type === "success" && (
        <div className="px-4 py-2 text-sm bg-green-50 text-green-800 border-b border-green-200">
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
        size="xl"
        footer={
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Hủy
            </Button>
            <Button disabled={!isValidEdit() || isSaving} onClick={save}>
              {isSaving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        }
      >
        <div className="p-6 space-y-6">
          {/* NHÓM 1: Thông tin cơ bản */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-5">
            <h3 className="text-base font-semibold text-blue-700 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Thông tin cơ bản
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account ID <span className="text-red-500">*</span></label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Nhập Account ID (số)"
                  value={edit.accountId ?? ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, accountId: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  className="h-11"
                />
                {submitted && (edit.accountId === undefined || edit.accountId === null) && (
                  <p className="mt-1 text-xs text-red-500">Vui lòng nhập Account ID</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mã nhân viên <span className="text-red-500">*</span></label>
                <Input
                  placeholder="VD: EMP-001"
                  value={edit.employeeId || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, employeeId: e.target.value }))}
                  className="h-11"
                  readOnly
                />
                {submitted && (!edit.employeeId || !edit.employeeId.trim()) && (
                  <p className="mt-1 text-xs text-red-500">Vui lòng nhập mã nhân viên</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vai trò hệ thống <span className="text-red-500">*</span></label>
                <select
                  value={(edit as any).role || "STAFF"}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full h-11 px-4 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  disabled
                >
                  <option value="STAFF">Nhân viên</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phòng ban <span className="text-red-500">*</span></label>
                <select
                  value={edit.department || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, department: e.target.value }))}
                  className="w-full h-11 px-4 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Chọn phòng ban --</option>
                  <option value="Quản lý hệ thống">Quản lý hệ thống</option>
                  <option value="Hành chính">Hành chính</option>
                  <option value="Nhân viên">Nhân viên</option>
                  <option value="Bảo vệ">Bảo vệ</option>
                  <option value="Khác">Khác</option>
                </select>
                {submitted && (!edit.department || !edit.department.trim()) && (
                  <p className="mt-1 text-xs text-red-500">Vui lòng chọn phòng ban</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vị trí</label>
                <Input
                  placeholder="VD: Trưởng phòng"
                  value={edit.position || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, position: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Chức danh <span className="text-red-500">*</span></label>
                <Input
                  placeholder="VD: Kỹ sư phần mềm"
                  value={edit.jobTitle || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, jobTitle: e.target.value }))}
                  className="h-11"
                />
                {submitted && (!edit.jobTitle || !edit.jobTitle.trim()) && (
                  <p className="mt-1 text-xs text-red-500">Vui lòng nhập chức danh</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ngày vào làm</label>
                <Input
                  type="date"
                  value={edit.hireDate || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, hireDate: e.target.value }))}
                  className="h-11"
                />
              </div>
            </div>
          </div>

          {/* NHÓM 2: Thông tin liên hệ */}
          <div className="rounded-xl border border-green-200 bg-green-50/30 p-5">
            <h3 className="text-base font-semibold text-green-700 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Thông tin liên hệ
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email công việc <span className="text-red-500">*</span></label>
                <Input
                  type="email"
                  placeholder="email@company.com"
                  value={edit.workEmail || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, workEmail: e.target.value }))}
                  className="h-11"
                />
                {submitted && (!edit.workEmail || !edit.workEmail.trim()) && (
                  <p className="mt-1 text-xs text-red-500">Vui lòng nhập email công việc</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Số điện thoại</label>
                <Input
                  placeholder="0123 456 789"
                  value={edit.workPhone || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, workPhone: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Địa điểm làm việc</label>
                <Input
                  placeholder="VD: Tòa nhà A, Tầng 5"
                  value={edit.officeLocation || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, officeLocation: e.target.value }))}
                  className="h-11"
                />
              </div>
            </div>
          </div>

          {/* Hợp đồng & Lương */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Loại hợp đồng</label>
              <select
                value={edit.employmentType || ""}
                onChange={(e) => setEdit((prev) => ({ ...prev, employmentType: e.target.value }))}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Chọn loại --</option>
                <option value="FULL_TIME">Toàn thời gian</option>
                <option value="PART_TIME">Bán thời gian</option>
                <option value="CONTRACT">Hợp đồng</option>
                <option value="INTERN">Thực tập</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Lịch làm việc</label>
              <select
                value={edit.workSchedule || ""}
                onChange={(e) => setEdit((prev) => ({ ...prev, workSchedule: e.target.value }))}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Chọn ca --</option>
                <option value="DAY">Ca ngày (8h-17h)</option>
                <option value="NIGHT">Ca đêm (22h-6h)</option>
                <option value="SHIFT">Ca xoay</option>
                <option value="FLEXIBLE">Linh hoạt</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Lương tháng</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  placeholder="VD: 15000"
                  value={edit.salary ?? ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, salary: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  className="flex-1"
                />
                <span className="text-sm font-medium text-gray-600 whitespace-nowrap bg-gray-100 px-3 py-2 rounded-lg border border-gray-300">.000 VNĐ</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Lương giờ</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  placeholder="VD: 50"
                  value={edit.hourlyRate ?? ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, hourlyRate: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  className="flex-1"
                />
                <span className="text-sm font-medium text-gray-600 whitespace-nowrap bg-gray-100 px-3 py-2 rounded-lg border border-gray-300">.000 VNĐ</span>
              </div>
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Đánh giá */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Điểm đánh giá (0-10)</label>
              <Input
                type="number"
                min="0"
                max="10"
                placeholder="0"
                value={edit.performanceRating ?? ""}
                onChange={(e) => setEdit((prev) => ({ ...prev, performanceRating: e.target.value === "" ? undefined : Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Đánh giá gần nhất</label>
              <Input
                type="date"
                value={edit.lastReviewDate || ""}
                onChange={(e) => setEdit((prev) => ({ ...prev, lastReviewDate: e.target.value || null }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Đánh giá tiếp theo</label>
              <Input
                type="date"
                value={edit.nextReviewDate || ""}
                onChange={(e) => setEdit((prev) => ({ ...prev, nextReviewDate: e.target.value || null }))}
              />
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Ngày phép */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ngày phép còn lại</label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={edit.vacationDaysRemaining ?? ""}
                onChange={(e) => setEdit((prev) => ({ ...prev, vacationDaysRemaining: e.target.value === "" ? undefined : Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ngày ốm còn lại</label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={edit.sickDaysRemaining ?? ""}
                onChange={(e) => setEdit((prev) => ({ ...prev, sickDaysRemaining: e.target.value === "" ? undefined : Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ngày nghỉ việc</label>
              <Input
                type="date"
                value={edit.terminationDate || ""}
                onChange={(e) => setEdit((prev) => ({ ...prev, terminationDate: e.target.value || null }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Lý do nghỉ việc</label>
              <Input
                placeholder="Nếu có"
                value={edit.terminationReason || ""}
                onChange={(e) => setEdit((prev) => ({ ...prev, terminationReason: e.target.value }))}
              />
            </div>
          </div>

          {/* Kỹ năng & Chứng chỉ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Kỹ năng</label>
              <textarea
                placeholder="VD: Java, React, SQL..."
                value={edit.skills || ""}
                onChange={(e) => setEdit((prev) => ({ ...prev, skills: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Chứng chỉ</label>
              <textarea
                placeholder="VD: AWS Certified, PMP..."
                value={edit.certifications || ""}
                onChange={(e) => setEdit((prev) => ({ ...prev, certifications: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Ghi chú & Trạng thái */}
          <div className="space-y-3">
            {/* ID Quản lý - đã ẩn */}
            {/* <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ID Quản lý</label>
              <Input
                type="number"
                min="0"
                placeholder="ID người quản lý (mặc định: 1 - Admin)"
                value={edit.managerId ?? ""}
                onChange={(e) => setEdit((prev) => ({ ...prev, managerId: e.target.value === "" ? undefined : Number(e.target.value) }))}
              />
            </div> */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ghi chú</label>
              <textarea
                placeholder="Ghi chú thêm về nhân viên..."
                value={edit.notes || ""}
                onChange={(e) => setEdit((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                id="isActive"
                type="checkbox"
                className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                checked={edit.isActive ?? true}
                onChange={(e) => setEdit((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Đang làm việc
              </label>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal tìm kiếm User */}
      <Modal
        open={searchUserOpen}
        onClose={() => setSearchUserOpen(false)}
        title="Tìm kiếm người dùng"
        size="lg"
        footer={
          <div className="flex justify-between w-full">
            <Button variant="secondary" onClick={openCreateManual}>
              Tạo mới không cần tìm
            </Button>
            <Button variant="secondary" onClick={() => setSearchUserOpen(false)}>
              Đóng
            </Button>
          </div>
        }
      >
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nhập email hoặc tên để tìm kiếm..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUsers()}
              className="flex-1"
            />
            <Button onClick={searchUsers} disabled={isSearching}>
              {isSearching ? "Đang tìm..." : "Tìm kiếm"}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">ID</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Email</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Họ tên</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">SĐT</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-700">Chọn</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((user) => (
                    <tr key={user.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900">{user.id}</td>
                      <td className="px-4 py-2 text-gray-700">{user.email}</td>
                      <td className="px-4 py-2 text-gray-700">{user.fullName || "—"}</td>
                      <td className="px-4 py-2 text-gray-700">{user.phoneNumber || "—"}</td>
                      <td className="px-4 py-2 text-center">
                        <Button
                          className="h-8 px-3 text-xs"
                          onClick={() => selectUser(user)}
                        >
                          Chọn
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {searchResults.length === 0 && searchKeyword && !isSearching && (
            <div className="text-center py-8 text-gray-500">
              Không tìm thấy người dùng nào
            </div>
          )}

          {!searchKeyword && (
            <div className="text-center py-8 text-gray-400">
              Nhập email hoặc tên để tìm kiếm người dùng
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}


