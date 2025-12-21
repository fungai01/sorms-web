"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/hooks/useAuth";
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  IdentificationIcon,
  MapPinIcon,
  Cog6ToothIcon,
  ClockIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

type Province = { code: string; name: string };
type Ward = { code: string; name: string; provinceCode: string };

// Avatar optimization settings
const MAX_AVATAR_BYTES = Math.floor(1.5 * 1024 * 1024); // 1.5MB
const MAX_AVATAR_W = 512;
const MAX_AVATAR_H = 512;

function dataURLByteSize(dataUrl: string): number {
  try {
    const head = 'base64,';
    const i = dataUrl.indexOf(head);
    if (i === -1) return dataUrl.length;
    const b64 = dataUrl.substring(i + head.length);
    return Math.ceil((b64.length * 3) / 4);
  } catch {
    return dataUrl.length;
  }
}

async function compressImageFile(file: File, opts: { maxW?: number; maxH?: number; quality?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = opts.maxW ?? MAX_AVATAR_W;
        const maxH = opts.maxH ?? MAX_AVATAR_H;
        const sw = img.naturalWidth || img.width;
        const sh = img.naturalHeight || img.height;
        const ratio = Math.min(1, maxW / sw, maxH / sh);
        const dw = Math.max(1, Math.round(sw * ratio));
        const dh = Math.max(1, Math.round(sh * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = dw; canvas.height = dh;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.clearRect(0, 0, dw, dh);
        ctx.drawImage(img, 0, 0, dw, dh);

        let quality = opts.quality ?? 0.9;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Reduce quality if still too big (up to 5 steps)
        for (let step = 0; step < 5 && dataURLByteSize(dataUrl) > MAX_AVATAR_BYTES; step++) {
          quality = Math.max(0.5, quality - 0.1);
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Không thể đọc ảnh'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsDataURL(file);
  });
}

// Types returned from backend example
export type UserProfile = {
  id: number | string;
  email: string;
  fullName?: string;
  phoneNumber?: string;
  status?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string; // yyyy-MM-dd
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
  userProfileId?: number | string;
  idCardNumber?: string;
  idCardIssueDate?: string; // yyyy-MM-dd
  idCardIssuePlace?: string;
  createdDate?: string; // ISO
  lastModifiedDate?: string; // ISO
};

function formatDateReadable(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value; // show raw if not valid
  return d.toLocaleDateString();
}

function toInputDate(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} />;
}

function SectionCard({
  title,
  icon: Icon,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="bg-white border border-gray-200 shadow-md rounded-xl hover:shadow-lg transition-shadow">
      <CardHeader className="border-b border-gray-200 py-4">
        <button
          type="button"
          onClick={() => collapsible && setOpen((o) => !o)}
          className={`bg-transparent text-gray-900 w-full flex items-center justify-between hover:bg-transparent hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] rounded-lg px-2 py-1 ${collapsible ? 'cursor-pointer' : ''}`}
        >
          <div className="flex items-center gap-3">
            {Icon ? <Icon className="h-5 w-5 text-[hsl(var(--primary))]" /> : null}
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          {collapsible && (
            <ChevronDownIcon className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
          )}
        </button>
      </CardHeader>
      {(!collapsible || open) && <CardBody className="py-5">{children}</CardBody>}
    </Card>
  );
}

function InfoRow({ label, value, loading, hideIfEmpty = true }: { label: string; value?: any; loading?: boolean; hideIfEmpty?: boolean }) {
  if (!loading && hideIfEmpty && (value === undefined || value === null || value === "")) {
    return null;
  }
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm text-gray-900 min-h-5">
        {loading ? <Skeleton className="h-4 w-40" /> : (value || <span className="text-gray-400">—</span>)}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [allCommunes, setAllCommunes] = useState<Ward[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string | "">("");
  const [selectedWard, setSelectedWard] = useState<string | "">("");
  const [addressDetail, setAddressDetail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadingCommunes, setLoadingCommunes] = useState(false);
  const [activeTab, setActiveTab] = useState<"emergency" | "identity" | null>(null);

  const displayName = useMemo(() => {
    if (!profile) return "";
    return (
      profile.fullName ||
      (profile.firstName || profile.lastName
        ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()
        : "") ||
      profile.email
    );
  }, [profile]);

  const backUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      const prev = sessionStorage.getItem("previousPage");
      if (prev && prev !== "/profile") return prev;
      const ref = document.referrer;
      if (ref) {
        try {
          const url = new URL(ref);
          const p = url.pathname;
          if (p.startsWith("/admin") || p.startsWith("/office") || p.startsWith("/staff") || p.startsWith("/user")) {
            return p;
          }
        } catch {}
      }
    }
    return "/";
  }, []);

  // Load communes once when modal opens, derive provinces list
  useEffect(() => {
    if (!editModalOpen) return;
    if (allCommunes.length > 0) return;
    
    const loadCommunes = async () => {
      setLoadingCommunes(true);
      try {
        // Sử dụng Next.js API route proxy để tránh CORS
        const res = await fetch('/api/address/communes', {
          cache: 'no-store',
        });
        
        // Kiểm tra response status
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `API trả về lỗi: ${res.status} ${res.statusText}`);
        }
        
        // Parse JSON với error handling
        let data;
        try {
          data = await res.json();
        } catch (parseError) {
          throw new Error('Không thể parse dữ liệu từ API (response không phải JSON hợp lệ)');
        }
        
        const list = Array.isArray(data?.communes) ? data.communes : [];
        const mapped: Ward[] = list.map((c: any) => ({
          code: String(c.code),
          name: c.name,
          provinceCode: String(c.provinceCode),
        }));
        setAllCommunes(mapped);
        const provinceMap = new Map<string, Province>();
        mapped.forEach((c) => {
          if (!provinceMap.has(c.provinceCode)) {
            const pName = list.find((x: any) => String(x.provinceCode) === c.provinceCode)?.provinceName || c.provinceCode;
            provinceMap.set(c.provinceCode, { code: c.provinceCode, name: pName });
          }
        });
        setProvinces(Array.from(provinceMap.values()));
      } catch (error) {
        // Log lỗi chi tiết để debug
        console.error('Lỗi khi load communes:', error);
        
        // Hiển thị thông báo lỗi cho user
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Không thể tải danh sách địa chỉ. Vui lòng thử lại sau.';
        
        setFlash({
          type: 'error',
          text: `Lỗi tải dữ liệu địa chỉ: ${errorMessage}`,
        });
        
        // Set empty arrays để UI không bị crash
        setAllCommunes([]);
        setProvinces([]);
      } finally {
        setLoadingCommunes(false);
      }
    };
    
    loadCommunes();
  }, [editModalOpen, allCommunes.length]);

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

  // Auto-fill address detail with ward + province + Việt Nam
  useEffect(() => {
    const provinceName = provinces.find((p) => p.code === selectedProvince)?.name;
    const wardName = wards.find((w) => w.code === selectedWard)?.name;
    const autoPart = [wardName, provinceName, "Việt Nam"].filter(Boolean).join(", ");
    if (autoPart) setAddressDetail(autoPart);
    else setAddressDetail("");
  }, [selectedProvince, selectedWard, provinces, wards]);

  // Load profile from API - only current user's data
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) {
      router.push("/login");
      return;
    }
    if (!user.email) return;
    
    const loadProfile = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("auth_access_token");
        if (!token) {
          console.error("[Profile] No auth token found");
          return;
        }

        // Fetch only current user's profile using self=1
        const res = await fetch("/api/system/users?self=1", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });

        if (!res.ok) {
          const errorText = await res.text().catch(() => "");
          console.error("[Profile] Failed to load profile:", res.status, errorText);
          setFlash({ type: "error", text: "Không thể tải thông tin hồ sơ. Vui lòng thử lại." });
          return;
        }

        const data = await res.json().catch(() => null);
        const items: any[] = Array.isArray(data?.items) ? data.items : Array.isArray(data?.data?.items) ? data.data.items : Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        const found = items.find((u) => (u.email || "").toLowerCase() === user.email!.toLowerCase());
        
        if (found) {
          const mapped: UserProfile = {
            id: found.id,
            email: found.email,
            fullName: found.fullName ?? found.full_name ?? user.name ?? user.email,
            phoneNumber: found.phoneNumber ?? found.phone_number,
            status: found.status,
            firstName: found.firstName ?? found.first_name,
            lastName: found.lastName ?? found.last_name,
            dateOfBirth: found.dateOfBirth ?? found.date_of_birth,
            gender: found.gender,
            address: found.address,
            city: found.city,
            state: found.state,
            postalCode: found.postalCode ?? found.postal_code,
            country: found.country,
            avatarUrl: found.avatarUrl ?? found.avatar_url ?? user.avatarUrl,
            bio: found.bio,
            preferredLanguage: found.preferredLanguage ?? found.preferred_language,
            timezone: found.timezone,
            emergencyContactName: found.emergencyContactName,
            emergencyContactPhone: found.emergencyContactPhone,
            emergencyContactRelationship: found.emergencyContactRelationship,
            userProfileId: found.userProfileId,
            idCardNumber: found.idCardNumber,
            idCardIssueDate: found.idCardIssueDate ?? found.id_card_issue_date,
            idCardIssuePlace: found.idCardIssuePlace ?? found.id_card_issue_place,
            createdDate: found.createdDate,
            lastModifiedDate: found.lastModifiedDate,
          };
          setProfile(mapped);
        } else {
          // Fallback to basic user info
          setProfile({
            id: user.id ?? 0,
            email: user.email,
            fullName: user.name ?? user.email,
            phoneNumber: (user as any).phoneNumber,
            avatarUrl: user.avatarUrl,
            status: "ACTIVE",
          });
        }
      } catch (error) {
        console.error("[Profile] Error loading profile:", error);
        setFlash({ type: "error", text: "Có lỗi xảy ra khi tải thông tin hồ sơ." });
        // Fallback to basic user info
        setProfile({
          id: user.id ?? 0,
          email: user.email,
          fullName: user.name ?? user.email,
          phoneNumber: (user as any).phoneNumber,
          avatarUrl: user.avatarUrl,
          status: "ACTIVE",
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [isAuthenticated, isLoading, router, user]);

  // Flash autohide
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  const [editForm, setEditForm] = useState<Required<
    Pick<
      UserProfile,
      | "email"
      | "fullName"
      | "phoneNumber"
      | "firstName"
      | "lastName"
      | "dateOfBirth"
      | "gender"
      | "address"
      | "city"
      | "state"
      | "postalCode"
      | "country"
      | "avatarUrl"
      | "bio"
      | "preferredLanguage"
      | "timezone"
      | "emergencyContactName"
      | "emergencyContactPhone"
      | "emergencyContactRelationship"
      | "idCardNumber"
      | "idCardIssueDate"
      | "idCardIssuePlace"
    > & { id: number | string }
  >>({
    id: 0,
    email: "",
    fullName: "",
    phoneNumber: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    avatarUrl: "",
    bio: "",
    preferredLanguage: "",
    timezone: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    idCardNumber: "",
    idCardIssueDate: "",
    idCardIssuePlace: "",
  });

  const openEdit = () => {
    if (!profile) return;
    setAddressDetail(profile.address || "");
    setSelectedProvince("");
    setSelectedWard("");
    setEditForm({
      id: profile.id,
      email: profile.email || "",
      fullName: displayName || profile.fullName || "",
      phoneNumber: profile.phoneNumber || "",
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      dateOfBirth: toInputDate(profile.dateOfBirth),
      gender: profile.gender || "",
      address: profile.address || "",
      city: profile.city || "",
      state: profile.state || "",
      postalCode: profile.postalCode || "",
      country: profile.country || "",
      avatarUrl: profile.avatarUrl || "",
      bio: profile.bio || "",
      preferredLanguage: profile.preferredLanguage || "",
      timezone: profile.timezone || "",
      emergencyContactName: profile.emergencyContactName || "",
      emergencyContactPhone: profile.emergencyContactPhone || "",
      emergencyContactRelationship: profile.emergencyContactRelationship || "",
      idCardNumber: profile.idCardNumber || "",
      idCardIssueDate: toInputDate(profile.idCardIssueDate),
      idCardIssuePlace: profile.idCardIssuePlace || "",
    });
    setEditModalOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!editForm.fullName.trim()) errors.fullName = "Họ và tên là bắt buộc";
    if (!editForm.email.trim()) errors.email = "Email là bắt buộc";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (editForm.email && !emailRegex.test(editForm.email)) errors.email = "Email không đúng định dạng";
    if (!editForm.phoneNumber.trim()) {
      errors.phoneNumber = "Số điện thoại là bắt buộc";
    } else if (!/^(0[3|5|7|8|9])+([0-9]{8})$/.test(editForm.phoneNumber)) {
      errors.phoneNumber = "Số điện thoại không hợp lệ";
    }

    if (!editForm.dateOfBirth) errors.dateOfBirth = "Ngày sinh là bắt buộc";
    if (!editForm.gender) errors.gender = "Giới tính là bắt buộc";

    if (!selectedProvince) errors.province = "Vui lòng chọn Tỉnh/Thành phố";
    if (!selectedWard) errors.ward = "Vui lòng chọn Phường/Xã";
    if (!addressDetail.trim()) errors.addressDetail = "Địa chỉ chi tiết là bắt buộc";

    if (editForm.emergencyContactName || editForm.emergencyContactPhone) {
      if (!editForm.emergencyContactName.trim()) errors.emergencyContactName = "Họ tên liên hệ khẩn cấp là bắt buộc";
      if (!editForm.emergencyContactPhone.trim()) {
        errors.emergencyContactPhone = "SĐT khẩn cấp là bắt buộc";
      } else if (!/^(0[3|5|7|8|9])+([0-9]{8})$/.test(editForm.emergencyContactPhone)) {
        errors.emergencyContactPhone = "SĐT khẩn cấp không hợp lệ";
      }
    }

    if (editForm.idCardNumber || editForm.idCardIssueDate || editForm.idCardIssuePlace) {
      if (!editForm.idCardNumber.trim()) {
        errors.idCardNumber = "Số CMND/CCCD là bắt buộc";
      } else if (!/^\d{1,12}$/.test(editForm.idCardNumber)) {
        errors.idCardNumber = "Số CMND/CCCD phải là số và tối đa 12 ký tự";
      }
      if (!editForm.idCardIssueDate) errors.idCardIssueDate = "Ngày cấp là bắt buộc";
      if (!editForm.idCardIssuePlace.trim()) errors.idCardIssuePlace = "Nơi cấp là bắt buộc";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length ? errors : null;
  };

  const isEmergencyContactRequired = useMemo(() => !!(editForm.emergencyContactName || editForm.emergencyContactPhone), [editForm.emergencyContactName, editForm.emergencyContactPhone]);
  const isIdCardRequired = useMemo(() => !!(editForm.idCardNumber || editForm.idCardIssueDate || editForm.idCardIssuePlace), [editForm.idCardNumber, editForm.idCardIssueDate, editForm.idCardIssuePlace]);

  const handleUpdate = async () => {
    const errs = validate();
    if (errs) {
      setFlash({ type: "error", text: "Vui lòng điền đầy đủ các trường bắt buộc." });
      return;
    }

    // Compose address parts from selections
    const provinceName = provinces.find((p) => p.code === selectedProvince)?.name;
    const wardName = wards.find((w) => w.code === String(selectedWard))?.name;
    const composedAddress = [wardName, addressDetail || editForm.address].filter(Boolean).join(", ");

    // Always use the authenticated user's own ID (profile > auth user > form)
    const safeIdRaw = profile?.id ?? profile?.userProfileId ?? (user as any)?.id ?? editForm.id;
    const safeId = safeIdRaw ? String(safeIdRaw) : '';
    if (!safeId) {
      setFlash({ type: "error", text: "Không tìm thấy ID người dùng để cập nhật." });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        id: safeId,
        fullName: editForm.fullName || "",
        email: editForm.email || "",
        phoneNumber: editForm.phoneNumber || "",
        firstName: editForm.firstName || "",
        lastName: editForm.lastName || "",
        dateOfBirth: editForm.dateOfBirth || "",
        gender: editForm.gender || "",
        address: composedAddress || editForm.address || "",
        city: wardName || editForm.city || "",
        state: provinceName || "Việt Nam",
        postalCode: editForm.postalCode || "",
        country: "Việt Nam",
        avatarUrl: editForm.avatarUrl || "",
        bio: editForm.bio || "",
        preferredLanguage: editForm.preferredLanguage || "",
        timezone: editForm.timezone || "",
        emergencyContactName: editForm.emergencyContactName || "",
        emergencyContactPhone: editForm.emergencyContactPhone || "",
        emergencyContactRelationship: editForm.emergencyContactRelationship || "",
        idCardNumber: editForm.idCardNumber || "",
        idCardIssueDate: editForm.idCardIssueDate || "",
        idCardIssuePlace: editForm.idCardIssuePlace || "",
      };

      console.log("[Profile] PUT /api/system/users payload:", payload);

      const res = await fetch("/api/system/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_access_token") || ""}`,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let data: any = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }

        const detail = data.error || data.message || text || "Cập nhật thất bại";
        const code = data.responseCode ? ` [code: ${data.responseCode}]` : "";
        const backend = data.backendStatus ? ` [backend: ${data.backendStatus}]` : "";
        setFlash({ type: "error", text: `${detail}${code}${backend}` });
        console.error("[Profile] Update failed:", { status: res.status, detail, responseCode: data.responseCode, backendStatus: data.backendStatus, raw: text });
        return;
      }

      // Parse response to get updated data
      const responseData = await res.json().catch(() => null);
      
      // Reflect to local state with composed address
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              email: responseData?.email ?? editForm.email,
              fullName: responseData?.fullName ?? editForm.fullName,
              phoneNumber: responseData?.phoneNumber ?? editForm.phoneNumber,
              firstName: responseData?.firstName ?? editForm.firstName,
              lastName: responseData?.lastName ?? editForm.lastName,
              dateOfBirth: responseData?.dateOfBirth ?? editForm.dateOfBirth,
              gender: responseData?.gender ?? editForm.gender,
              address: responseData?.address ?? composedAddress,
              city: responseData?.city ?? wardName ?? editForm.city,
              state: responseData?.state ?? provinceName ?? editForm.state,
              postalCode: responseData?.postalCode ?? editForm.postalCode,
              country: responseData?.country ?? "Việt Nam",
              avatarUrl: responseData?.avatarUrl ?? editForm.avatarUrl,
              bio: responseData?.bio ?? editForm.bio,
              preferredLanguage: responseData?.preferredLanguage ?? editForm.preferredLanguage,
              timezone: responseData?.timezone ?? editForm.timezone,
              emergencyContactName: responseData?.emergencyContactName ?? editForm.emergencyContactName,
              emergencyContactPhone: responseData?.emergencyContactPhone ?? editForm.emergencyContactPhone,
              emergencyContactRelationship: responseData?.emergencyContactRelationship ?? editForm.emergencyContactRelationship,
              idCardNumber: responseData?.idCardNumber ?? editForm.idCardNumber,
              idCardIssueDate: responseData?.idCardIssueDate ?? editForm.idCardIssueDate,
              idCardIssuePlace: responseData?.idCardIssuePlace ?? editForm.idCardIssuePlace,
            }
          : prev
      );
      
      setEditModalOpen(false);
      setFlash({ type: "success", text: "Cập nhật thông tin cá nhân thành công!" });
    } catch (e) {
      setFlash({ type: "error", text: "Có lỗi xảy ra khi cập nhật hồ sơ" });
      console.error("Profile update error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <button 
            onClick={() => router.push(backUrl)} 
            className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors flex items-center gap-1 mb-6"
          >
            ← Quay lại
          </button>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Hồ sơ cá nhân</h1>
          <p className="text-base text-gray-600">Quản lý thông tin tài khoản và liên hệ của bạn</p>
        </div>
      </div>

      {/* Flash Message */}
      {flash && !editModalOpen && (
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <div
            className={`rounded-lg border p-4 text-sm shadow-sm ${
              flash.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span>{flash.text}</span>
              <button
                onClick={() => setFlash(null)}
                className="ml-4 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Left Section - Profile Info */}
            <div className="lg:sticky lg:top-8 lg:self-start">
              <Card className="bg-white border border-gray-200 shadow-md rounded-xl h-full">
                <CardBody className="p-6 lg:p-8">
                  <div className="flex flex-col">
                    {/* Edit Button - Top Right */}
                    <div className="flex justify-end mb-4">
                      <button 
                        className="bg-[#3498db] hover:bg-[#2980b9] text-white rounded-md px-3 py-1.5 text-xs font-medium transition-all shadow-sm hover:shadow"
                        onClick={openEdit}
                        disabled={loading}
                      >
                        {loading ? "Đang xử lý..." : "Chỉnh sửa"}
                      </button>
                    </div>

                    {/* Avatar and Status - Center */}
                    <div className="flex flex-col items-center mb-4">
                      {/* Avatar - 120px */}
                      <div className="w-[120px] h-[120px] rounded-full overflow-hidden mb-3 border-4 border-gray-100 shadow-sm">
                        {profile?.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <UserIcon className="h-16 w-16 text-gray-400" />
                          </div>
                        )}
                      </div>
                      {/* Status */}
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full border-2 ${
                        (profile?.status || "ACTIVE").toUpperCase() === "ACTIVE"
                          ? "text-green-600 border-green-600 bg-green-50"
                          : (profile?.status || "").toUpperCase() === "INACTIVE"
                          ? "text-red-600 border-red-600 bg-red-50"
                          : "text-gray-600 border-gray-600 bg-gray-50"
                      }`}>
                        {profile?.status || "ACTIVE"}
                      </span>
                    </div>

                    {/* Email and Phone - Below */}
                    <div className="text-center space-y-2.5">
                      <div className="text-sm text-gray-900">
                        <span className="text-gray-500">Email:</span>{" "}
                        <span className="font-medium break-all break-words">
                          {loading ? <Skeleton className="h-4 w-full inline-block" /> : (profile?.email || "—")}
                        </span>
                      </div>
                      <div className="text-sm text-gray-900">
                        <span className="text-gray-500">SĐT:</span>{" "}
                        <span className="font-medium">
                          {loading ? <Skeleton className="h-4 w-32 mx-auto inline-block" /> : (profile?.phoneNumber || "—")}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Right Section - Basic Info & Address */}
            <div className="space-y-6">
              {/* Basic Information */}
              <Card className="bg-white border border-gray-200 shadow-md rounded-xl">
                <CardHeader className="border-b border-gray-200 py-3 px-6">
                  <h2 className="text-base font-semibold text-gray-900">Thông tin cơ bản</h2>
                </CardHeader>
                <CardBody className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-3">
                      <span className="text-xs text-gray-500 min-w-[80px]">Họ và tên:</span>
                      <span className="text-sm font-bold text-gray-900 flex-1">
                        {loading ? <Skeleton className="h-4 w-48" /> : (displayName || profile?.email || "—")}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-xs text-gray-500 min-w-[80px]">Ngày sinh:</span>
                      <span className="text-sm text-gray-900 flex-1">
                        {loading ? <Skeleton className="h-4 w-32" /> : (profile?.dateOfBirth ? formatDateReadable(profile.dateOfBirth) : "—")}
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Address */}
              <Card className="bg-white border border-gray-200 shadow-md rounded-xl">
                <CardHeader className="border-b border-gray-200 py-3 px-6">
                  <h2 className="text-base font-semibold text-gray-900">Địa chỉ</h2>
                </CardHeader>
                <CardBody className="p-6">
                  <div className="space-y-2.5">
                    {profile?.address ? (
                      <div className="text-sm text-gray-900 break-words">
                        {profile.address}
                        {profile.city && !profile.address.includes(profile.city) && `, ${profile.city}`}
                        {profile.state && !profile.address.includes(profile.state) && `, ${profile.state}`}
                        {profile?.country && !profile.address.includes(profile.country) && `, ${profile.country}`}
                        {!profile?.country && `, Việt Nam`}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {profile?.city && (
                          <div className="flex items-baseline gap-3">
                            <span className="text-xs text-gray-500 min-w-[100px]">Phường/Xã:</span>
                            <span className="text-sm text-gray-900 flex-1">{profile.city}</span>
                          </div>
                        )}
                        {profile?.state && (
                          <div className="flex items-baseline gap-3">
                            <span className="text-xs text-gray-500 min-w-[100px]">Tỉnh/Thành:</span>
                            <span className="text-sm text-gray-900 flex-1">{profile.state}</span>
                          </div>
                        )}
                        <div className="flex items-baseline gap-3">
                          <span className="text-xs text-gray-500 min-w-[100px]">Quốc gia:</span>
                          <span className="text-sm text-gray-900 flex-1">{profile?.country || "Việt Nam"}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>

              {/* Tabs */}
              <div className="bg-white border border-gray-200 shadow-md rounded-xl overflow-hidden">
                <div className="flex border-b border-gray-200 justify-center gap-2">
                  <button
                    onClick={() => setActiveTab(activeTab === "emergency" ? null : "emergency")}
                    className={`px-4 py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === "emergency"
                        ? "bg-[#3498db] text-white border-b-2 border-[#3498db]"
                        : "bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <PhoneIcon className="h-3.5 w-3.5" />
                    Liên hệ khẩn cấp
                  </button>
                  <button
                    onClick={() => setActiveTab(activeTab === "identity" ? null : "identity")}
                    className={`px-4 py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === "identity"
                        ? "bg-[#3498db] text-white border-b-2 border-[#3498db]"
                        : "bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <IdentificationIcon className="h-3.5 w-3.5" />
                    Giấy tờ tùy thân
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab && (
                  <div className="p-6 transition-opacity duration-200">
                    {activeTab === "emergency" && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                            <PhoneIcon className="h-5 w-5 text-[#3498db]" />
                            Liên hệ khẩn cấp
                          </h2>
                          <button
                            onClick={openEdit}
                            className="text-xs text-[#3498db] hover:text-[#2980b9] font-medium"
                          >
                            Chỉnh sửa
                          </button>
                        </div>
                        {profile?.emergencyContactName || profile?.emergencyContactPhone ? (
                          <div className="space-y-2.5">
                            <div className="flex items-baseline gap-3">
                              <span className="text-xs text-gray-500 min-w-[100px]">Họ tên:</span>
                              <span className="text-sm text-gray-900 flex-1">
                                {profile?.emergencyContactName || "—"}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-3">
                              <span className="text-xs text-gray-500 min-w-[100px]">Số điện thoại:</span>
                              <span className="text-sm text-gray-900 flex-1">
                                {profile?.emergencyContactPhone || "—"}
                              </span>
                            </div>
                            {profile?.emergencyContactRelationship && (
                              <div className="flex items-baseline gap-3">
                                <span className="text-xs text-gray-500 min-w-[100px]">Mối quan hệ:</span>
                                <span className="text-sm text-gray-900 flex-1">
                                  {profile.emergencyContactRelationship}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-sm text-gray-500">
                            Chưa có thông tin liên hệ khẩn cấp. Nhấn "Chỉnh sửa" để thêm.
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "identity" && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                            <IdentificationIcon className="h-5 w-5 text-[#3498db]" />
                            Giấy tờ tùy thân
                          </h2>
                          <button
                            onClick={openEdit}
                            className="text-xs text-[#3498db] hover:text-[#2980b9] font-medium"
                          >
                            Chỉnh sửa
                          </button>
                        </div>
                        {profile?.idCardNumber || profile?.idCardIssueDate || profile?.idCardIssuePlace ? (
                          <div className="space-y-2.5">
                            <div className="flex items-baseline gap-3">
                              <span className="text-xs text-gray-500 min-w-[100px]">Số CMND/CCCD:</span>
                              <span className="text-sm text-gray-900 flex-1">
                                {profile?.idCardNumber || "—"}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-3">
                              <span className="text-xs text-gray-500 min-w-[100px]">Ngày cấp:</span>
                              <span className="text-sm text-gray-900 flex-1">
                                {profile?.idCardIssueDate ? formatDateReadable(profile.idCardIssueDate) : "—"}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-3">
                              <span className="text-xs text-gray-500 min-w-[100px]">Nơi cấp:</span>
                              <span className="text-sm text-gray-900 flex-1">
                                {profile?.idCardIssuePlace || "—"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4 text-sm text-gray-500">
                            Chưa có thông tin giấy tờ tùy thân. Nhấn "Chỉnh sửa" để thêm.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Chỉnh sửa thông tin cá nhân"
        size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <button 
              className="bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-lg px-6 py-2.5 text-sm font-medium transition-all shadow-sm hover:shadow"
              onClick={() => setEditModalOpen(false)}
              disabled={loading}
            >
              Hủy
            </button>
            <button 
              className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white rounded-lg px-6 py-2.5 text-sm font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={handleUpdate}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Đang xử lý...
                </>
              ) : (
                "Cập nhật"
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {flash && (
            <div
              className={`rounded-md border p-3 text-sm shadow-sm ${
                flash.type === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {flash.text}
            </div>
          )}
          {/* Avatar & Basic */}
          <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
            <div className="text-base font-bold text-gray-900 flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-[hsl(var(--primary))]" />
              Thông tin cơ bản
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Họ và tên" required>
                <input
                  type="text"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors ${
                    fieldErrors.fullName ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  value={editForm.fullName}
                  onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                />
                {fieldErrors.fullName && <p className="mt-1 text-xs text-red-600">{fieldErrors.fullName}</p>}
              </Field>
              <Field label="Số điện thoại">
                <input
                  type="tel"
                  maxLength={10}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors ${
                    fieldErrors.phoneNumber ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                />
                {fieldErrors.phoneNumber && <p className="mt-1 text-xs text-red-600">{fieldErrors.phoneNumber}</p>}
              </Field>
            </div>
            <Field label="Ảnh đại diện">
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const dataUrl = await compressImageFile(file, { maxW: MAX_AVATAR_W, maxH: MAX_AVATAR_H, quality: 0.9 });
                      const bytes = dataURLByteSize(dataUrl);
                      if (bytes > MAX_AVATAR_BYTES) {
                        setFlash({ type: 'error', text: 'Ảnh sau khi nén vẫn vượt quá 1.5MB. Vui lòng chọn ảnh nhỏ hơn hoặc dùng URL.' });
                        return;
                      }
                      setEditForm((p) => ({ ...p, avatarUrl: dataUrl }));
                      setFlash({ type: 'success', text: 'Ảnh đã được nén và xem trước.' });
                    } catch (err) {
                      setFlash({ type: 'error', text: 'Không thể xử lý ảnh. Vui lòng thử ảnh khác.' });
                    }
                  }}
                  className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                />
                <input
                  type="text"
                  placeholder="Hoặc dán URL ảnh"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  value={editForm.avatarUrl}
                  onChange={(e) => setEditForm((p) => ({ ...p, avatarUrl: e.target.value }))}
                />
                {editForm.avatarUrl && (
                  <div className="pt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editForm.avatarUrl} alt="Preview" className="w-12 h-12 rounded-full object-cover border" />
                  </div>
                )}
              </div>
            </Field>
          </div>

          {/* Personal */}
          <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
            <div className="text-base font-bold text-gray-900 flex items-center gap-2">
              <IdentificationIcon className="h-5 w-5 text-[hsl(var(--primary))]" />
              Thông tin cá nhân
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Ngày sinh" required>
                <input
                  type="date"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors ${
                    fieldErrors.dateOfBirth ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  value={editForm.dateOfBirth}
                  onChange={(e) => setEditForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                />
                {fieldErrors.dateOfBirth && <p className="mt-1 text-xs text-red-600">{fieldErrors.dateOfBirth}</p>}
              </Field>
              <Field label="Giới tính" required>
                <select
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors ${
                    fieldErrors.gender ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  value={editForm.gender}
                  onChange={(e) => setEditForm((p) => ({ ...p, gender: e.target.value }))}
                >
                  <option value="">-- Chọn giới tính --</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
                {fieldErrors.gender && <p className="mt-1 text-xs text-red-600">{fieldErrors.gender}</p>}
              </Field>
            </div>
            <div>
              <Field label="Giới thiệu">
                <textarea
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors resize-y"
                  value={editForm.bio}
                  onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                  placeholder="Mô tả ngắn"
                />
              </Field>
            </div>
          </div>

          {/* Address */}
          <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
            <div className="text-base font-bold text-gray-900 flex items-center gap-2">
              <MapPinIcon className="h-5 w-5 text-[hsl(var(--primary))]" />
              Địa chỉ
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Tỉnh/Thành phố" required>
                <select
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors ${
                    fieldErrors.province ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  value={selectedProvince}
                  onChange={(e) => setSelectedProvince(e.target.value || "")}
                >
                  <option value="">-- Chọn Tỉnh/Thành phố --</option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
                {fieldErrors.province && <p className="mt-1 text-xs text-red-600">{fieldErrors.province}</p>}
              </Field>
              <Field label="Phường/Xã" required>
                <select
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed ${
                    fieldErrors.ward ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  value={selectedWard}
                  onChange={(e) => setSelectedWard(e.target.value || "")}
                  disabled={!selectedProvince}
                >
                  <option value="">-- Chọn Phường/Xã --</option>
                  {wards.map((w) => (
                    <option key={w.code} value={w.code}>{w.name}</option>
                  ))}
                </select>
                {fieldErrors.ward && <p className="mt-1 text-xs text-red-600">{fieldErrors.ward}</p>}
              </Field>
              <Field className="sm:col-span-2" label="Địa chỉ chi tiết" required>
                <textarea
                  rows={2}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors resize-y ${
                    fieldErrors.addressDetail ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  value={addressDetail}
                  onChange={(e) => setAddressDetail(e.target.value)}
                  placeholder="Nhập số nhà, đường..."
                />
                {fieldErrors.addressDetail && <p className="mt-1 text-xs text-red-600">{fieldErrors.addressDetail}</p>}
              </Field>
            </div>
          </div>

          {/* Emergency */}
          <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
            <div className="text-base font-bold text-gray-900 flex items-center gap-2">
              <PhoneIcon className="h-5 w-5 text-[hsl(var(--primary))]" />
              Liên hệ khẩn cấp
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Họ tên" required={isEmergencyContactRequired}>
                <input
                  type="text"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors ${
                    fieldErrors.emergencyContactName ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  value={editForm.emergencyContactName}
                  onChange={(e) => setEditForm((p) => ({ ...p, emergencyContactName: e.target.value }))}
                />
                {fieldErrors.emergencyContactName && <p className="mt-1 text-xs text-red-600">{fieldErrors.emergencyContactName}</p>}
              </Field>
              <Field label="Số điện thoại" required={isEmergencyContactRequired}>
                <input
                  type="text"
                  maxLength={10}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors ${
                    fieldErrors.emergencyContactPhone ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  value={editForm.emergencyContactPhone}
                  onChange={(e) => setEditForm((p) => ({ ...p, emergencyContactPhone: e.target.value.slice(0, 10) }))}
                />
                {fieldErrors.emergencyContactPhone && <p className="mt-1 text-xs text-red-600">{fieldErrors.emergencyContactPhone}</p>}
              </Field>
            </div>
          </div>

          {/* Identity */}
          <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
            <div className="text-base font-bold text-gray-900 flex items-center gap-2">
              <IdentificationIcon className="h-5 w-5 text-[hsl(var(--primary))]" />
              Giấy tờ tùy thân
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Số CMND/CCCD" required={isIdCardRequired}>
                <input
                  type="text"
                  maxLength={12}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors ${
                    fieldErrors.idCardNumber ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  value={editForm.idCardNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, ''); // Chỉ giữ lại số
                    setEditForm((p) => ({ ...p, idCardNumber: value.slice(0, 12) }));
                  }}
                  placeholder="Nhập CMND/CCCD"
                />
                {fieldErrors.idCardNumber && <p className="mt-1 text-xs text-red-600">{fieldErrors.idCardNumber}</p>}
              </Field>
              <Field label="Ngày cấp" required={isIdCardRequired}>
                <input
                  type="date"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors ${
                    fieldErrors.idCardIssueDate ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  value={editForm.idCardIssueDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, idCardIssueDate: e.target.value }))}
                />
                {fieldErrors.idCardIssueDate && <p className="mt-1 text-xs text-red-600">{fieldErrors.idCardIssueDate}</p>}
              </Field>
              <Field label="Nơi cấp" required={isIdCardRequired}>
                <input
                  type="text"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors ${
                    fieldErrors.idCardIssuePlace ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  value={editForm.idCardIssuePlace}
                  onChange={(e) => setEditForm((p) => ({ ...p, idCardIssuePlace: e.target.value }))}
                />
                {fieldErrors.idCardIssuePlace && <p className="mt-1 text-xs text-red-600">{fieldErrors.idCardIssuePlace}</p>}
              </Field>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Field({ label, children, required, className }: { label: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}
  