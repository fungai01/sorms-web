"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { Table, THead, TBody } from "@/components/ui/Table";
import { useStaffProfilesFiltered, useRoles } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { StaffProfile } from "@/lib/types";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type RoleItem = { id?: number; code: string; name: string; description?: string; isActive?: boolean }

export default function StaffProfilesPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  
  // Refs to prevent spam requests
  const filterDebounceRef = useRef<NodeJS.Timeout | null>(null)
  
  // Debounced filters
  const [debouncedStatusFilter, setDebouncedStatusFilter] = useState<StatusFilter>("ALL");
  const [debouncedDepartmentFilter, setDebouncedDepartmentFilter] = useState<string>("ALL");
  
  // Memoize filter values
  const statusFilterValue = useMemo(() => 
    debouncedStatusFilter !== 'ALL' ? (debouncedStatusFilter === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE') : undefined,
    [debouncedStatusFilter]
  );
  const departmentFilterValue = useMemo(() => 
    debouncedDepartmentFilter !== 'ALL' ? debouncedDepartmentFilter : undefined,
    [debouncedDepartmentFilter]
  );
  
  const { data: staffData, refetch: refetchStaff, loading: loadingStaff } = useStaffProfilesFiltered(
    statusFilterValue,
    departmentFilterValue
  );
  const staffRows: StaffProfile[] = (staffData as unknown as StaffProfile[]) ?? [];
  
  // Debounce filter changes
  useEffect(() => {
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current)
    filterDebounceRef.current = setTimeout(() => {
      setDebouncedStatusFilter(statusFilter)
      setDebouncedDepartmentFilter(departmentFilter)
    }, 500)
    return () => { if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current) }
  }, [statusFilter, departmentFilter])

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

  // Multi-roles selection
  const rolesParams = useMemo(() => ({ page: 0, size: 100 }), []);
  const { data: rolesData } = useRoles(rolesParams);
  const roles: RoleItem[] = useMemo(() => {
    return Array.isArray((rolesData as any)?.items) 
      ? (rolesData as any).items 
      : (Array.isArray(rolesData as any) ? rolesData as any : []);
  }, [rolesData]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    staffRows.forEach((r) => { if (r.department) set.add(r.department); });
    return ["ALL", ...Array.from(set).sort()];
  }, [staffRows]);

  const filtered = useMemo<StaffProfile[]>(() => {
    const q = query.trim().toLowerCase();
    return staffRows
      .filter((s: StaffProfile) => 
        !q || 
        (s.employeeId || '').toLowerCase().includes(q) ||
        (s.department || '').toLowerCase().includes(q) ||
        (s.position || '').toLowerCase().includes(q) ||
        (s.workEmail || '').toLowerCase().includes(q)
      )
      .sort((a, b) => (a.employeeId || '').localeCompare(b.employeeId || ''));
  }, [staffRows, query]);

  const paginatedRows = useMemo(
    () => filtered.slice((page - 1) * size, page * size),
    [filtered, page, size]
  );

  const handleCloseEdit = useCallback(() => {
    setEditOpen(false);
    setEdit({});
    setSubmitted(false);
    setSelectedRoles([]);
  }, []);

  const handleOpenEdit = (s: StaffProfile) => {
    setEdit(s);
    setEditOpen(true);
  };

  const handleOpenCreate = () => {
    setEdit({ 
      employeeId: generateEmployeeId(),
      isActive: true,
      hireDate: new Date().toISOString().split('T')[0]
    });
    setEditOpen(true);
  };

  const generateEmployeeId = () => {
    const maxId = staffRows.reduce((max, s: StaffProfile) => {
      const num = parseInt(s.employeeId?.replace('EMP-', '') || '0');
      return num > max ? num : max;
    }, 0);
    return `EMP-${String(maxId + 1).padStart(3, '0')}`;
  };

  const save = async () => {
    setSubmitted(true);
    if (!edit.employeeId || !edit.department || !edit.position) return;

    setIsSaving(true);
    const response = edit.id 
      ? await apiClient.updateStaffProfile(edit.id, edit)
      : await apiClient.createStaffProfile(edit);

    if (response.success) {
      await refetchStaff();
      setFlash({ type: 'success', text: edit.id ? 'Đã cập nhật nhân viên.' : 'Đã thêm nhân viên mới.' });
      handleCloseEdit();
    } else {
      setFlash({ type: 'error', text: response.error || 'Có lỗi xảy ra.' });
    }
    setIsSaving(false);
  };

  const doDelete = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa nhân viên này?')) return;
    const response = await apiClient.deleteStaffProfile(id);
    if (response.success) {
      await refetchStaff();
      setFlash({ type: 'success', text: 'Đã xóa nhân viên.' });
    } else {
      setFlash({ type: 'error', text: response.error || 'Lỗi khi xóa.' });
    }
  };

  const searchUsers = async () => {
    if (!searchKeyword.trim()) return;
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      params.set("q", searchKeyword.trim());
      params.set("size", "20");
      const res = await fetch(`/api/system/users?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        console.error("Failed to search users:", await res.text().catch(() => ""));
        setSearchResults([]);
      } else {
        const data = await res.json().catch(() => ({} as any));
        const list = Array.isArray((data as any)?.items)
          ? (data as any).items
          : Array.isArray(data)
          ? data
          : [];
        setSearchResults(list);
      }
    } catch (e) {
      console.error("searchUsers error:", e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const renderStatusBadge = (isActive?: boolean) => {
    if (isActive) return <Badge tone="available">Đang làm việc</Badge>;
    return <Badge tone="muted">Đã nghỉ</Badge>;
  };

  return (
    <div className="px-6 pt-4 pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Filters Card - giống Users/Tasks */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
          <div className="border-b border-gray-200/50 px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Quản lý nhân sự</h1>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  className="h-10 px-4 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm whitespace-nowrap"
                  onClick={handleOpenCreate}
                >
                  Thêm nhân viên
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-white px-6 py-4">
            {/* Mobile filters */}
            <div className="lg:hidden space-y-3">
              <div className="relative">
                <Input
                  className="w-full pl-4 pr-10 py-2.5 text-sm border-gray-300 rounded-xl focus:ring-0 focus:border-gray-300"
                  placeholder="Tìm theo mã, phòng ban, chức vụ..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative rounded-xl border border-gray-300 bg-white overflow-hidden">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="ACTIVE">Đang làm việc</option>
                    <option value="INACTIVE">Đã nghỉ</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="relative rounded-xl border border-gray-300 bg-white overflow-hidden">
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d === "ALL" ? "Tất cả phòng ban" : d}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop filters */}
            <div className="hidden lg:flex flex-row gap-4 items-center">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Input
                    className="w-full pl-4 pr-10 py-2.5 text-sm border-gray-300 rounded-xl focus:ring-0 focus:border-gray-300"
                    placeholder="Tìm theo mã, phòng ban, chức vụ..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="w-48 flex-shrink-0 relative rounded-xl border border-gray-300 bg-white overflow-hidden">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang làm việc</option>
                  <option value="INACTIVE">Đã nghỉ</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <div className="w-56 flex-shrink-0 relative rounded-xl border border-gray-300 bg-white overflow-hidden">
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d === "ALL" ? "Tất cả phòng ban" : d}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts & loading */}
        {flash && (
          <div
            className={`rounded-xl border p-3 text-sm shadow-sm ${
              flash.type === "success"
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {flash.text}
          </div>
        )}

        {loadingStaff && (
          <div className="rounded-xl border p-4 text-center bg-gray-50 border-gray-200 shadow-sm">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
              <span className="text-sm text-gray-600">Đang tải danh sách nhân sự...</span>
            </div>
          </div>
        )}

        {!loadingStaff && (
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Danh sách nhân sự</h2>
                <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                  {filtered.length} nhân sự
                </span>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
            <Table>
              <THead>
                <tr>
                      <th className="px-4 py-3 text-center text-sm font-bold">Mã NV</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Chức danh</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Phòng ban</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Chức vụ</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Thao tác</th>
                </tr>
              </THead>
              <TBody>
                    {paginatedRows.map((s: StaffProfile, idx: number) => (
                      <tr
                        key={s.id}
                        className={`transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-100"} hover:bg-[#f2f8fe]`}
                      >
                        <td className="px-4 py-3 text-sm font-mono">{s.employeeId}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 truncate">{s.jobTitle}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{s.department || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{s.position || "—"}</td>
                        <td className="px-4 py-3 text-center">{renderStatusBadge(s.isActive)}</td>
                        <td className="px-4 py-3 text-center">
                      <div className="flex gap-2 justify-center">
                            <Button
                              variant="secondary"
                              className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                              onClick={() => {
                                setSelected(s);
                                setDetailOpen(true);
                              }}
                            >
                              Xem
                            </Button>
                            <Button
                              variant="secondary"
                              className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                              onClick={() => handleOpenEdit(s)}
                            >
                              Sửa
                            </Button>
                        <Button
                          variant="danger"
                              className="h-8 px-3 text-xs"
                          onClick={() => s.id !== undefined && doDelete(s.id)}
                        >
                          Xóa
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </TBody>
            </Table>
          </div>

              {/* Mobile cards */}
              <div className="lg:hidden p-3 space-y-3">
                {paginatedRows.map((s: StaffProfile) => (
                  <div
                    key={s.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
                  >
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] flex items-center justify-center shadow-sm flex-shrink-0 border border-[hsl(var(--primary)/0.25)]">
                            <svg
                              className="w-5 h-5"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M6 20C6 17.7909 8.68629 16 12 16C15.3137 16 18 17.7909 18 20"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-gray-900 text-base truncate" title={s.jobTitle}>
                              {s.jobTitle}
                            </h3>
                            <p className="text-sm text-gray-600 truncate">{s.department || "—"}</p>
                          </div>
                        </div>
                        <div className="flex-shrink-0">{renderStatusBadge(s.isActive)}</div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Mã NV</span>
                        <span className="font-mono font-semibold">{s.employeeId}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Chức vụ</span>
                        <span className="font-medium">{s.position || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Email công việc</span>
                        <span className="font-medium truncate max-w-[160px]">{s.workEmail || "—"}</span>
                      </div>
                    </div>

                    <div className="px-3 py-3 bg-gray-50 border-t border-gray-100">
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant="secondary"
                          className="h-10 text-xs font-medium px-2 bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                          onClick={() => {
                            setSelected(s);
                            setDetailOpen(true);
                          }}
                        >
                          Xem
                        </Button>
                        <Button
                          variant="secondary"
                          className="h-10 text-xs font-medium px-2 bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                          onClick={() => handleOpenEdit(s)}
                        >
                          Sửa
                        </Button>
                        <Button
                          variant="danger"
                          className="h-10 text-xs font-medium px-2"
                          onClick={() => s.id !== undefined && doDelete(s.id)}
                        >
                          Xóa
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {filtered.length > 0 && (
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-3 py-4 border-t border-gray-200/50">
                  <div className="flex flex-col lg:flex-row items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span>Hàng / trang:</span>
                      <select
                        className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm"
                        value={size}
                        onChange={(e) => {
                          setPage(1);
                          setSize(parseInt(e.target.value, 10));
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                      <span className="text-gray-500">trên {filtered.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        className="h-9 px-3 text-sm"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Trước
                      </Button>
                      <span className="px-2 font-semibold text-gray-700">
                        Trang {page} / {Math.max(1, Math.ceil(filtered.length / size))}
                      </span>
                      <Button
                        variant="secondary"
                        className="h-9 px-3 text-sm"
                        disabled={page >= Math.ceil(filtered.length / size)}
                        onClick={() =>
                          setPage((p) => Math.min(Math.ceil(filtered.length / size), p + 1))
                        }
                      >
                        Sau
                      </Button>
                    </div>
                  </div>
                </div>
              )}
        </CardBody>
      </Card>
        )}

        {/* Detail Modal với thông tin đầy đủ */}
        <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết nhân viên" size="xl">
        {selected && (
          <div className="space-y-4 p-1">
            {/* Header gradient giống Users/Tasks */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] flex items-center justify-center shadow-sm flex-shrink-0 border border-[hsl(var(--primary)/0.25)]">
                  <svg
                    className="w-7 h-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6 20C6 17.7909 8.68629 16 12 16C15.3137 16 18 17.7909 18 20"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                      {selected.jobTitle || "Nhân sự"}
                    </h3>
                    {renderStatusBadge(selected.isActive)}
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {selected.department || "Chưa có phòng ban"}
                    {selected.position ? ` • ${selected.position}` : ""}
                  </div>
                </div>
              </div>
            </div>

            {/* Thông tin chi tiết - giống với form chỉnh sửa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500 mb-1">Mã nhân viên</div>
                <div className="font-medium text-gray-900 break-words">
                  {selected.employeeId}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500 mb-1">Phòng ban</div>
                <div className="font-medium text-gray-900 break-words">
                  {selected.department || "—"}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500 mb-1">Chức vụ</div>
                <div className="font-medium text-gray-900 break-words">
                  {selected.position || "—"}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500 mb-1">Email công việc</div>
                <div className="font-medium text-gray-900 break-words">
                  {selected.workEmail || "—"}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500 mb-1">SĐT công việc</div>
                <div className="font-medium text-gray-900 break-words">
                  {selected.workPhone || "—"}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500 mb-1">Địa điểm làm việc</div>
                <div className="font-medium text-gray-900 break-words">
                  {selected.officeLocation || "—"}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal - giao diện mới giống Users/Tasks */}
      <Modal
        open={editOpen}
        onClose={handleCloseEdit}
        title={edit.id ? "Sửa nhân viên" : "Thêm nhân viên"}
        size="xl"
      >
        <div className="p-4 sm:p-6 space-y-4">
          {/* Header trong modal */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-blue-200 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] flex items-center justify-center shadow-sm border border-[hsl(var(--primary)/0.25)]">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6 20C6 17.7909 8.68629 16 12 16C15.3137 16 18 17.7909 18 20"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                    {edit.jobTitle || "Nhân sự"}
                  </h3>
                  {renderStatusBadge(edit.isActive)}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 truncate">
                  {edit.department || "Chưa có phòng ban"}{edit.position ? ` • ${edit.position}` : ""}
                </div>
              </div>
            </div>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Mã nhân viên <span className="text-red-500">*</span>
              </label>
              <Input
                value={edit.employeeId || ""}
                onChange={(e) => setEdit({ ...edit, employeeId: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Phòng ban <span className="text-red-500">*</span>
              </label>
              <Input
                value={edit.department || ""}
                onChange={(e) => setEdit({ ...edit, department: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Chức vụ <span className="text-red-500">*</span>
              </label>
              <Input
                value={edit.position || ""}
                onChange={(e) => setEdit({ ...edit, position: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email công việc</label>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  value={edit.workEmail || ""}
                  onChange={(e) => setEdit({ ...edit, workEmail: e.target.value })}
                  placeholder="Nhập email hoặc chọn từ danh sách user..."
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 px-3 text-xs whitespace-nowrap"
                  onClick={() => {
                    setSearchKeyword((edit.workEmail || "").toString());
                    setSearchResults([]);
                    setSearchUserOpen(true);
                  }}
                >
                  Tìm user
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">SĐT công việc</label>
              <Input
                value={edit.workPhone || ""}
                onChange={(e) => setEdit({ ...edit, workPhone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Địa điểm làm việc</label>
              <Input
                value={edit.officeLocation || ""}
                onChange={(e) => setEdit({ ...edit, officeLocation: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Trạng thái</label>
              <select
                className="w-full h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"
                value={edit.isActive ? "ACTIVE" : "INACTIVE"}
                onChange={(e) =>
                  setEdit({ ...edit, isActive: e.target.value === "ACTIVE" })
                }
              >
                <option value="ACTIVE">Đang làm việc</option>
                <option value="INACTIVE">Đã nghỉ</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={handleCloseEdit}>
              Hủy
            </Button>
            <Button variant="primary" onClick={save} disabled={isSaving}>
              Lưu
            </Button>
          </div>
        </div>
        </Modal>
        {/* Modal chọn user cho email công việc */}
        <Modal
          open={searchUserOpen}
          onClose={() => setSearchUserOpen(false)}
          title="Chọn user cho email công việc"
          size="lg"
        >
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Từ khóa (email, tên, SĐT)</label>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (searchResults.length > 0) {
                        const u: any = searchResults[0];
                        setEdit((prev) => ({
                          ...prev,
                          workEmail: prev.workEmail || u.email,
                          workPhone: prev.workPhone || u.phoneNumber || u.phone_number || prev.workPhone,
                          accountId: u.id ?? prev?.accountId,
                        }));
                        setSearchUserOpen(false);
                      } else if (searchKeyword.trim() && !isSearching) {
                        void searchUsers();
                      }
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setSearchUserOpen(false);
                    }
                  }}
                  placeholder="Nhập email hoặc tên user..."
                />
                <Button
                  type="button"
                  variant="primary"
                  className="h-10 px-4 text-sm"
                  onClick={searchUsers}
                  disabled={isSearching || !searchKeyword.trim()}
                >
                  {isSearching ? "Đang tìm..." : "Tìm"}
                </Button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {!isSearching && searchResults.length === 0 && searchKeyword.trim() && (
                <div className="text-sm text-gray-500">
                  Không có kết quả phù hợp.
                </div>
              )}
              {searchResults.map((u: any) => (
                <div
                  key={u.id || u.email}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {u.fullName || u.email}
                    </div>
                    <div className="text-xs text-gray-600">
                      {u.email}
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      setEdit((prev) => ({
                        ...prev,
                        workEmail: prev.workEmail || u.email,
                        workPhone: prev.workPhone || u.phoneNumber || u.phone_number || prev.workPhone,
                        accountId: u.id ?? prev?.accountId,
                      }));
                      setSearchUserOpen(false);
                    }}
                  >
                    Chọn
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
