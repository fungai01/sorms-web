"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/hooks/useAuth";

type UserProfile = {
  id: number;
  name: string;
  email: string;
  phoneNumber: string;
  position: string;
  department: string;
  avatar?: string;
};

export default function ProfilePage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  
  // Get back URL - try to get from sessionStorage first, then fallback to role detection
  const getBackUrl = () => {
    // Try to get the previous page from sessionStorage
    const previousPage = typeof window !== 'undefined' ? sessionStorage.getItem('previousPage') : null;
    if (previousPage && previousPage !== '/profile') {
      return previousPage;
    }
    
    // Fallback: detect from referrer or default to home
    if (typeof window !== 'undefined') {
      const referrer = document.referrer;
      if (referrer) {
        const url = new URL(referrer);
        const path = url.pathname;
        if (path.startsWith('/admin') || path.startsWith('/office') || 
            path.startsWith('/staff') || path.startsWith('/user')) {
          return path;
        }
      }
    }
    
    // Default fallback
    return '/';
  };

  const [profile, setProfile] = useState<UserProfile>({ id: 0, name: '', email: '', phoneNumber: '', position: '', department: '', avatar: '' });
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load profile from real API using current user email
  useEffect(() => {
    const load = async () => {
      // Wait for auth to load
      if (isLoading) return;
      
      // Redirect to login if not authenticated
      if (!isAuthenticated || !user) {
        router.push('/login');
        return;
      }
      
      const email = user.email || '';
      if (!email) return;
      
      setLoading(true);
      try {
        const res = await fetch('/api/system/users', { 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_access_token') || ''}`
          }, 
          credentials: 'include' 
        });
        const data = await res.json();
        const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        const found = list.find((u: any) => (u.email || '').toLowerCase() === email.toLowerCase());
        if (found) {
          setProfile({
            id: found.id,
            name: found.full_name || user.name || email,
            email: found.email || email,
            phoneNumber: found.phone_number || '',
            position: found.position || '',
            department: found.department || '',
            avatar: found.avatar_url || user.avatarUrl || ''
          });
        } else {
          setProfile({
            id: 0,
            name: user.name || email,
            email,
            phoneNumber: user.phoneNumber || '',
            position: '',
            department: '',
            avatar: user.avatarUrl || ''
          });
        }
      } catch {
        // Keep minimal fallback from user
        setProfile(p => ({ 
          ...p, 
          name: user.name || email, 
          email: email,
          avatar: user.avatarUrl || ''
        }))
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, isAuthenticated, isLoading, router]);

  // Auto-hide success/error messages after a few seconds
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [flash]);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    position: '',
    department: '',
    avatar: ''
  });

  const handleEditProfile = () => {
    setEditForm({
      name: profile.name,
      email: profile.email,
      phoneNumber: profile.phoneNumber,
      position: profile.position,
      department: profile.department,
      avatar: profile.avatar || ''
    });
    setEditModalOpen(true);
  };

  const handleUpdateProfile = async () => {
    // Validation
    if (!editForm.name.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập họ và tên' });
      return;
    }

    if (!editForm.email.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập email' });
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editForm.email)) {
      setFlash({ type: 'error', text: 'Email không đúng định dạng' });
      return;
    }

    if (!editForm.phoneNumber.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập số điện thoại' });
      return;
    }

    // Phone number format validation (Vietnamese phone numbers)
    const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})$/;
    if (!phoneRegex.test(editForm.phoneNumber)) {
      setFlash({ type: 'error', text: 'Số điện thoại không đúng định dạng (10 số, bắt đầu bằng 0)' });
      return;
    }

    try {
      setLoading(true);
      
      // Prepare update data
      const updateData = {
        id: profile.id,
        full_name: editForm.name,
        email: editForm.email,
        phone_number: editForm.phoneNumber,
        position: editForm.position,
        department: editForm.department,
        avatar_url: editForm.avatar
      };

      // Call API to update profile
      const res = await fetch('/api/system/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_access_token') || ''}`
        },
        credentials: 'include',
        body: JSON.stringify(updateData)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Có lỗi xảy ra' }));
        setFlash({ type: 'error', text: err.error || 'Có lỗi xảy ra khi cập nhật hồ sơ' });
        return;
      }

      // Update local state
    setProfile(prev => ({
      ...prev,
      name: editForm.name,
      email: editForm.email,
      phoneNumber: editForm.phoneNumber,
      position: editForm.position,
      department: editForm.department,
      avatar: editForm.avatar
    }));
      
    setEditModalOpen(false);
    setFlash({ type: 'success', text: 'Cập nhật thông tin cá nhân thành công!' });
    } catch (error) {
      setFlash({ type: 'error', text: 'Có lỗi xảy ra khi cập nhật hồ sơ' });
      console.error('Profile update error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1 pl-4">
              <div className="flex items-center gap-4 mb-2">
                <Button
                  onClick={() => router.push(getBackUrl())}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  Quay lại
                </Button>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Hồ sơ cá nhân</h1>
              <p className="text-sm lg:text-base text-gray-600 mt-1">
                Quản lý thông tin cá nhân của bạn - {profile.position}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Flash Messages */}
          {flash && (
            <div className={`rounded-md border p-2 sm:p-3 text-xs sm:text-sm shadow-sm ${
              flash.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {flash.text}
            </div>
          )}

          {/* Profile Card */}
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-lg rounded-2xl">
            <CardHeader className="border-b border-gray-200/50">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Thông tin cá nhân</h2>
                <Button onClick={handleEditProfile}>
                   Chỉnh sửa
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Avatar Section */}
                <div className="flex flex-col items-center">
                  <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                    {profile.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl text-gray-400">👤</span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{loading ? '...' : (profile.name || '—')}</h3>
                  <p className="text-sm text-gray-600">{profile.position || '—'}</p>
                </div>

                {/* Profile Information */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                      <div className="text-sm text-gray-900">{loading ? '...' : (profile.name || '—')}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <div className="text-sm text-gray-900">{profile.email || '—'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                      <div className="text-sm text-gray-900">{profile.phoneNumber || '—'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Chức vụ</label>
                      <div className="text-sm text-gray-900">{profile.position || '—'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban</label>
                      <div className="text-sm text-gray-900">{profile.department || '—'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditForm({
            name: '',
            email: '',
            phoneNumber: '',
            position: '',
            department: '',
            avatar: ''
          });
        }}
        title="Chỉnh sửa thông tin cá nhân"
        footer={
          <div className="flex justify-end gap-2">
            <Button 
              variant="secondary"
              onClick={() => setEditModalOpen(false)}
            >
              Hủy
            </Button>
            <Button 
              onClick={handleUpdateProfile}
            >
              Cập nhật
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 ${
                  !editForm.name.trim() 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nhập họ và tên"
                required
              />
              {!editForm.name.trim() && (
                <p className="mt-1 text-xs text-red-600">Họ và tên là bắt buộc</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 ${
                  !editForm.email.trim() || (editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email))
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Nhập email (ví dụ: user@email.com)"
                required
              />
              {!editForm.email.trim() && (
                <p className="mt-1 text-xs text-red-600">Email là bắt buộc</p>
              )}
              {editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email) && (
                <p className="mt-1 text-xs text-red-600">Email không đúng định dạng</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số điện thoại <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 ${
                  !editForm.phoneNumber.trim() || (editForm.phoneNumber && !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(editForm.phoneNumber))
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                placeholder="Nhập số điện thoại (ví dụ: 0123456789)"
                maxLength={10}
                required
              />
              {!editForm.phoneNumber.trim() && (
                <p className="mt-1 text-xs text-red-600">Số điện thoại là bắt buộc</p>
              )}
              {editForm.phoneNumber && !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(editForm.phoneNumber) && (
                <p className="mt-1 text-xs text-red-600">Số điện thoại phải có 10 số, bắt đầu bằng 0</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chức vụ
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editForm.position}
                onChange={(e) => setEditForm(prev => ({ ...prev, position: e.target.value }))}
                placeholder="Nhập chức vụ"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phòng ban
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editForm.department}
                onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
                placeholder="Nhập phòng ban"
              />
            </div>
          </div>
          <div className="text-xs text-gray-500">
            <span className="text-red-500">*</span> Thông tin bắt buộc
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ảnh đại diện</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    setEditForm(prev => ({ ...prev, avatar: String(reader.result || '') }))
                  }
                  reader.readAsDataURL(file)
                }}
                className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {editForm.avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editForm.avatar} alt="Preview" className="w-10 h-10 rounded-full object-cover" />
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">Hỗ trợ ảnh JPG, PNG. Tối đa ~2MB.</p>
          </div>
        </div>
      </Modal>
    </>
  );
}