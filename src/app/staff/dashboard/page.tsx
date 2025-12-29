"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";

type TaskStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

type Task = {
  id: number;
  relatedType?: string;
  relatedId?: number;
  title: string;
  description: string;
  assignedTo: number;
  taskCreatedBy?: number;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt?: string;
  createdDate: string;
  lastModifiedDate?: string;
};

// ===== UI Components =====
function KPICard({ title, value, hint, bgColor = "bg-blue-100", iconColor = "text-blue-600" }: { 
  title: string; 
  value: string; 
  hint?: string; 
  bgColor?: string;
  iconColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
          {hint && <p className="text-sm text-gray-500">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

export default function StaffDashboardPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  
  const [filterStatus, setFilterStatus] = useState<'ALL' | TaskStatus>('ALL');
  const [filterPriority, setFilterPriority] = useState<'ALL' | TaskPriority>('ALL');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('userRole', 'staff');
    }
  }, []);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [flash]);

  // Helper function to get staff profile ID from account ID
  const getStaffProfileId = useCallback(async (): Promise<number | null> => {
    if (!user?.id) return null;
    
    const accountId = String(user.id);
    const allStaffProfiles = await apiClient.getStaffProfiles();
    
    if (allStaffProfiles.success && allStaffProfiles.data) {
      const profiles = Array.isArray(allStaffProfiles.data) 
        ? allStaffProfiles.data 
        : (Array.isArray((allStaffProfiles.data as any)?.items) ? (allStaffProfiles.data as any).items : []);
      
      const staffProfile = profiles.find((p: any) => 
        String(p.accountId || p.account_id || p.accountID) === accountId
      );
      
      return staffProfile?.id || null;
    }
    
    return null;
  }, [user?.id]);

  const loadTasks = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const staffId = await getStaffProfileId();
      
      if (!staffId) {
        setFlash({ type: 'error', text: 'Không tìm thấy thông tin nhân viên' });
        setLoading(false);
        return;
      }

      console.log('Loading tasks for staffId:', staffId);
      const response = await apiClient.getStaffTasksByAssignee(staffId);
      console.log('Tasks response:', response);
      
      if (response.success) {
        // Parse giống như orders page: data?.items hoặc data trực tiếp
        const data: any = response.data;
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        
        console.log('Parsed tasks:', items);
        setTasks(items);
      } else {
        console.warn('Failed to load tasks by assignee:', response.error);
        setFlash({ type: 'error', text: response.error || 'Không thể tải danh sách nhiệm vụ' });
        setTasks([]);
      }
    } catch (error: any) {
      console.error('Error loading tasks:', error);
      setFlash({ type: 'error', text: error.message || 'Có lỗi xảy ra khi tải dữ liệu' });
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, getStaffProfileId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const filteredTasks = tasks.filter(task => {
    const statusMatch = filterStatus === 'ALL' || task.status === filterStatus;
    const priorityMatch = filterPriority === 'ALL' || task.priority === filterPriority;
    return statusMatch && priorityMatch;
  });

  const handleStartTask = async (task: Task) => {
    try {
      const response = await apiClient.updateStaffTask(task.id, {
        ...task,
        status: 'IN_PROGRESS'
      });
      
      if (response.success) {
        setFlash({ type: 'success', text: 'Đã bắt đầu công việc!' });
        await loadTasks();
      } else {
        setFlash({ type: 'error', text: response.error || 'Không thể bắt đầu công việc' });
      }
    } catch (error: any) {
      setFlash({ type: 'error', text: error.message || 'Có lỗi xảy ra' });
    }
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    
    try {
      const response = await apiClient.updateStaffTask(selectedTask.id, {
        ...selectedTask,
        status: 'DONE',
        description: completionNote ? `${selectedTask.description}\n\n[Ghi chú hoàn thành]: ${completionNote}` : selectedTask.description
      });
      
      if (response.success) {
        setFlash({ type: 'success', text: 'Đã hoàn thành công việc!' });
        setCompleteModalOpen(false);
        setCompletionNote('');
        await loadTasks();
      } else {
        setFlash({ type: 'error', text: response.error || 'Không thể hoàn thành công việc' });
      }
    } catch (error: any) {
      setFlash({ type: 'error', text: error.message || 'Có lỗi xảy ra' });
    }
  };

  const handleCancelTask = async (task: Task) => {
    try {
      const response = await apiClient.updateStaffTask(task.id, {
        ...task,
        status: 'CANCELLED'
      });
      
      if (response.success) {
        setFlash({ type: 'success', text: 'Đã hủy công việc!' });
        await loadTasks();
      } else {
        setFlash({ type: 'error', text: response.error || 'Không thể hủy công việc' });
      }
    } catch (error: any) {
      setFlash({ type: 'error', text: error.message || 'Có lỗi xảy ra' });
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'OPEN':
        return <Badge tone="warning">Mới</Badge>;
      case 'ASSIGNED':
        return <Badge tone="info">Đã giao</Badge>;
      case 'IN_PROGRESS':
        return <Badge>Đang làm</Badge>;
      case 'DONE':
        return <Badge tone="success">Hoàn thành</Badge>;
      case 'CANCELLED':
        return <Badge tone="error">Đã hủy</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'URGENT':
        return <Badge tone="error">Khẩn cấp</Badge>;
      case 'HIGH':
        return <Badge tone="error">Cao</Badge>;
      case 'MEDIUM':
        return <Badge tone="warning">Trung bình</Badge>;
      case 'LOW':
        return <Badge tone="muted">Thấp</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Stats
  const openTasks = tasks.filter(t => t.status === 'OPEN' || t.status === 'ASSIGNED').length;
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const completedTasks = tasks.filter(t => t.status === 'DONE').length;

  return (
    <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
          <div className="border-b border-gray-200/50 px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Công việc của tôi</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Quản lý và theo dõi công việc được giao
                </p>
              </div>
              <Button onClick={loadTasks} variant="secondary">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Làm mới
              </Button>
            </div>
          </div>
        </div>

        {/* Flash Messages */}
        {flash && (
          <div className={`py-2.5 rounded-xl px-4 border shadow-sm animate-fade-in flex items-center gap-2 ${
            flash.type === 'success' ? 'bg-green-50 text-green-800 border-green-100' : 'bg-red-50 text-red-800 border-red-100'
          }`}>
            <svg className={`w-5 h-5 ${flash.type === 'success' ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {flash.type === 'success' 
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              }
            </svg>
            <span className="text-sm font-medium">{flash.text}</span>
          </div>
        )}

        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            <>
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </>
          ) : (
            <>
              <KPICard 
                title="Chờ xử lý" 
                value={String(openTasks)} 
                hint="Công việc mới"
                bgColor="bg-yellow-100"
                iconColor="text-yellow-600"
              />
              <KPICard 
                title="Đang làm" 
                value={String(inProgressTasks)} 
                hint="Đang thực hiện"
                bgColor="bg-blue-100"
                iconColor="text-blue-600"
              />
              <KPICard 
                title="Hoàn thành" 
                value={String(completedTasks)} 
                hint="Đã hoàn thành"
                bgColor="bg-green-100"
                iconColor="text-green-600"
              />
            </>
          )}
        </section>

        {/* Filters */}
        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardBody className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Trạng thái</label>
                <div className="relative rounded-xl border border-gray-300 bg-white overflow-hidden">
                  <select 
                    className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0" 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="OPEN">Mới</option>
                    <option value="ASSIGNED">Đã giao</option>
                    <option value="IN_PROGRESS">Đang làm</option>
                    <option value="DONE">Hoàn thành</option>
                    <option value="CANCELLED">Đã hủy</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ưu tiên</label>
                <div className="relative rounded-xl border border-gray-300 bg-white overflow-hidden">
                  <select 
                    className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0" 
                    value={filterPriority} 
                    onChange={(e) => setFilterPriority(e.target.value as any)}
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="URGENT">Khẩn cấp</option>
                    <option value="HIGH">Cao</option>
                    <option value="MEDIUM">Trung bình</option>
                    <option value="LOW">Thấp</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="flex items-end col-span-2">
                <div className="text-sm text-gray-600">
                  Hiển thị <span className="font-semibold text-[hsl(var(--primary))]">{filteredTasks.length}</span> / {tasks.length} công việc
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Tasks List */}
        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Danh sách công việc</h2>
              <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                {filteredTasks.length} công việc
              </span>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                </svg>
                <div className="text-sm">Không có công việc nào</div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className={`p-4 lg:p-6 transition-colors hover:bg-[#f2f8fe] ${
                      (task.status === 'OPEN' || task.status === 'ASSIGNED') 
                        ? 'bg-yellow-50/50' 
                        : ''
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                          {getStatusBadge(task.status)}
                          {getPriorityBadge(task.priority)}
                        </div>
                        
                        {task.description && (
                          <p className="text-sm text-gray-700 leading-relaxed mb-3 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-gray-600">
                          {task.relatedType && (
                            <div>
                              <span className="font-medium">Loại:</span> {task.relatedType}
                            </div>
                          )}
                          {task.dueAt && (
                            <div>
                              <span className="font-medium">Hạn:</span> {formatDate(task.dueAt)}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Tạo:</span> {formatDate(task.createdDate)}
                          </div>
                          {task.lastModifiedDate && (
                            <div>
                              <span className="font-medium">Cập nhật:</span> {formatDate(task.lastModifiedDate)}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-row lg:flex-col gap-2">
                        <Button 
                          variant="secondary"
                          className="h-9 px-4 text-sm bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                          onClick={() => {
                            setSelectedTask(task);
                            setDetailModalOpen(true);
                          }}
                        >
                          Chi tiết
                        </Button>
                        
                        {(task.status === 'OPEN' || task.status === 'ASSIGNED') && (
                          <Button 
                            onClick={() => handleStartTask(task)}
                            className="h-9 px-4 text-sm"
                          >
                            Bắt đầu
                          </Button>
                        )}
                        
                        {task.status === 'IN_PROGRESS' && (
                          <Button 
                            onClick={() => {
                              setSelectedTask(task);
                              setCompleteModalOpen(true);
                            }}
                            className="h-9 px-4 text-sm bg-green-600 hover:bg-green-700"
                          >
                            Hoàn thành
                          </Button>
                        )}
                        
                        {(task.status === 'OPEN' || task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS') && (
                          <Button 
                            variant="danger"
                            className="h-9 px-4 text-sm"
                            onClick={() => handleCancelTask(task)}
                          >
                            Hủy
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Task Detail Modal */}
      <Modal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedTask(null);
        }}
        title="Chi tiết công việc"
      >
        {selectedTask && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedTask.title}</h3>
              <div className="flex flex-wrap gap-2">
                {getStatusBadge(selectedTask.status)}
                {getPriorityBadge(selectedTask.priority)}
              </div>
            </div>
            
            {selectedTask.description && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-md">
                  {selectedTask.description}
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              {selectedTask.relatedType && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-gray-500">Loại liên quan</div>
                  <div className="font-medium text-gray-900">{selectedTask.relatedType}</div>
                </div>
              )}
              {selectedTask.relatedId && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-gray-500">ID liên quan</div>
                  <div className="font-medium text-gray-900">#{selectedTask.relatedId}</div>
                </div>
              )}
              {selectedTask.dueAt && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-gray-500">Hạn hoàn thành</div>
                  <div className="font-medium text-gray-900">{formatDate(selectedTask.dueAt)}</div>
                </div>
              )}
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-gray-500">Ngày tạo</div>
                <div className="font-medium text-gray-900">{formatDate(selectedTask.createdDate)}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Complete Task Modal */}
      <Modal
        open={completeModalOpen}
        onClose={() => {
          setCompleteModalOpen(false);
          setCompletionNote('');
        }}
        title="Hoàn thành công việc"
        footer={
          <div className="flex justify-end gap-2">
            <Button 
              variant="secondary" 
              onClick={() => {
                setCompleteModalOpen(false);
                setCompletionNote('');
              }}
            >
              Hủy
            </Button>
            <Button 
              onClick={handleCompleteTask}
              className="bg-green-600 hover:bg-green-700"
            >
              Xác nhận hoàn thành
            </Button>
          </div>
        }
      >
        {selectedTask && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-medium text-green-800">
                Xác nhận hoàn thành công việc: <strong>{selectedTask.title}</strong>?
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ghi chú hoàn thành (tùy chọn)
              </label>
              <textarea
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Nhập ghi chú về việc hoàn thành công việc..."
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
