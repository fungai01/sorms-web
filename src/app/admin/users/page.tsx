"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useCallback, startTransition } from "react";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUsers } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TBody } from "@/components/ui/Table";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

type User = {
  id?: string | number;
  email: string;
  fullName: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  status?: "ACTIVE" | "INACTIVE";
  role?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  avatarUrl?: string;
  bio?: string;
  preferredLanguage?: string;
  timezone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  userProfileId?: string | number;
  idCardNumber?: string;
  idCardIssueDate?: string;
  idCardIssuePlace?: string;
  createdDate?: string;
  lastModifiedDate?: string;
};

function UsersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [rows, setRows] = useState<User[]>([]);
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  // Refs to prevent spam requests
  const isInitialLoadRef = useRef(false)
  const queryDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const isProcessingRef = useRef(false)
  const hasFetchedRef = useRef(false)
  
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [sortKey, setSortKey] = useState<"name" | "email">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Memoize users params to prevent recreating object on every render
  const usersParams = useMemo(() => ({
    page: page - 1,
    size,
    keyword: debouncedQuery.trim() || undefined,
    status: filterStatus === "ALL" ? undefined : filterStatus,
  }), [page, size, debouncedQuery, filterStatus]);

  // Load users with hook - debounced query
  const { data: usersData, loading, error, refetch: refetchUsers } = useUsers(usersParams);
  
  // Debounce query changes - but skip initial load to prevent duplicate requests
  useEffect(() => {
    // On initial load, set debouncedQuery immediately without debounce
    if (!isInitialLoadRef.current) {
      setDebouncedQuery(query)
      return
    }
    
    // For subsequent changes, debounce
    if (queryDebounceRef.current) {
      clearTimeout(queryDebounceRef.current)
    }
    
    queryDebounceRef.current = setTimeout(() => {
      setDebouncedQuery(query)
    }, 500)
    
    return () => {
      if (queryDebounceRef.current) {
        clearTimeout(queryDebounceRef.current)
      }
    }
  }, [query])
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  // Dùng proxy nội bộ để tránh gọi thẳng domain ngoài
  const ADDRESS_API = '/api/address/communes'

  const [editForm, setEditForm] = useState<{
    id?: string;
    full_name: string;
    email: string;
    phone_number?: string;
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    gender?: string;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    avatar_url?: string;
    bio?: string;
    preferred_language?: string;
    timezone?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;
    id_card_number?: string;
    id_card_issue_date?: string;
    id_card_issue_place?: string;
  }>({
    full_name: "",
    email: "",
    phone_number: "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "Việt Nam",
    avatar_url: "",
    bio: "",
    preferred_language: "vi",
    timezone: "GMT+7",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
    id_card_number: "",
    id_card_issue_date: "",
    id_card_issue_place: "",
  });
  // Address selection state (giống profile page)
  type Province = { code: string; name: string };
  type Ward = { code: string; name: string; provinceCode: string };
  const [allCommunes, setAllCommunes] = useState<Ward[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [selectedWard, setSelectedWard] = useState<string>("");
  const [provinceSearch, setProvinceSearch] = useState<string>("");
  const [wardSearch, setWardSearch] = useState<string>("");
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const [showWardDropdown, setShowWardDropdown] = useState(false);
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const genderOptions = [{ value: 'Nam', label: 'Nam' }, { value: 'Nữ', label: 'Nữ' }, { value: 'Khác', label: 'Khác' }];
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{ full_name: string; email: string; phone_number?: string }>(
    { full_name: "", email: "", phone_number: "" }
  );
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean; type: 'delete' | 'deactivate' | 'activate'; user?: User }>({ open: false, type: 'delete' });
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})$/;

  // Validation function
  const validateEditForm = () => {
    const errors: Record<string, string> = {};
    
    // Required fields
    if (!editForm.full_name?.trim()) {
      errors.full_name = "Họ tên là bắt buộc";
    } else if (editForm.full_name.trim().length < 3) {
      errors.full_name = "Họ tên phải có ít nhất 3 ký tự";
    }
    
    if (!editForm.email?.trim()) {
      errors.email = "Email là bắt buộc";
    } else if (!emailRegex.test(editForm.email)) {
      errors.email = "Email không đúng định dạng";
    }
    
    if (!editForm.phone_number?.trim()) {
      errors.phone_number = "Số điện thoại là bắt buộc";
    } else if (!phoneRegex.test(editForm.phone_number)) {
      errors.phone_number = "Số điện thoại không hợp lệ (10 số, bắt đầu 03/05/07/08/09)";
    }
    
    if (!editForm.date_of_birth) {
      errors.date_of_birth = "Ngày sinh là bắt buộc";
    }
    
    if (!editForm.gender) {
      errors.gender = "Giới tính là bắt buộc";
    }
    
    if (!selectedProvince) {
      errors.city = "Vui lòng chọn Tỉnh/Thành phố";
    }
    
    if (!selectedWard) {
      errors.state = "Vui lòng chọn Khu vực (Phường/Xã)";
    }
    
    // Optional but validate if filled - ID Card
    if (editForm.id_card_number || editForm.id_card_issue_date || editForm.id_card_issue_place) {
      if (!editForm.id_card_number?.trim()) {
        errors.id_card_number = "Số CMND/CCCD là bắt buộc khi điền thông tin giấy tờ";
      } else if (!/^\d{9,12}$/.test(editForm.id_card_number)) {
        errors.id_card_number = "Số CMND/CCCD phải là 9-12 chữ số";
      }
      if (!editForm.id_card_issue_date) {
        errors.id_card_issue_date = "Ngày cấp là bắt buộc";
      }
      if (!editForm.id_card_issue_place?.trim()) {
        errors.id_card_issue_place = "Nơi cấp là bắt buộc";
      }
    }
    
    // Optional but validate if filled - Emergency contact
    if (editForm.emergency_contact_name || editForm.emergency_contact_phone) {
      if (!editForm.emergency_contact_name?.trim()) {
        errors.emergency_contact_name = "Họ tên liên hệ khẩn cấp là bắt buộc";
      }
      if (!editForm.emergency_contact_phone?.trim()) {
        errors.emergency_contact_phone = "SĐT khẩn cấp là bắt buộc";
      } else if (!phoneRegex.test(editForm.emergency_contact_phone)) {
        errors.emergency_contact_phone = "SĐT khẩn cấp không hợp lệ";
      }
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateCreateForm = () => {
    const errors: Record<string, string> = {};
    const fullName = createForm.full_name?.trim() || "";
    const email = createForm.email?.trim() || "";
    const phone = createForm.phone_number?.trim() || "";

    if (!fullName) {
      errors.full_name = "Họ tên là bắt buộc";
    } else if (fullName.length < 3) {
      errors.full_name = "Họ tên phải có ít nhất 3 ký tự";
    }

    if (!email) {
      errors.email = "Email là bắt buộc";
    } else if (!emailRegex.test(email)) {
      errors.email = "Email không hợp lệ";
    }

    if (phone) {
      if (!phoneRegex.test(phone)) {
        errors.phone_number = "Số điện thoại không hợp lệ (10 số, bắt đầu 03/05/07/08/09)";
      }
    }

    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Hook-based loading
  useEffect(() => {
    // update loading state from hook
    setIsLoading(!!loading)
  }, [loading])

  useEffect(() => {
    // map usersData -> rows - đơn giản hóa theo cách user dashboard
    const data: any = usersData
    if (!data) return
    // API route trả về format: { items: [...] }
    const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
    const mappedUsers = list.map((u: any) => ({
      id: u.id,
      email: u.email || '',
      fullName: u.fullName || u.full_name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
      phoneNumber: u.phoneNumber || u.phone_number || '',
      firstName: u.firstName || u.first_name || '',
      lastName: u.lastName || u.last_name || '',
      status: u.status || 'ACTIVE',
      role: u.role || u.roles?.[0] || undefined,
      dateOfBirth: u.dateOfBirth || u.date_of_birth || u.dob,
      gender: u.gender,
      address: u.address,
      city: u.city,
      state: u.state,
      postalCode: u.postalCode || u.postal_code,
      country: u.country,
      avatarUrl: u.avatarUrl || u.avatar_url,
      bio: u.bio,
      preferredLanguage: u.preferredLanguage || u.preferred_language,
      timezone: u.timezone,
      emergencyContactName: u.emergencyContactName || u.emergency_contact_name,
      emergencyContactPhone: u.emergencyContactPhone || u.emergency_contact_phone,
      emergencyContactRelationship: u.emergencyContactRelationship || u.emergency_contact_relationship,
      userProfileId: u.userProfileId || u.user_profile_id,
      idCardNumber: u.idCardNumber || u.id_card_number,
      idCardIssueDate: u.idCardIssueDate || u.id_card_issue_date,
      idCardIssuePlace: u.idCardIssuePlace || u.id_card_issue_place,
      createdDate: u.createdDate || u.created_date,
      lastModifiedDate: u.lastModifiedDate || u.last_modified_date,
    }))
    setRows(mappedUsers)
  }, [usersData])

  // Xử lý lỗi từ hook
  useEffect(() => {
    if (error) {
      setMessage(`Lỗi khi tải danh sách users: ${error}`)
    }
  }, [error])

  useEffect(() => {
    // Chờ auth sẵn sàng trước khi fetch
    if (authLoading) {
      return
    }
    
    if (!isAuthenticated) {
      console.warn('⚠️ Session not authenticated, redirecting to login')
      router.push('/login')
      return
    }
    
    // Don't refetch if useUsers hook will automatically fetch on mount
    // Only refetch if auth state changed from unauthenticated to authenticated
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated])

  useEffect(() => {
    // Only initialize from URL params once on mount
    if (isInitialLoadRef.current) return;
    
    const q = searchParams.get("q") || "";
    const s = (searchParams.get("sort") as any) || "id";
    const o = (searchParams.get("order") as any) || "asc";
    const p = parseInt(searchParams.get("page") || "1", 10);
    const sz = parseInt(searchParams.get("size") || "10", 10);
    
    // Use React.startTransition to batch all state updates together
    // This prevents multiple re-renders and multiple API calls
    React.startTransition(() => {
      setQuery(q);
      if (s === "id" || s === "name" || s === "email") setSortKey(s);
      if (o === "asc" || o === "desc") setSortOrder(o);
      if (!Number.isNaN(p) && p > 0) setPage(p);
      if (!Number.isNaN(sz) && [10,20,50].includes(sz)) setSize(sz as 10|20|50);
    });
    
    isInitialLoadRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("sort", sortKey);
    params.set("order", sortOrder);
    params.set("page", String(page));
    params.set("size", String(size));
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [query, sortKey, sortOrder, page, size, router]);

  const filtered = useMemo(() => {
    const ordered = [...rows].sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      if (sortKey === "name") return (a.fullName || '').localeCompare(b.fullName || '') * dir;
      return a.email.localeCompare(b.email) * dir;
    });
    return ordered;
  }, [rows, sortKey, sortOrder]);
  
  // Memoize paginated data to prevent recalculation
  const paginatedData = useMemo(() => {
    return filtered.slice((page - 1) * size, page * size);
  }, [filtered, page, size]);

  const updateFullName = (first?: string, last?: string) => {
    const f = first ?? editForm.first_name ?? ''
    const l = last ?? editForm.last_name ?? ''
    const merged = `${l} ${f}`.trim()
    setEditForm((prev) => ({ ...prev, full_name: merged }))
  }

  const handleAvatarFile = (file?: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      if (url) {
        setEditForm((f) => ({ ...f, avatar_url: url }))
      }
    }
    reader.readAsDataURL(file)
  }

  // Load communes once when modal opens (giống profile page)
  useEffect(() => {
    if (!editOpen) return;
    if (allCommunes.length > 0) return;
    
    const loadCommunes = async () => {
      setAddrLoading(true);
      setAddrError(null);
      try {
        const res = await fetch(ADDRESS_API, { cache: 'no-store' });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `API trả về lỗi: ${res.status} ${res.statusText}`);
        }
        
        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error('Không thể parse dữ liệu từ API');
        }
        
        const list = Array.isArray(data?.communes) ? data.communes : [];
        const mapped: Ward[] = list.map((c: any) => ({
          code: String(c.code),
          name: c.name,
          provinceCode: String(c.provinceCode),
        }));
        setAllCommunes(mapped);
        
        // Build provinces list from communes
        const provinceMap = new Map<string, Province>();
        mapped.forEach((c) => {
          if (!provinceMap.has(c.provinceCode)) {
            const pName = list.find((x: any) => String(x.provinceCode) === c.provinceCode)?.provinceName || c.provinceCode;
            provinceMap.set(c.provinceCode, { code: c.provinceCode, name: pName });
          }
        });
        setProvinces(Array.from(provinceMap.values()));
      } catch (error) {
        console.error('Lỗi khi load communes:', error);
        const errorMessage = error instanceof Error ? error.message : 'Không thể tải danh sách địa chỉ';
        setAddrError(errorMessage);
        setAllCommunes([]);
        setProvinces([]);
      } finally {
        setAddrLoading(false);
      }
    };
    
    loadCommunes();
  }, [editOpen, allCommunes.length]);

  // Filter wards when province changes
  useEffect(() => {
    if (!selectedProvince) {
      setWards([]);
      setSelectedWard("");
      return;
    }
    const filtered = allCommunes.filter((c) => c.provinceCode === selectedProvince);
    setWards(filtered);
    setSelectedWard("");
  }, [selectedProvince, allCommunes]);

  async function deactivate(id?: string | number) {
    if (!id) {
      setMessage('ID người dùng không hợp lệ.');
      return;
    }
    try {
      setActionLoadingId(id);
      const res = await apiClient.put(`/users/${id}/deactivate`);
      if (!res.success) {
        throw new Error(res.error || 'Lỗi khi vô hiệu hóa người dùng.');
      }
      setMessage('Đã vô hiệu hóa người dùng.');
      await refetchUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Lỗi khi vô hiệu hóa người dùng.');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function activate(id?: string | number) {
    if (!id) {
      setMessage('ID người dùng không hợp lệ.');
      return;
    }
    try {
      setActionLoadingId(id);
      const res = await apiClient.put(`/users/${id}/activate`);
      if (!res.success) {
        throw new Error(res.error || 'Lỗi khi kích hoạt người dùng.');
      }
      setMessage('Đã kích hoạt người dùng.');
      await refetchUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Lỗi khi kích hoạt người dùng.');
    } finally {
      setActionLoadingId(null);
    }
  }

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <>
      <div className="px-6 pt-4 pb-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header & Filters */}
          <div className="shadow-sm border border-gray-200 rounded-2xl overflow-hidden" style={{ backgroundColor: '#dcebff' }}>
            <div className="border-b border-gray-200/50 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 leading-tight">Quản lý người dùng</h1>
                  <p className="text-sm text-gray-500">{filtered.length} người dùng</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <Button className="h-10 px-4 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm whitespace-nowrap" onClick={() => { setCreateForm({ full_name: "", email: "", phone_number: "" }); setCreateErrors({}); setCreateOpen(true); }}>
                    Tạo người dùng
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-10 px-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                    onClick={() => {
                      const csv = [['ID', 'Email', 'Họ tên', 'Số điện thoại', 'Trạng thái'], ...filtered.map(u => [u.id || '-', u.email, u.fullName, u.phoneNumber || '-', u.status || 'ACTIVE'])]
                      const blob = new Blob([csv.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `users_${new Date().toISOString().slice(0,10)}.xlsx`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                  >
                    Xuất excel
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
                    placeholder="Tìm theo họ tên..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && query.trim()) {
                        refetchUsers()
                      }
                    }}
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
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="ACTIVE">Đang hoạt động</option>
                      <option value="INACTIVE">Đã khóa</option>
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
                      placeholder="Tìm theo họ tên..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && query.trim()) {
                          refetchUsers()
                        }
                      }}
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
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="INACTIVE">Đã khóa</option>
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
          {message && (
            <div className={`rounded-xl border p-3 text-sm shadow-sm ${
              message.includes('Lỗi') || message.includes('không có quyền') 
                ? 'bg-red-50 border-red-200 text-red-700' 
                : message.includes('thành công')
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
              {message}
            </div>
          )}
          
          {isLoading && (
            <div className="rounded-xl border p-4 text-center bg-gray-50 border-gray-200 shadow-sm">
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
                <span className="text-sm text-gray-600">Đang tải...</span>
              </div>
            </div>
          )}

          {!isLoading && (
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Danh sách người dùng</h2>
              <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">{filtered.length} người dùng</span>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <THead>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold">Người dùng</th>
                    <th className="px-4 py-3 text-left text-sm font-bold">Email</th>
                    <th className="px-4 py-3 text-center text-sm font-bold">Điện thoại</th>
                    <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái</th>
                    <th className="px-4 py-3 text-center text-sm font-bold">Thao tác</th>
                  </tr>
                </THead>
                <TBody>
                  {paginatedData.map((u, idx) => (
                    <tr key={u.email || `user-${idx}`} className={`transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-[#f2f8fe]`}>
                      <td className="px-4 py-3 text-left text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold">
                            {u.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={u.avatarUrl} alt={u.fullName || u.email} className="h-full w-full object-cover" />
                            ) : (
                              (u.fullName || u.email || '?').charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="truncate font-semibold">{u.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-left text-sm font-mono truncate max-w-[320px]" title={u.email}>
                        {u.email}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">{u.phoneNumber || "—"}</td>
                      <td className="px-4 py-3 text-center text-sm">
                        {u.status === "ACTIVE" || !u.status ? <Badge tone="success">ACTIVE</Badge> : <Badge tone="muted">INACTIVE</Badge>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <Button variant="secondary" className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]" onClick={() => { setSelected(u); setDetailOpen(true); }}>Xem</Button>
                          <Button
                            className="h-8 px-3 text-xs"
                            onClick={() => {
                              setEditForm({
                                id: u.id?.toString() || "",
                                full_name: u.fullName,
                                email: u.email,
                                phone_number: u.phoneNumber,
                                first_name: u.firstName,
                                last_name: u.lastName,
                                date_of_birth: u.dateOfBirth,
                                gender: u.gender,
                                address: u.address,
                                city: u.city,
                                state: u.state,
                                postal_code: u.postalCode,
                                country: u.country || 'Việt Nam',
                                avatar_url: u.avatarUrl,
                                bio: u.bio,
                                preferred_language: u.preferredLanguage || 'vi',
                                timezone: u.timezone || 'GMT+7',
                                emergency_contact_name: u.emergencyContactName,
                                emergency_contact_phone: u.emergencyContactPhone,
                                emergency_contact_relationship: u.emergencyContactRelationship,
                                id_card_number: u.idCardNumber,
                                id_card_issue_date: u.idCardIssueDate,
                                id_card_issue_place: u.idCardIssuePlace,
                              });
                              updateFullName(u.firstName, u.lastName);
                              const savedProvince = provinces.find((p) => p.name === u.city);
                              setSelectedProvince(savedProvince?.code || "");
                              setProvinceSearch(u.city || "");
                              if (savedProvince) {
                                const filteredWards = allCommunes.filter((c) => c.provinceCode === savedProvince.code);
                                const savedWard = filteredWards.find((w) => w.name === u.state);
                                setSelectedWard(savedWard?.code || "");
                                setWardSearch(u.state || "");
                              } else {
                                setSelectedWard("");
                                setWardSearch(u.state || "");
                              }
                              setEditOpen(true);
                            }}
                          >
                            Sửa
                          </Button>
                          <Button variant="danger" className="h-8 px-3 text-xs" onClick={() => setConfirmOpen({ open: true, type: 'delete', user: u })}>Xóa</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            </div>

            {/* Mobile list */}
            <div className="lg:hidden p-3 space-y-3">
              {paginatedData.map((u, idx) => (
                <div key={u.email || `user-mobile-${idx}`} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-blue-100 flex items-center justify-center shadow-sm">
                          {u.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatarUrl} alt={u.fullName || u.email} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-blue-700 font-semibold text-sm">
                              {(u.fullName || u.email || '?').charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900 truncate">{u.fullName}</div>
                          <div className="text-xs text-gray-600 truncate">{u.email}</div>
                          {u.preferredLanguage && (
                            <div className="text-[11px] text-gray-500">Ngôn ngữ: {u.preferredLanguage}</div>
                          )}
                        </div>
                      </div>
                      <div>{u.status === 'ACTIVE' || !u.status ? <Badge tone="success">ACTIVE</Badge> : <Badge tone="muted">INACTIVE</Badge>}</div>
                    </div>
                  </div>

                  <div className="p-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Điện thoại</span>
                      <span className="font-medium">{u.phoneNumber || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Trạng thái</span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {u.status === 'ACTIVE' || !u.status ? <Badge tone="success">ACTIVE</Badge> : <Badge tone="muted">INACTIVE</Badge>}
                      </div>
                    </div>
                  </div>

                  <div className="px-3 py-3 bg-gray-50 border-t border-gray-100">
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="secondary"
                        className="h-10 text-xs font-medium px-2 bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                        onClick={() => {
                          setSelected(u);
                          setDetailOpen(true);
                        }}
                      >
                        Xem
                      </Button>
                      <Button
                        className="h-10 text-xs font-medium px-2"
                        onClick={() => {
                          setEditForm({
                            id: u.id?.toString() || "",
                            full_name: u.fullName,
                            email: u.email,
                            phone_number: u.phoneNumber,
                            first_name: u.firstName,
                            last_name: u.lastName,
                            date_of_birth: u.dateOfBirth,
                            gender: u.gender,
                            address: u.address,
                            city: u.city,
                            state: u.state,
                            postal_code: u.postalCode,
                            country: u.country || 'Việt Nam',
                            avatar_url: u.avatarUrl,
                            bio: u.bio,
                            preferred_language: u.preferredLanguage || 'vi',
                            timezone: u.timezone || 'GMT+7',
                            emergency_contact_name: u.emergencyContactName,
                            emergency_contact_phone: u.emergencyContactPhone,
                            emergency_contact_relationship: u.emergencyContactRelationship,
                            id_card_number: u.idCardNumber,
                            id_card_issue_date: u.idCardIssueDate,
                            id_card_issue_place: u.idCardIssuePlace,
                          });
                          updateFullName(u.firstName, u.lastName);
                          const savedProvince = provinces.find((p) => p.name === u.city);
                          setSelectedProvince(savedProvince?.code || "");
                          setProvinceSearch(u.city || "");
                          if (savedProvince) {
                            const filteredWards = allCommunes.filter((c) => c.provinceCode === savedProvince.code);
                            const savedWard = filteredWards.find((w) => w.name === u.state);
                            setSelectedWard(savedWard?.code || "");
                            setWardSearch(u.state || "");
                          } else {
                            setSelectedWard("");
                            setWardSearch(u.state || "");
                          }
                          setEditOpen(true);
                        }}
                      >
                        Sửa
                      </Button>
                      <Button
                        variant="danger"
                        className="h-10 text-xs font-medium px-2"
                        onClick={() =>
                          setConfirmOpen({ open: true, type: "delete", user: u })
                        }
                      >
                        Xóa
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-3 py-4 border-t border-gray-200/50">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Hàng / trang:</span>
                  <select
                    className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm"
                    value={size}
                    onChange={(e) => { setPage(1); setSize(parseInt(e.target.value, 10)); }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span className="text-sm text-gray-500">trên {filtered.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" className="h-9 px-3 text-sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trước</Button>
                  <span className="px-2 text-sm font-semibold text-gray-700">Trang {page} / {Math.max(1, Math.ceil(filtered.length / size))}</span>
                  <Button variant="secondary" className="h-9 px-3 text-sm" disabled={page >= Math.ceil(filtered.length / size)} onClick={() => setPage((p) => Math.min(Math.ceil(filtered.length / size), p + 1))}>Sau</Button>
                </div>
              </div>
            </div>
          </CardBody>
          </Card>
          )}
        </div>
      </div>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết người dùng" size="xl">
        {selected ? (
          <div className="space-y-4 p-1">
            {/* Header giống bookings */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-blue-100 flex items-center justify-center shadow-lg flex-shrink-0">
                  {selected.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.avatarUrl} alt={selected.fullName || selected.email} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-blue-700 font-semibold text-lg">
                      {(selected.fullName || selected.email || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{selected.fullName}</h3>
                    {selected.status === 'ACTIVE' || !selected.status ? (
                      <Badge tone="success">ACTIVE</Badge>
                    ) : (
                      <Badge tone="muted">INACTIVE</Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 truncate">{selected.email}</div>
                </div>
              </div>
            </div>

            {/* Thông tin chi tiết */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">ID</div>
                <div className="font-medium text-gray-900 break-words">{selected.id || '—'}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Email</div>
                <div className="font-medium text-gray-900 break-words">{selected.email}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Điện thoại</div>
                <div className="font-medium text-gray-900 break-words">{selected.phoneNumber || '—'}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Trạng thái</div>
                <div className="mt-1">
                  {selected.status === 'ACTIVE' || !selected.status ? (
                    <Badge tone="success">ACTIVE</Badge>
                  ) : (
                    <Badge tone="muted">INACTIVE</Badge>
                  )}
                </div>
              </div>
              {selected.userProfileId && (
                <div className="rounded-lg border border-gray-200 p-3 bg-white">
                  <div className="text-gray-500">User Profile ID</div>
                  <div className="font-medium text-gray-900 break-words">{selected.userProfileId}</div>
                </div>
              )}
            </div>

            {/* Thông tin liên hệ & địa chỉ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {selected.address && (
                <div className="rounded-lg border border-gray-200 p-3 bg-white">
                  <div className="text-gray-500">Địa chỉ</div>
                  <div className="font-medium text-gray-900 break-words">{selected.address}</div>
                </div>
              )}
              {(selected.city || selected.state || selected.postalCode || selected.country) && (
                <div className="rounded-lg border border-gray-200 p-3 bg-white">
                  <div className="text-gray-500">Khu vực</div>
                  <div className="font-medium text-gray-900 break-words">
                    {[selected.city, selected.state, selected.postalCode, selected.country].filter(Boolean).join(', ') || '—'}
                  </div>
                </div>
              )}
            </div>

            {/* Thông tin bổ sung */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {selected.dateOfBirth && (
                <div className="rounded-lg border border-gray-200 p-3 bg-white">
                  <div className="text-gray-500">Ngày sinh</div>
                  <div className="font-medium text-gray-900">{selected.dateOfBirth}</div>
                </div>
              )}
              {selected.gender && (
                <div className="rounded-lg border border-gray-200 p-3 bg-white">
                  <div className="text-gray-500">Giới tính</div>
                  <div className="font-medium text-gray-900">{selected.gender}</div>
                </div>
              )}
              {(selected.preferredLanguage || selected.timezone) && (
                <div className="rounded-lg border border-gray-200 p-3 bg-white sm:col-span-2">
                  <div className="text-gray-500 mb-1">Ngôn ngữ & Múi giờ</div>
                  <div className="font-medium text-gray-900">
                    {selected.preferredLanguage || '—'} {selected.timezone ? `• ${selected.timezone}` : ''}
                  </div>
                </div>
              )}
            </div>

            {/* CCCD/ID card */}
            {(selected.idCardNumber || selected.idCardIssueDate || selected.idCardIssuePlace) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                {selected.idCardNumber && (
                  <div className="rounded-lg border border-gray-200 p-3 bg-white">
                    <div className="text-gray-500">Số CCCD/ID</div>
                    <div className="font-medium text-gray-900 break-words">{selected.idCardNumber}</div>
                  </div>
                )}
                {selected.idCardIssueDate && (
                  <div className="rounded-lg border border-gray-200 p-3 bg-white">
                    <div className="text-gray-500">Ngày cấp</div>
                    <div className="font-medium text-gray-900">{selected.idCardIssueDate}</div>
                  </div>
                )}
                {selected.idCardIssuePlace && (
                  <div className="rounded-lg border border-gray-200 p-3 bg-white">
                    <div className="text-gray-500">Nơi cấp</div>
                    <div className="font-medium text-gray-900 break-words">{selected.idCardIssuePlace}</div>
                  </div>
                )}
              </div>
            )}

            {/* Bio */}
            {selected.bio && (
              <div className="rounded-lg border border-gray-200 p-3 bg-white text-sm">
                <div className="text-gray-500 mb-1">Giới thiệu</div>
                <div className="font-medium text-gray-900 whitespace-pre-wrap break-words">{selected.bio}</div>
              </div>
            )}

            {/* Liên hệ khẩn cấp */}
            {(selected.emergencyContactName || selected.emergencyContactPhone || selected.emergencyContactRelationship) && (
              <div className="rounded-lg border border-gray-200 p-3 bg-white text-sm">
                <div className="text-gray-500 mb-1">Liên hệ khẩn cấp</div>
                <div className="text-gray-900 break-words">
                  {(selected.emergencyContactName || '—')}
                  {selected.emergencyContactPhone ? ` • ${selected.emergencyContactPhone}` : ''}
                  {selected.emergencyContactRelationship ? ` • ${selected.emergencyContactRelationship}` : ''}
                </div>
              </div>
            )}

            {/* Dấu thời gian */}
            {(selected.createdDate || selected.lastModifiedDate) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {selected.createdDate && (
                  <div className="rounded-lg border border-gray-200 p-3 bg-white">
                    <div className="text-gray-500">Ngày tạo</div>
                    <div className="font-medium text-gray-900">{new Date(selected.createdDate).toLocaleString('vi-VN')}</div>
                  </div>
                )}
                {selected.lastModifiedDate && (
                  <div className="rounded-lg border border-gray-200 p-3 bg-white">
                    <div className="text-gray-500">Cập nhật</div>
                    <div className="font-medium text-gray-900">{new Date(selected.lastModifiedDate).toLocaleString('vi-VN')}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setFieldErrors({}); }}
        title="Sửa người dùng"
        size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setEditOpen(false); setFieldErrors({}); }}>Hủy</Button>
            <Button
              disabled={savingEdit}
              onClick={async () => {
                if (!validateEditForm()) {
                  setMessage('Vui lòng điền đầy đủ các trường bắt buộc.');
                  return;
                }
                if (!editForm.id) {
                  setMessage('Thiếu ID người dùng.');
                  return;
                }
                try {
                  setSavingEdit(true);
                  // Giới hạn avatarUrl - nếu base64 quá lớn (>500KB) thì bỏ qua
                  let avatarToSend = editForm.avatar_url || '';
                  if (avatarToSend.startsWith('data:') && avatarToSend.length > 500000) {
                    console.warn('[Admin Users] Avatar base64 quá lớn, bỏ qua để tránh lỗi backend');
                    avatarToSend = '';
                  }

                  const payload = {
                    id: editForm.id,
                    fullName: editForm.full_name,
                    phoneNumber: editForm.phone_number,
                    firstName: editForm.first_name,
                    lastName: editForm.last_name,
                    dateOfBirth: editForm.date_of_birth || null,
                    gender: editForm.gender,
                    address: editForm.address,
                    city: editForm.city,
                    state: editForm.state,
                    postalCode: editForm.postal_code,
                    country: editForm.country,
                    avatarUrl: avatarToSend,
                    bio: editForm.bio,
                    preferredLanguage: editForm.preferred_language,
                    timezone: editForm.timezone,
                    emergencyContactName: editForm.emergency_contact_name,
                    emergencyContactPhone: editForm.emergency_contact_phone,
                    emergencyContactRelationship: editForm.emergency_contact_relationship,
                    idCardNumber: editForm.id_card_number,
                    idCardIssueDate: editForm.id_card_issue_date || null,
                    idCardIssuePlace: editForm.id_card_issue_place,
                  };

                  const res = await apiClient.put(`/users/${editForm.id}`, payload);
                  if (!res.success) {
                    throw new Error(res.error || 'Lỗi khi cập nhật người dùng.');
                  }

                  setEditOpen(false);
                  setFieldErrors({});
                  setMessage('Đã cập nhật người dùng thành công.');
                  await refetchUsers();
                } catch (e) {
                  console.error('[Admin Users] Update error:', e);
                  setMessage(e instanceof Error ? e.message : 'Lỗi khi cập nhật người dùng.');
                } finally {
                  setSavingEdit(false);
                }
              }}
            >
              {savingEdit ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Header giống bookings */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm overflow-hidden">
                {editForm.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editForm.avatar_url} alt={editForm.full_name || editForm.email} className="h-full w-full object-cover" />
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A4 4 0 018 17h8a4 4 0 012.879 1.196M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{editForm.full_name || '—'}</h3>
                <div className="text-sm text-gray-600 truncate">{editForm.email || '—'}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Họ</label>
              <Input value={editForm.last_name || ''} onChange={(e) => { const v = e.target.value; setEditForm((f) => ({ ...f, last_name: v })); updateFullName(editForm.first_name, v) }} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tên</label>
              <Input value={editForm.first_name || ''} onChange={(e) => { const v = e.target.value; setEditForm((f) => ({ ...f, first_name: v })); updateFullName(v, editForm.last_name) }} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Họ tên <span className="text-red-500">*</span></label>
            <Input 
              className={fieldErrors.full_name ? 'border-red-300' : ''} 
              value={editForm.full_name} 
              readOnly 
            />
            {fieldErrors.full_name && <p className="mt-1 text-xs text-red-600">{fieldErrors.full_name}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email <span className="text-red-500">*</span></label>
            <Input 
              className={fieldErrors.email ? 'border-red-300' : ''} 
              value={editForm.email} 
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} 
            />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Điện thoại <span className="text-red-500">*</span></label>
            <Input 
              className={fieldErrors.phone_number ? 'border-red-300' : ''} 
              value={editForm.phone_number || ''} 
              maxLength={10}
              onChange={(e) => setEditForm((f) => ({ ...f, phone_number: e.target.value }))} 
            />
            {fieldErrors.phone_number && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone_number}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Ngày sinh <span className="text-red-500">*</span></label>
              <Input 
                type="date" 
                className={fieldErrors.date_of_birth ? 'border-red-300' : ''} 
                value={editForm.date_of_birth || ''} 
                lang="vi"
                onChange={(e) => setEditForm((f) => ({ ...f, date_of_birth: e.target.value }))} 
              />
              {fieldErrors.date_of_birth && <p className="mt-1 text-xs text-red-600">{fieldErrors.date_of_birth}</p>}
            </div>
            <div className="relative">
              <label className="mb-1 block text-sm font-medium">Giới tính <span className="text-red-500">*</span></label>
              <input
                type="text"
                className={`block w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.gender ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="Gõ để tìm kiếm..."
                value={editForm.gender || ''}
                onChange={(e) => {
                  setEditForm((f) => ({ ...f, gender: e.target.value }));
                  setShowGenderDropdown(true);
                }}
                onFocus={() => setShowGenderDropdown(true)}
                onBlur={() => setTimeout(() => setShowGenderDropdown(false), 200)}
              />
              {showGenderDropdown && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-gray-300 bg-white shadow-lg">
                  {genderOptions
                    .filter((g) => g.label.toLowerCase().includes((editForm.gender || '').toLowerCase()))
                    .map((g) => (
                      <div
                        key={g.value}
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${editForm.gender === g.value ? 'bg-blue-100 font-medium' : ''}`}
                        onMouseDown={() => {
                          setEditForm((f) => ({ ...f, gender: g.value }));
                          setShowGenderDropdown(false);
                        }}
                      >
                        {g.label}
                      </div>
                    ))}
                  {genderOptions.filter((g) => g.label.toLowerCase().includes((editForm.gender || '').toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">Không tìm thấy</div>
                  )}
                </div>
              )}
              {fieldErrors.gender && <p className="mt-1 text-xs text-red-600">{fieldErrors.gender}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <label className="mb-1 block text-sm font-medium">Tỉnh/Thành phố <span className="text-red-500">*</span></label>
              <input
                type="text"
                className={`block w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.city ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="Gõ để tìm kiếm..."
                value={provinceSearch}
                onChange={(e) => {
                  setProvinceSearch(e.target.value);
                  setShowProvinceDropdown(true);
                }}
                onFocus={() => setShowProvinceDropdown(true)}
                onBlur={() => setTimeout(() => setShowProvinceDropdown(false), 200)}
              />
              {showProvinceDropdown && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-gray-300 bg-white shadow-lg">
                  {provinces
                    .filter((p) => p.name.toLowerCase().includes(provinceSearch.toLowerCase()))
                    .map((p) => (
                      <div
                        key={p.code}
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${selectedProvince === p.code ? 'bg-blue-100 font-medium' : ''}`}
                        onMouseDown={() => {
                          setSelectedProvince(p.code);
                          setProvinceSearch(p.name);
                          setShowProvinceDropdown(false);
                          setEditForm((f) => ({ ...f, city: p.name, state: '', address: '' }));
                          // Reset ward
                          setSelectedWard('');
                          setWardSearch('');
                        }}
                      >
                        {p.name}
                      </div>
                    ))}
                  {provinces.filter((p) => p.name.toLowerCase().includes(provinceSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">Không tìm thấy</div>
                  )}
                </div>
              )}
              {addrLoading && <div className="mt-1 text-xs text-gray-500">Đang tải danh sách...</div>}
              {addrError && <div className="mt-1 text-xs text-red-600">{addrError}</div>}
              {fieldErrors.city && <p className="mt-1 text-xs text-red-600">{fieldErrors.city}</p>}
            </div>
            <div className="relative">
              <label className="mb-1 block text-sm font-medium">Khu vực (Phường/Xã) <span className="text-red-500">*</span></label>
              <input
                type="text"
                className={`block w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.state ? 'border-red-300' : 'border-gray-300'} ${!selectedProvince ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                placeholder={selectedProvince ? "Gõ để tìm kiếm..." : "Chọn Tỉnh/TP trước"}
                value={wardSearch}
                disabled={!selectedProvince}
                onChange={(e) => {
                  setWardSearch(e.target.value);
                  setShowWardDropdown(true);
                }}
                onFocus={() => selectedProvince && setShowWardDropdown(true)}
                onBlur={() => setTimeout(() => setShowWardDropdown(false), 200)}
              />
              {showWardDropdown && selectedProvince && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-gray-300 bg-white shadow-lg">
                  {wards
                    .filter((w) => w.name.toLowerCase().includes(wardSearch.toLowerCase()))
                    .map((w) => (
                      <div
                        key={w.code}
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${selectedWard === w.code ? 'bg-blue-100 font-medium' : ''}`}
                        onMouseDown={() => {
                          setSelectedWard(w.code);
                          setWardSearch(w.name);
                          setShowWardDropdown(false);
                          const provinceName = provinces.find((p) => p.code === selectedProvince)?.name || '';
                          const composedAddress = [w.name, provinceName, editForm.country || 'Việt Nam'].filter(Boolean).join(', ');
                          setEditForm((f) => ({ ...f, state: w.name, address: composedAddress }));
                        }}
                      >
                        {w.name}
                      </div>
                    ))}
                  {wards.filter((w) => w.name.toLowerCase().includes(wardSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">Không tìm thấy</div>
                  )}
                </div>
              )}
              {fieldErrors.state && <p className="mt-1 text-xs text-red-600">{fieldErrors.state}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Quốc gia</label>
              <Input value={editForm.country || 'Việt Nam'} onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Avatar</label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                  {editForm.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editForm.avatar_url} alt="avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A4 4 0 018 17h8a4 4 0 012.879 1.196M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Chọn file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarFile(e.target.files?.[0] || null)}
                />
              </div>
              <Input
                placeholder="Hoặc dán URL ảnh"
                value={editForm.avatar_url || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, avatar_url: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ngôn ngữ ưa thích</label>
              <Input value={editForm.preferred_language || ''} onChange={(e) => setEditForm((f) => ({ ...f, preferred_language: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Múi giờ</label>
              <Input value={editForm.timezone || ''} onChange={(e) => setEditForm((f) => ({ ...f, timezone: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Bio</label>
              <textarea
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
                rows={1}
                value={editForm.bio || ''}
                onChange={(e) => {
                  const target = e.target;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                  setEditForm((f) => ({ ...f, bio: target.value }));
                }}
                onFocus={(e) => {
                  const target = e.target;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">CCCD/ID</label>
              <Input 
                className={fieldErrors.id_card_number ? 'border-red-300' : ''} 
                value={editForm.id_card_number || ''} 
                maxLength={12}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setEditForm((f) => ({ ...f, id_card_number: value }));
                }} 
              />
              {fieldErrors.id_card_number && <p className="mt-1 text-xs text-red-600">{fieldErrors.id_card_number}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ngày cấp</label>
              <Input 
                type="date" 
                className={fieldErrors.id_card_issue_date ? 'border-red-300' : ''} 
                value={editForm.id_card_issue_date || ''} 
                onChange={(e) => setEditForm((f) => ({ ...f, id_card_issue_date: e.target.value }))} 
              />
              {fieldErrors.id_card_issue_date && <p className="mt-1 text-xs text-red-600">{fieldErrors.id_card_issue_date}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nơi cấp</label>
              <Input 
                className={fieldErrors.id_card_issue_place ? 'border-red-300' : ''} 
                value={editForm.id_card_issue_place || ''} 
                onChange={(e) => setEditForm((f) => ({ ...f, id_card_issue_place: e.target.value }))} 
              />
              {fieldErrors.id_card_issue_place && <p className="mt-1 text-xs text-red-600">{fieldErrors.id_card_issue_place}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">LH khẩn cấp - Tên</label>
              <Input 
                className={fieldErrors.emergency_contact_name ? 'border-red-300' : ''} 
                value={editForm.emergency_contact_name || ''} 
                onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact_name: e.target.value }))} 
              />
              {fieldErrors.emergency_contact_name && <p className="mt-1 text-xs text-red-600">{fieldErrors.emergency_contact_name}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">LH khẩn cấp - SĐT</label>
              <Input 
                className={fieldErrors.emergency_contact_phone ? 'border-red-300' : ''} 
                value={editForm.emergency_contact_phone || ''} 
                maxLength={10}
                onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))} 
              />
              {fieldErrors.emergency_contact_phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.emergency_contact_phone}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">LH khẩn cấp - Quan hệ</label>
              <Input value={editForm.emergency_contact_relationship || ''} onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact_relationship: e.target.value }))} />
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal tạo người dùng */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setCreateErrors({}); }}
        title="Tạo người dùng"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button
              disabled={creatingUser}
              onClick={async () => {
                if (!validateCreateForm()) {
                  setMessage('Vui lòng kiểm tra thông tin tạo mới.');
                  return;
                }
                try {
                  setCreatingUser(true);
                  const password = `sorms_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                  const payload = {
                    email: createForm.email.trim(),
                    password,
                    fullName: createForm.full_name.trim(),
                    phoneNumber: createForm.phone_number?.trim() || '',
                  };
                  const resp = await apiClient.post('/users', payload);
                  if (!resp.success) {
                    throw new Error(resp.error || 'Tạo người dùng thất bại');
                  }
                  setCreateOpen(false);
                  setCreateForm({ full_name: "", email: "", phone_number: "" });
                  setCreateErrors({});
                  setMessage('Đã tạo người dùng mới.');
                  await refetchUsers();
                } catch (e) {
                  setMessage(e instanceof Error ? e.message : 'Lỗi khi tạo người dùng mới.');
                } finally {
                  setCreatingUser(false);
                }
              }}
            >
              {creatingUser ? 'Đang tạo...' : 'Tạo'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div> 
            <label className="mb-1 block text-sm font-medium">Họ tên</label>
            <Input value={createForm.full_name} onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))} />
            {createErrors.full_name && <p className="mt-1 text-xs text-red-600">{createErrors.full_name}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <Input value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
            {createErrors.email && <p className="mt-1 text-xs text-red-600">{createErrors.email}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Điện thoại</label>
            <Input value={createForm.phone_number || ''} onChange={(e) => setCreateForm((f) => ({ ...f, phone_number: e.target.value }))} />
            {createErrors.phone_number && <p className="mt-1 text-xs text-red-600">{createErrors.phone_number}</p>}
          </div>
        </div>
      </Modal>

      {/* Modal xác nhận xóa */}
      <Modal
        open={confirmOpen.open}
        onClose={() => setConfirmOpen({ open: false, type: 'delete' })}
        title={'Xác nhận xóa'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen({ open: false, type: 'delete' })}>Hủy</Button>
            <Button disabled={actionLoadingId === confirmOpen.user?.id} onClick={async () => {
              if (!confirmOpen.user) return;
              try {
                setActionLoadingId(confirmOpen.user.id || null);
                const resp = await apiClient.delete(`/users/${confirmOpen.user.id}`);
                if (!resp.success) {
                  throw new Error(resp.error || 'Xóa người dùng thất bại');
                }
                setMessage('Đã xóa người dùng.');
                setConfirmOpen({ open: false, type: 'delete' });
                await refetchUsers()
              } catch (e) {
                setMessage(e instanceof Error ? e.message : 'Lỗi khi xóa người dùng.')
              } finally {
                setActionLoadingId(null);
              }
            }}>{actionLoadingId === confirmOpen.user?.id ? 'Đang xóa...' : 'Xác nhận'}</Button>
          </div>
        }
      >
        <div className="text-sm text-gray-700">
          Bạn có chắc muốn xóa người dùng này? Hành động này không thể hoàn tác.
        </div>
      </Modal>
    </>
  );
}


export default function UsersPage() {
  return (
    <Suspense fallback={null}>
      <UsersInner />
    </Suspense>
  );
}