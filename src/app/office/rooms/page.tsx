"use client";

import { useState, useEffect, useMemo } from "react";
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
    const headers = ['ID','Mã phòng','Tên phòng','ID loại phòng','Tầng','Trạng thái','Mô tả'];
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
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-transparent shadow-sm px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Quản lý phòng</h1>
              <p className="text-sm lg:text-base text-gray-600 mt-1">Theo dõi trạng thái và quản lý phòng</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-5 sm:py-6">
        <div className="space-y-5 sm:space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardBody>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{rooms.length}</div>
                  <div className="text-sm text-gray-600">Tổng phòng</div>
                </div>
              </CardBody>
            </Card>
            
            <Card>
              <CardBody>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {rooms.filter(r => r.status === 'AVAILABLE').length}
                  </div>
                  <div className="text-sm text-gray-600">Phòng trống</div>
                </div>
              </CardBody>
            </Card>
            
            <Card>
              <CardBody>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {rooms.filter(r => r.status === 'OCCUPIED').length}
                  </div>
                  <div className="text-sm text-gray-600">Đang sử dụng</div>
                </div>
              </CardBody>
            </Card>
            
            <Card>
              <CardBody>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {rooms.filter(r => r.status === 'MAINTENANCE').length}
                  </div>
                  <div className="text-sm text-gray-600">Bảo trì</div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Toolbar */}
          <Card>
            <CardBody>
              {/* Toolbar */}
              <div className="space-y-3">
                {/* Segmented filters: scrollable on mobile */}
                <div className="grid grid-cols-3 gap-2 md:flex md:flex-nowrap md:items-center md:gap-2 md:overflow-x-auto no-scrollbar pr-1" aria-label="Bộ lọc nhanh trạng thái">
                  {([
                    { key: 'ALL', label: `Tất cả (${rooms.length})` },
                    { key: 'AVAILABLE', label: `Trống (${rooms.filter(r => r.status === 'AVAILABLE').length})` },
                    { key: 'OCCUPIED', label: `Có khách (${rooms.filter(r => r.status === 'OCCUPIED').length})` },
                    { key: 'MAINTENANCE', label: `Bảo trì (${rooms.filter(r => r.status === 'MAINTENANCE').length})` },
                    { key: 'CLEANING', label: `Đang dọn (${rooms.filter(r => r.status === 'CLEANING').length})` },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setRoomFilter(key as any)}
                      className={
                        "px-3 py-1.5 rounded-full text-sm border transition-colors w-full text-center " +
                        (roomFilter === key
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")
                      }
                      aria-pressed={roomFilter === key}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Search on a new line */}
                <div className="w-full">
                  <div className="w-full md:w-[32rem] lg:w-[36rem] relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
                    </div>
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm kiếm theo tên phòng..."
                      className="w-full pl-9 pr-3 py-2 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Tìm kiếm phòng"
                    />
                  </div>
                </div>
              </div>
              {/* Error banner */}
              {roomsError && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 text-red-700 p-3 text-sm flex items-center justify-between">
                  <span>Không tải được danh sách phòng. Vui lòng thử lại.</span>
                  <button onClick={()=>refetchRooms()} className="px-3 py-1.5 rounded-md border border-red-300 bg-white hover:bg-red-100 text-red-700">Thử lại</button>
                </div>
              )}
            </CardBody>
          </Card>

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
                <label className="block text-sm text-gray-700 mb-1">Loại phòng</label>
                <div className="text-xs text-gray-500">(Tùy chọn: multi-select loại phòng khi có dữ liệu)</div>
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
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">
                Danh sách phòng ({filteredRooms.length})
              </h3>
            </CardHeader>
            <CardBody>
              {roomsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-md bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="text-center py-8">
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
                <div className="overflow-x-auto">
                <div className="sm:min-w-[940px]">
                <Table>
                  <THead>
                    <tr>
                      <th className="px-4 sm:px-6 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap">Mã phòng</th>
                      <th className="px-4 sm:px-6 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap">Tên phòng</th>
                      <th className="px-4 sm:px-6 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap hidden sm:table-cell">Tầng</th>
                      <th className="px-4 sm:px-6 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap">Trạng thái</th>
                      <th className="px-4 sm:px-6 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap hidden sm:table-cell">Mô tả</th>
                    </tr>
                  </THead>
                  <TBody>
                    {filteredRooms.map((room) => (
                      <tr key={room.id} className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                        <td className={"px-4 sm:px-6 " + (compact ? "py-2" : "py-4") + " align-middle whitespace-nowrap"}>
                          <div className="font-medium text-gray-900">{room.code}</div>
                        </td>
                        <td className={"px-4 sm:px-6 " + (compact ? "py-2" : "py-4") + " align-middle whitespace-nowrap"}>
                          <div className="text-sm text-gray-900">{room.name || '—'}</div>
                        </td>
                        <td className={"px-4 sm:px-6 " + (compact ? "py-2" : "py-4") + " align-middle whitespace-nowrap hidden sm:table-cell"}>
                          <div className="text-sm text-gray-900">Tầng {room.floor || '—'}</div>
                        </td>
                        <td className={"px-4 sm:px-6 " + (compact ? "py-2" : "py-4") + " align-middle whitespace-nowrap"}>
                          {getStatusBadge(room.status)}
                        </td>
                        <td className={"px-4 sm:px-6 " + (compact ? "py-2" : "py-4") + " align-middle hidden sm:table-cell"}>
                          <div className="text-sm text-gray-500">
                            {room.description || '—'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </TBody>
                </Table>
                </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}


