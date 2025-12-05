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
    <Card className="bg-white/90 backdrop-blur-sm border border-gray-200/60 shadow-sm rounded-2xl">
      <CardHeader className="border-b border-gray-200/60 py-4">
        <button
          type="button"
          onClick={() => collapsible && setOpen((o) => !o)}
          className={`w-full flex items-center justify-between ${collapsible ? 'cursor-pointer' : ''}`}
        >
          <div className="flex items-center gap-2">
            {Icon ? <Icon className="h-5 w-5 text-gray-600" /> : null}
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          </div>
          {collapsible && (
            <ChevronDownIcon className={`h-5 w-5 text-gray-500 transition-transform ${open ? '' : '-rotate-90'}`} />
          )}
        </button>
      </CardHeader>
      {(!collapsible || open) && <CardBody>{children}</CardBody>}
    </Card>
  );
}

function InfoRow({ label, value, loading, hideIfEmpty = true }: { label: string; value?: any; loading?: boolean; hideIfEmpty?: boolean }) {
  if (!loading && hideIfEmpty && (value === undefined || value === null || value === "")) {
    return null;
  }
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-sm text-gray-900 min-h-5">
        {loading ? <Skeleton className="h-4 w-40" /> : value || "—"}
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
      try {
        const res = await fetch("https://production.cas.so/address-kit/2025-07-01/communes");
        const data = await res.json();
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
      } catch {
        setAllCommunes([]);
        setProvinces([]);
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

  // Load profile from API
  useEffect(() => {
    const load = async () => {
      if (isLoading) return;
      if (!isAuthenticated || !user) {
        router.push("/login");
        return;
      }
      if (!user.email) return;
      
      setLoading(true);
      try {
        const res = await fetch("/api/system/users?self=1", {
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_access_token") || ""}`,
          }, 
          credentials: "include",
        });
        const data = await res.json();
        const items: any[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        const found = items[0] || items.find((u) => (u.email || "").toLowerCase() === user.email!.toLowerCase());
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
          setProfile({
            id: user.id ?? 0,
            email: user.email,
            fullName: user.name ?? user.email,
            phoneNumber: (user as any).phoneNumber,
            avatarUrl: user.avatarUrl,
          });
        }
      } catch (e) {
        setProfile({
          id: user.id ?? 0,
          email: user.email,
          fullName: user.name ?? user.email,
          phoneNumber: (user as any).phoneNumber,
          avatarUrl: user.avatarUrl,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
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

    try {
      setLoading(true);
      const payload = {
        id: editForm.id,
        fullName: editForm.fullName,
        email: editForm.email,
        phoneNumber: editForm.phoneNumber,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        dateOfBirth: editForm.dateOfBirth || undefined,
        gender: editForm.gender || undefined,
        address: composedAddress || editForm.address || undefined,
        city: wardName || editForm.city || undefined,
        state: provinceName || "Việt Nam",
        postalCode: editForm.postalCode || undefined,
        country: "Việt Nam",
        avatarUrl: editForm.avatarUrl || undefined,
        bio: editForm.bio || undefined,
        preferredLanguage: editForm.preferredLanguage || undefined,
        timezone: editForm.timezone || undefined,
        emergencyContactName: editForm.emergencyContactName || undefined,
        emergencyContactPhone: editForm.emergencyContactPhone || undefined,
        emergencyContactRelationship: editForm.emergencyContactRelationship || undefined,
        idCardNumber: editForm.idCardNumber || undefined,
        idCardIssueDate: editForm.idCardIssueDate || undefined,
        idCardIssuePlace: editForm.idCardIssuePlace || undefined,
      };

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
        const data = await res.json().catch(() => ({ error: "Có lỗi xảy ra" }));
        setFlash({ type: "error", text: data.error || "Cập nhật thất bại" });
        return;
      }

      // Reflect to local state
      setProfile((prev) =>
        prev
          ? {
      ...prev,
      email: editForm.email,
              fullName: editForm.fullName,
      phoneNumber: editForm.phoneNumber,
              firstName: editForm.firstName,
              lastName: editForm.lastName,
              dateOfBirth: editForm.dateOfBirth,
              gender: editForm.gender,
              address: editForm.address,
              city: editForm.city,
              state: editForm.state,
              postalCode: editForm.postalCode,
              country: editForm.country,
              avatarUrl: editForm.avatarUrl,
              bio: editForm.bio,
              preferredLanguage: editForm.preferredLanguage,
              timezone: editForm.timezone,
              emergencyContactName: editForm.emergencyContactName,
              emergencyContactPhone: editForm.emergencyContactPhone,
              emergencyContactRelationship: editForm.emergencyContactRelationship,
              idCardNumber: editForm.idCardNumber,
              idCardIssueDate: editForm.idCardIssueDate,
              idCardIssuePlace: editForm.idCardIssuePlace,
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
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1 pl-1 sm:pl-2">
              <div className="flex items-center gap-3 mb-2">
                <Button onClick={() => router.push(backUrl)} variant="secondary" className="flex items-center gap-2">
                  Quay lại
                </Button>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Hồ sơ cá nhân</h1>
              <p className="text-sm text-gray-600 mt-1">Quản lý thông tin tài khoản và liên hệ của bạn</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Grid Layout: Sidebar + Main */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar Summary */}
          <div className="lg:col-span-1">
            <Card className="bg-white/90 backdrop-blur-sm border border-gray-200/60 shadow-sm rounded-2xl sticky top-4">
            <CardBody>
                <div className="flex flex-col items-center text-center">
                  <div className="w-28 h-28 bg-gray-200 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                    {profile?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="h-12 w-12 text-gray-400" />
                    )}
                  </div>

                  <div className="text-lg font-semibold text-gray-900">
                    {loading ? <Skeleton className="h-6 w-40" /> : displayName || "—"}
                  </div>
                  <div className="mt-1 text-sm text-gray-600 flex items-center gap-1">
                    <ShieldCheckIcon className="h-4 w-4" />
                    <span>{user?.role?.toUpperCase?.() || "USER"}</span>
                </div>

                  <div className="mt-4 w-full grid grid-cols-1 gap-3 text-left">
                    <div className="flex items-start gap-3">
                      <EnvelopeIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                    <div>
                        <div className="text-xs text-gray-500">Email</div>
                        <div className="text-sm text-gray-900 break-all">{profile?.email || "—"}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <PhoneIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                    <div>
                        <div className="text-xs text-gray-500">Số điện thoại</div>
                        <div className="text-sm text-gray-900">{profile?.phoneNumber || "—"}</div>
                    </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <IdentificationIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                    <div>
                        <div className="text-xs text-gray-500">Trạng thái</div>
                        <div className="text-sm text-gray-900">{profile?.status || "—"}</div>
                    </div>
                    </div>
                  </div>

                  <div className="mt-6 w-full">
                    <Button variant="secondary" className="w-full" onClick={openEdit}>Chỉnh sửa thông tin</Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <SectionCard title="Thông tin cá nhân" icon={UserIcon}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Họ và tên" value={displayName} loading={loading} />
                <InfoRow label="Ngày sinh" value={formatDateReadable(profile?.dateOfBirth)} loading={loading} />
                <InfoRow label="Giới tính" value={profile?.gender} loading={loading} />
              </div>
              <div className="mt-2">
                <InfoRow label="Giới thiệu" value={profile?.bio} loading={loading} hideIfEmpty={false} />
              </div>
            </SectionCard>

            <SectionCard title="Địa chỉ" icon={MapPinIcon}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Quốc gia" value={profile?.country} loading={loading} />
                <InfoRow label="Tỉnh/Thành" value={profile?.state} loading={loading} />
                <InfoRow label="Thành phố" value={profile?.city} loading={loading} />
                <div className="sm:col-span-2">
                  <InfoRow label="Địa chỉ" value={profile?.address} loading={loading} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Liên hệ khẩn cấp" icon={PhoneIcon} collapsible defaultOpen={false}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Họ tên" value={profile?.emergencyContactName} loading={loading} />
                <InfoRow label="Số điện thoại" value={profile?.emergencyContactPhone} loading={loading} />
              </div>
            </SectionCard>

            <SectionCard title="Giấy tờ tùy thân" icon={IdentificationIcon} collapsible defaultOpen={false}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InfoRow label="Số CMND/CCCD" value={profile?.idCardNumber} loading={loading} />
                <InfoRow label="Ngày cấp" value={formatDateReadable(profile?.idCardIssueDate)} loading={loading} />
                <InfoRow label="Nơi cấp" value={profile?.idCardIssuePlace} loading={loading} />
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Chỉnh sửa thông tin cá nhân"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="secondary" onClick={handleUpdate}>
              Cập nhật
            </Button>
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
          <div className="bg-gray-50/60 border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="text-sm font-semibold text-gray-900">Thông tin cơ bản</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Họ và tên" required>
                <input
                  type="text"
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.fullName ? "border-red-300" : "border-gray-300"
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
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.phoneNumber ? "border-red-300" : "border-gray-300"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editForm.avatarUrl}
                  onChange={(e) => setEditForm((p) => ({ ...p, avatarUrl: e.target.value }))}
                />
                {editForm.avatarUrl && (
                  <div className="pt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editForm.avatarUrl} alt="Preview" className="w-12 h-12 rounded-full object-cover border" />
                    <p className="mt-1 text-xs text-gray-500">Ảnh sẽ được gửi lên backend trong trường avatarUrl (DB lưu trữ, không dùng Cloudinary).</p>
                  </div>
                )}
              </div>
            </Field>
          </div>

          {/* Personal */}
          <div className="bg-gray-50/60 border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="text-sm font-semibold text-gray-900">Thông tin cá nhân</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Ngày sinh" required>
                <input
                  type="date"
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.dateOfBirth ? "border-red-300" : "border-gray-300"
                  }`}
                  value={editForm.dateOfBirth}
                  onChange={(e) => setEditForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                />
                {fieldErrors.dateOfBirth && <p className="mt-1 text-xs text-red-600">{fieldErrors.dateOfBirth}</p>}
              </Field>
              <Field label="Giới tính" required>
                <select
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.gender ? "border-red-300" : "border-gray-300"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  value={editForm.bio}
                  onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                  placeholder="Mô tả ngắn"
                />
              </Field>
            </div>
          </div>

          {/* Address */}
          <div className="bg-gray-50/60 border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="text-sm font-semibold text-gray-900">Địa chỉ</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Tỉnh/Thành phố" required>
                <select
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.province ? "border-red-300" : "border-gray-300"
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
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.ward ? "border-red-300" : "border-gray-300"
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
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.addressDetail ? "border-red-300" : "border-gray-300"
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
          <div className="bg-gray-50/60 border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="text-sm font-semibold text-gray-900">Liên hệ khẩn cấp</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Họ tên" required={isEmergencyContactRequired}>
                <input
                  type="text"
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.emergencyContactName ? "border-red-300" : "border-gray-300"
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
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.emergencyContactPhone ? "border-red-300" : "border-gray-300"
                  }`}
                  value={editForm.emergencyContactPhone}
                  onChange={(e) => setEditForm((p) => ({ ...p, emergencyContactPhone: e.target.value.slice(0, 10) }))}
                />
                {fieldErrors.emergencyContactPhone && <p className="mt-1 text-xs text-red-600">{fieldErrors.emergencyContactPhone}</p>}
              </Field>
            </div>
          </div>

          {/* Identity */}
          <div className="bg-gray-50/60 border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="text-sm font-semibold text-gray-900">Giấy tờ tùy thân</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Số CMND/CCCD" required={isIdCardRequired}>
                <input
                  type="text"
                  maxLength={12}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.idCardNumber ? "border-red-300" : "border-gray-300"
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
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.idCardIssueDate ? "border-red-300" : "border-gray-300"
                  }`}
                  value={editForm.idCardIssueDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, idCardIssueDate: e.target.value }))}
                />
                {fieldErrors.idCardIssueDate && <p className="mt-1 text-xs text-red-600">{fieldErrors.idCardIssueDate}</p>}
              </Field>
              <Field label="Nơi cấp" required={isIdCardRequired}>
                <input
                  type="text"
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.idCardIssuePlace ? "border-red-300" : "border-gray-300"
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
  