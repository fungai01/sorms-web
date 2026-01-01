"use client";

import { useState, useEffect, useMemo } from "react";
import Input from "@/components/ui/Input";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Table, THead, TBody } from "@/components/ui/Table";
import { useRooms } from "@/hooks/useApi";
import { useRouter } from "next/navigation";

type Room = {
  id: number;
  code: string;
  name?: string;
  roomTypeId: number;
  floor?: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'CLEANING' | 'OUT_OF_SERVICE';
  description?: string;
};

export default function OfficeRoomsPage() {
  const router = useRouter();
  
  // Use API hooks for data fetching
  const { data: roomsData, loading: roomsLoading, error: roomsError, refetch: refetchRooms } = useRooms();

  // Transform API data
  const rooms: Room[] = (roomsData as any) || [];

  const [roomFilter, setRoomFilter] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'CLEANING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [compact, setCompact] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [floorMin, setFloorMin] = useState<string>('');
  const [floorMax, setFloorMax] = useState<string>('');

  const statusLabels: Record<string, string> = {
    'ALL': 'Tất cả',
    'AVAILABLE': 'Trống',
    'OCCUPIED': 'Có khách',
    'MAINTENANCE': 'Bảo trì',
    'CLEANING': 'Đang dọn',
  };

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = rooms.filter(room => {
      const statusMatch = roomFilter === 'ALL' || room.status === roomFilter;
      if (!q) return statusMatch;
      const hay = [room.code, room.name || '', String(room.floor || ''), room.description || '']
        .join(' ').toLowerCase();
      return statusMatch && hay.includes(q);
    });
    // advanced floor filters
    const min = floorMin ? parseInt(floorMin, 10) : undefined;
    const max = floorMax ? parseInt(floorMax, 10) : undefined;
    return base.filter(r => {
      const f = r.floor ?? undefined;
      if (min !== undefined && (f === undefined || f < min)) return false;
      if (max !== undefined && (f === undefined || f > max)) return false;
      return true;
    });
  }, [rooms, roomFilter, searchQuery]);

  // Export CSV
  const exportCsv = () => {
    const headers = ['ID','Mã phòng','Tên phòng','ID Dãy Tòa','Tầng','Trạng thái','Mô tả'];
    const rows = rooms.map((r:any)=>[
      r.id,
      r.code,
      r.name || '',
      r.roomTypeId,
      r.floor || '',
      r.status,
      (r.description||'').replace(/\n|\r/g,' ')
    ]);
    const csv = [headers, ...rows].map(arr=>arr.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rooms.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return <Badge tone="available">Trống</Badge>;
      case 'OCCUPIED':
        return <Badge tone="occupied">Có khách</Badge>;
      case 'MAINTENANCE':
        return <Badge tone="maintenance">Bảo trì</Badge>;
      case 'CLEANING':
        return <Badge tone="warning">Đang dọn</Badge>;
      case 'OUT_OF_SERVICE':
        return <Badge tone="rejected">Ngừng hoạt động</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <>
      <div className="px-6 pt-4 pb-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header & Filters Card */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
            <div className="header border-b border-gray-200/50 px-6 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Quản lý phòng</h1>
              </div>
            </div>
            <CardBody className="p-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex-1">
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm theo mã phòng, tên phòng..."
                    className="w-full"
                  />
                </div>
                <div className="sm:w-48">
                  <select
                    value={roomFilter}
                    onChange={(e) => setRoomFilter(e.target.value as any)}
                    className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M6%209L1%204h10z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-8"
                  >
                    {(['ALL', 'AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING'] as const).map((key) => (
                      <option key={key} value={key}>
                        {statusLabels[key]} {key !== 'ALL' && `(${rooms.filter(r => r.status === key).length})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Error banner */}
              {roomsError && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 text-red-700 p-3 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="flex-1">Không tải được danh sách phòng. Vui lòng thử lại.</span>
                  <button onClick={()=>refetchRooms()} className="px-3 py-1.5 rounded-md border border-red-300 bg-white hover:bg-red-100 text-red-700 text-sm">Thử lại</button>
                </div>
              )}
            </CardBody>
          </div>

          <div className="space-y-5 sm:space-y-6">

          {/* Advanced Filters Drawer */}
          <Modal
            open={showAdvanced}
            onClose={()=>setShowAdvanced(false)}
            title="Bộ lọc nâng cao"
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={()=>{setFloorMin('');setFloorMax('');}}>Đặt lại</Button>
                <Button onClick={()=>setShowAdvanced(false)}>Áp dụng</Button>
              </div>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Tầng từ</label>
                <input value={floorMin} onChange={(e)=>setFloorMin(e.target.value)} type="number" className="w-full px-3 py-2 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Tầng đến</label>
                <input value={floorMax} onChange={(e)=>setFloorMax(e.target.value)} type="number" className="w-full px-3 py-2 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {/* Placeholders for room type & status multi-selects (to integrate with existing UI lib) */}
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-700 mb-1">Dãy Tòa</label>
                <div className="text-xs text-gray-500">(Tùy chọn: multi-select Dãy Tòa khi có dữ liệu)</div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-700 mb-1">Trạng thái</label>
                <div className="flex flex-wrap gap-2 text-sm">
                  {['AVAILABLE','OCCUPIED','MAINTENANCE','CLEANING','OUT_OF_SERVICE'].map(s=> (
                    <label key={s} className="inline-flex items-center gap-2">
                      <input type="checkbox" disabled className="rounded border-gray-300" />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Modal>

          {/* Rooms Table */}
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Danh sách phòng</h2>
                <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                  {filteredRooms.length} phòng
                </span>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {roomsLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-md bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <div className="text-gray-400 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">Không có phòng nào phù hợp</p>
                  <div className="mt-4">
                    <Button variant="secondary" onClick={() => refetchRooms()}>
                      Làm mới
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <THead>
                        <tr>
                          <th className="px-4 py-3 text-center text-sm font-bold">Mã phòng</th>
                          <th className="px-4 py-3 text-left text-sm font-bold">Tên phòng</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Tầng</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái</th>
                          <th className="px-4 py-3 text-left text-sm font-bold">Mô tả</th>
                        </tr>
                      </THead>
                      <TBody>
                        {filteredRooms.map((room, index) => (
                          <tr key={room.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-[#f2f8fe]`}>
                            <td className="px-4 py-3 font-medium text-center text-gray-900">{room.code}</td>
                            <td className="px-4 py-3 text-left text-gray-700">{room.name || '—'}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{room.floor ? `Tầng ${room.floor}` : '—'}</td>
                            <td className="px-4 py-3 text-center">
                              {getStatusBadge(room.status)}
                            </td>
                            <td className="px-4 py-3 text-left text-gray-700">
                              {room.description || '—'}
                            </td>
                          </tr>
                        ))}
                      </TBody>
                    </Table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="lg:hidden space-y-3 p-4">
                    {filteredRooms.map((room) => (
                      <div key={room.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 transition-colors hover:bg-[#f2f8fe]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-bold text-gray-900">{room.code}</h3>
                            <p className="text-sm text-gray-600 mt-1">{room.name || '—'}</p>
                          </div>
                          <div className="flex-shrink-0">
                            {getStatusBadge(room.status)}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                            <span className="text-gray-600">Tầng:</span> <span className="font-bold text-gray-900">{room.floor ? `Tầng ${room.floor}` : '—'}</span>
                          </div>
                          {room.description && (
                            <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                              <span className="text-gray-600">Mô tả:</span> <span className="font-bold text-gray-900 truncate block">{room.description}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
          </div>
        </div>
      </div>
    </>
  );
}


