"use client";

import { useState, useEffect, useRef } from "react";
import * as faceapi from "face-api.js";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRooms } from "@/hooks/useApi";
import { authFetch } from "@/lib/http";
import roomImage from "@/img/Room.jpg";

const WebcamComponent = dynamic(() => import("react-webcam") as any, { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <p className="text-sm text-gray-500">Đang khởi động camera...</p>
    </div>
  )
}) as any;

type Room = { id: number; code: string; name?: string; roomTypeName?: string; status?: string };
type Booking = { id: number; roomId: number; roomCode?: string; status: string; checkinDate: string; checkoutDate: string };

export default function OpenDoorPage() {
  // Sử dụng hook để fetch rooms từ API
  const { data: roomsData, loading: loadingRooms, error: roomsError, refetch: refetchRooms } = useRooms();
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [faceStatus, setFaceStatus] = useState<"no-face" | "off-center" | "too-close" | "too-far" | "good">("no-face");
  const [faceModelLoaded, setFaceModelLoaded] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  
  const webcamRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (flash) {
      const timer = setTimeout(() => setFlash(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [flash]);

  // Load model nhận diện khuôn mặt cho việc "canh" trên FE
  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      try {
        // Kiểm tra xem model đã được load chưa (tránh load lại khi hot reload)
        if (faceapi.nets.tinyFaceDetector.isLoaded) {
          if (!cancelled) {
            setFaceModelLoaded(true);
          }
          return;
        }

        // Import backend động để tránh đăng ký kernel nhiều lần trong Next.js hot reload
        // Chỉ import khi chưa có backend nào được set
        if (faceapi?.tf) {
          const currentBackend = faceapi.tf.getBackend?.();
          if (!currentBackend) {
            // Dynamic import backend để tránh đăng ký kernel nhiều lần
            await import("@tensorflow/tfjs-backend-webgl");
            await faceapi.tf.setBackend("webgl");
          }
          await faceapi.tf.ready();
        }

        // Các file model cần được đặt tại thư mục public/models
        const MODEL_URL = "/models";
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        if (!cancelled) {
          setFaceModelLoaded(true);
        }
      } catch (err) {
        console.error("Không thể load model face-api:", err);
      }
    };

    loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  // Helper function để validate video element trong Next.js 15
  const isValidVideoElement = (video: any): video is HTMLVideoElement => {
    if (!video) return false;
    
    // Kiểm tra là HTMLVideoElement thực sự
    if (!(video instanceof HTMLVideoElement)) return false;
    
    // Kiểm tra video đã được mount trong DOM
    if (!document.body.contains(video)) return false;
    
    // Kiểm tra các thuộc tính cần thiết
    if (
      video.tagName !== "VIDEO" ||
      video.readyState !== 4 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0 ||
      video.paused ||
      video.ended
    ) {
      return false;
    }
    
    // Kiểm tra video có stream data
    if (!video.srcObject && !video.src) return false;
    
    return true;
  };

  // Liên tục canh vị trí khuôn mặt: lệch / gần / xa / tốt
  useEffect(() => {
    if (!faceModelLoaded || !selectedRoom || !cameraReady) {
      // Khi chưa load model, chưa chọn phòng hoặc camera chưa sẵn sàng thì không detect
      setFaceStatus("no-face");
      return;
    }

    let interval: any;
    let isDetecting = false; // Tránh detect đồng thời nhiều lần
    let timeoutId: any;
    let retryCount = 0;
    const MAX_RETRIES = 10;

    // Đợi một chút sau khi camera ready để đảm bảo video có frame trong Next.js 15
    timeoutId = setTimeout(() => {
      const startDetect = () => {
        interval = setInterval(async () => {
          // Nếu đang detect thì skip
          if (isDetecting) return;

          const video = webcamRef.current?.video as HTMLVideoElement | null;

          // Validate video element một cách chặt chẽ cho Next.js 15
          if (!isValidVideoElement(video)) {
            retryCount++;
            if (retryCount > MAX_RETRIES) {
              setFaceStatus("no-face");
            }
            return;
          }

          // Reset retry count khi video hợp lệ
          retryCount = 0;

          // Đảm bảo video element thực sự sẵn sàng và có frame data
          // Trong Next.js 15, cần đợi video thực sự có frame trước khi detect
          // Kiểm tra video có đang phát và có frame data
          if (video.paused || video.ended || video.readyState < 4) {
            return;
          }

          // Đảm bảo video có frame data hợp lệ (videoWidth và videoHeight > 0)
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            return;
          }

          isDetecting = true;
          try {
            // Sử dụng video element trực tiếp (theo yêu cầu chỉ dùng <video>, <canvas>, hoặc <img>)
            // Đảm bảo video element đã được mount trong DOM và có frame data hợp lệ
            const detection = await faceapi.detectSingleFace(
              video,
              new faceapi.TinyFaceDetectorOptions()
            );

            if (!detection) {
              setFaceStatus("no-face");
              setFaceBox(null);
              isDetecting = false;
              return;
            }

            const { box } = detection;
            const frameW = video.videoWidth || 1;
            const frameH = video.videoHeight || 1;

            // Lưu lại box tỉ lệ để có thể vẽ khung từ FE (không phụ thuộc backend)
            setFaceBox({
              x: box.x / frameW,
              y: box.y / frameH,
              width: box.width / frameW,
              height: box.height / frameH,
            });

            const centerX = (box.x + box.width / 2) / frameW;
            const centerY = (box.y + box.height / 2) / frameH;
            const faceAreaRatio = (box.width * box.height) / (frameW * frameH);

            const isOffCenter =
              Math.abs(centerX - 0.5) > 0.15 || Math.abs(centerY - 0.5) > 0.15;

            if (isOffCenter) {
              setFaceStatus("off-center");
            } else if (faceAreaRatio > 0.35) {
              setFaceStatus("too-close");
            } else if (faceAreaRatio < 0.08) {
              setFaceStatus("too-far");
            } else {
              setFaceStatus("good");
            }
          } catch (err) {
            console.error("Lỗi khi detect khuôn mặt:", err);
            setFaceStatus("no-face");
          } finally {
            isDetecting = false;
          }
        }, 700);
      };

      // Kiểm tra webcamRef có tồn tại không (quan trọng cho Next.js 15)
      if (!webcamRef.current) {
        console.warn("webcamRef chưa sẵn sàng trong Next.js 15");
        setFaceStatus("no-face");
        return;
      }
      
      startDetect();
    }, 1000); // Đợi 1000ms sau khi camera ready để đảm bảo Next.js 15 mount đúng

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (interval) clearInterval(interval);
      // Cleanup canvas
      if (canvasRef.current) {
        canvasRef.current = null;
      }
    };
  }, [faceModelLoaded, selectedRoom, cameraReady]);

  // Normalize rooms data từ hook
  const rooms: Room[] = Array.isArray(roomsData) ? roomsData : [];

  // Fetch user bookings from API
  useEffect(() => {
    const fetchUserBookings = async () => {
      try {
        setLoadingBookings(true);
        const bookingsRes = await authFetch('/api/system/bookings?my=1', {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        
        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          const bookingList = Array.isArray(bookingsData.items) ? bookingsData.items : 
                             Array.isArray(bookingsData.data) ? bookingsData.data :
                             Array.isArray(bookingsData) ? bookingsData : [];
          setUserBookings(bookingList);
        } else {
          console.error('Failed to fetch user bookings:', bookingsRes.status);
        }
      } catch (err) {
        console.error('Error fetching user bookings:', err);
      } finally {
        setLoadingBookings(false);
      }
    };
    fetchUserBookings();
  }, []);

  // Check if user has valid CHECKED_IN booking for this room
  const getBookingForRoom = (room: Room): Booking | null => {
    const now = new Date();
    
    return userBookings.find(b => {
      // Check room match
      const roomMatch = b.roomId === room.id || b.roomCode === room.code;
      if (!roomMatch) return false;
      
      // Check status is CHECKED_IN
      if (b.status !== 'CHECKED_IN') return false;
      
      // Check date range
      const checkin = new Date(b.checkinDate);
      const checkout = new Date(b.checkoutDate);
      checkin.setHours(0, 0, 0, 0);
      checkout.setHours(23, 59, 59, 999);
      
      return now >= checkin && now <= checkout;
    }) || null;
  };

  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room);
    setResult(null);
    setCameraError(null);
    setFaceBox(null);
    setFaceStatus("no-face");
    setCameraReady(false);
  };

  const handleOpenDoor = async () => {
    if (!webcamRef.current || !selectedRoom || loading) return;

    setLoading(true);
    setResult(null);
    setFaceBox(null);
    // Không reset faceStatus ở đây để giữ hướng dẫn, chỉ disable nút khi không "good"

    try {
      const screenshot = webcamRef.current.getScreenshot({ width: 800, height: 600, screenshotQuality: 0.9 });
      if (!screenshot) {
        setFlash({ type: 'error', text: 'Không thể chụp ảnh từ camera' });
        setLoading(false);
        return;
      }

      // Check if user has valid booking for this room
      const validBooking = getBookingForRoom(selectedRoom);
      
      if (!validBooking) {
        // No valid booking - deny access
        setResult({ 
          success: false, 
          message: `Xác thực thất bại! Bạn không có booking CHECKED_IN cho phòng ${selectedRoom.code}.` 
        });
        setFlash({ type: 'error', text: 'Không có quyền truy cập phòng này' });
        setLoading(false);
        return;
      }

      // Has valid booking - call API to verify face
      const imgRes = await fetch(screenshot);
      const blob = await imgRes.blob();
      const file = new File([blob], `door-${Date.now()}.jpg`, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('image', file);
      formData.append('roomId', String(selectedRoom.id));
      formData.append('bookingId', String(validBooking.id));

      const res = await fetch('/api/system/verification/open-door', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      const doorData = data?.data || data;
      const accessGranted = doorData?.access === true;

      // Nếu backend trả về toạ độ khung khuôn mặt, ví dụ:
      // doorData.faceBox = { x: 0.2, y: 0.25, width: 0.5, height: 0.5 }
      // (các giá trị là tỉ lệ so với chiều rộng/chiều cao ảnh, từ 0 đến 1)
      if (doorData?.faceBox) {
        const box = doorData.faceBox;
        if (
          typeof box.x === 'number' &&
          typeof box.y === 'number' &&
          typeof box.width === 'number' &&
          typeof box.height === 'number'
        ) {
          setFaceBox({
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          });
        }
      }

      if (!res.ok || !accessGranted) {
        setResult({ success: false, message: doorData?.message || 'Xác thực khuôn mặt thất bại' });
        setFlash({ type: 'error', text: doorData?.message || 'Không thể mở cửa' });
      } else {
        setResult({ success: true, message: `Mở cửa thành công! Booking #${validBooking.id} khớp với phòng ${selectedRoom.code}` });
        setFlash({ type: 'success', text: 'Đã mở cửa thành công!' });
      }
    } catch (error: any) {
      setResult({ success: false, message: error?.message || 'Lỗi khi mở cửa' });
      setFlash({ type: 'error', text: 'Lỗi khi mở cửa' });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedRoom(null);
    setResult(null);
    setCameraError(null);
    setFaceBox(null);
    setFaceStatus("no-face");
    setCameraReady(false);
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case "AVAILABLE": return "Trống";
      case "OCCUPIED": return "Đang thuê";
      case "MAINTENANCE": return "Bảo trì";
      default: return status || "N/A";
    }
  };

  const getStatusBadge = (status?: string): "available" | "occupied" | "maintenance" => {
    if (status === "AVAILABLE") return "available";
    if (status === "OCCUPIED") return "occupied";
    return "maintenance";
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen flex flex-col">
      <div className={`${!selectedRoom ? 'w-full px-6 max-w-[1000px] mx-auto' : 'w-full'} py-4 flex-1 flex flex-col`}>
        {/* Header */}
        {!selectedRoom && (
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-[hsl(var(--primary))] rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">Danh sách phòng</h1>
                <p className="text-sm text-gray-600 mt-1">Chọn phòng để mở cửa</p>
              </div>
              <span className="text-sm font-semibold text-[hsl(var(--primary))]">
                {rooms.length} phòng
              </span>
            </div>
          </div>
        )}

        {/* Flash */}
        {flash && (
          <div className={`mb-4 p-3 rounded-xl border shadow-sm animate-fade-in flex items-center gap-2 ${
            flash.type === 'success' ? 'bg-green-50 text-green-800 border-green-100' : 'bg-red-50 text-red-800 border-red-100'
          }`}>
            <svg className={`w-5 h-5 flex-shrink-0 ${flash.type === 'success' ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {flash.type === 'success' 
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              }
            </svg>
            <span className="text-sm font-medium">{flash.text}</span>
          </div>
        )}

        {/* Room List - Show all 9 rooms */}
        {!selectedRoom && (
          <div>
            {loadingRooms || loadingBookings ? (
              <div className="py-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(var(--primary))] mb-3"></div>
                <p className="text-sm text-gray-500">Đang tải dữ liệu...</p>
              </div>
            ) : roomsError ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-sm text-red-600 font-medium mb-2">Không thể tải danh sách phòng</p>
                <p className="text-xs text-gray-500 mb-4">{roomsError}</p>
                <Button variant="secondary" className="text-sm" onClick={() => refetchRooms()}>
                  Thử lại
                </Button>
              </div>
            ) : rooms.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 font-medium">Không có phòng nào</p>
                <p className="text-xs text-gray-500 mt-1">Vui lòng thử lại sau</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {rooms.map((room) => {
                  const hasAccess = !!getBookingForRoom(room);
                  // Hiển thị tên phòng, nếu không có thì hiển thị code
                  const displayName = room.name || room.code;
                  
                  return (
                    <div
                      key={room.id}
                      onClick={() => handleSelectRoom(room)}
                      className="relative rounded-xl overflow-hidden transition-all text-left w-full cursor-pointer border border-gray-200 hover:shadow-lg hover:border-gray-300"
                    >
                      {/* Room image with overlay */}
                      <div className="relative w-full h-48 overflow-hidden">
                        <Image
                          src={roomImage}
                          alt={room.code}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                        
                        {/* White overlay with room name */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                          <div className="bg-white/95 backdrop-blur-sm rounded-lg px-6 py-4 shadow-lg">
                            <p className="text-4xl font-bold text-gray-900 text-center whitespace-nowrap">{displayName}</p>
                          </div>
                        </div>
                      </div>

                      {/* Room identifier and status below image */}
                      <div className="p-4 bg-white">
                        {/* Action button */}
                        <Button
                          variant="secondary"
                          className="w-full h-10 text-sm font-semibold rounded-lg transition-all bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRoom(room);
                          }}
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Xem chi tiết
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer instructions */}
            {rooms.length > 0 && !loadingRooms && !loadingBookings && !roomsError && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Camera View */}
        {selectedRoom && (
          <div className="flex-1 flex items-center justify-center w-full">
            <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-xl overflow-hidden w-full max-w-2xl mx-auto">
            <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[hsl(var(--primary))] rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedRoom.name || `Phòng ${selectedRoom.code}`}</h2>
                    <p className="text-sm text-gray-500">{selectedRoom.roomTypeName}</p>
                  </div>
                </div>
                <Button variant="secondary" className="h-10 px-4 text-sm rounded-xl" onClick={handleBack}>
                  Quay lại
                </Button>
              </div>
            </CardHeader>
            <CardBody className="p-6">
              {/* Room info */}
              <div className="mb-6">
                <div className="p-4 bg-gradient-to-r from-[hsl(var(--primary))]/10 to-[hsl(var(--primary))]/5 border border-[hsl(var(--primary))]/20 rounded-xl">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[hsl(var(--primary))] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs font-medium text-gray-700">Xác thực khuôn mặt để mở cửa {selectedRoom.name || `phòng ${selectedRoom.code}`}</p>
                  </div>
                </div>
              </div>
              
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 mb-6 border-2 border-gray-200 shadow-inner max-h-[60vh] w-full">
                <WebcamComponent
                  ref={webcamRef}
                  audio={false}
                  className="w-full h-full object-cover"
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.9}
                  videoConstraints={{ facingMode: "user", width: 800, height: 600 }}
                  onUserMedia={() => {
                    setCameraError(null);
                    // Đợi một chút để đảm bảo video element được mount trong Next.js 15
                    setTimeout(() => {
                      const video = webcamRef.current?.video;
                      if (video && video instanceof HTMLVideoElement) {
                        setCameraReady(true);
                      } else {
                        // Retry sau 200ms nếu video chưa sẵn sàng
                        setTimeout(() => {
                          const retryVideo = webcamRef.current?.video;
                          if (retryVideo && retryVideo instanceof HTMLVideoElement) {
                            setCameraReady(true);
                          }
                        }, 200);
                      }
                    }, 100);
                  }}
                  onUserMediaError={() => setCameraError("Không thể truy cập camera")}
                />

              
                {faceBox && (
                  <div
                    className="absolute border-4 border-green-400 rounded-xl pointer-events-none shadow-lg"
                    style={{
                      left: `${faceBox.x * 100}%`,
                      top: `${faceBox.y * 100}%`,
                      width: `${faceBox.width * 100}%`,
                      height: `${faceBox.height * 100}%`,
                      boxSizing: 'border-box',
                    }}
                  />
                )}

                {cameraError && (
                  <div className="absolute inset-0 bg-gray-900/90 flex items-center justify-center">
                    <div className="text-center p-4">
                      <svg className="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-red-400 text-sm font-medium">{cameraError}</p>
                    </div>
                  </div>
                )}

                {result?.message && !result.success && (
                  <div className="absolute inset-0 bg-gray-900/90 flex items-center justify-center p-4">
                    <div className="text-center">
                      <svg className="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <p className="text-red-400 text-sm font-medium text-center">{result.message}</p>
                    </div>
                  </div>
                )}

                {result?.success && (
                  <div className="absolute inset-0 bg-gray-900/95 flex items-center justify-center p-6 z-50">
                    <div className="text-center max-w-md w-full">
                      {/* Success icon */}
                      <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      
                      {/* Success message */}
                      <h2 className="text-3xl font-bold text-white mb-2">Đã mở cửa!</h2>
                      <p className="text-xl text-green-200 mb-1">{selectedRoom?.name || `Phòng ${selectedRoom?.code}`}</p>
                      <p className="text-sm text-gray-300 mb-6">Xác thực khuôn mặt thành công</p>
                      
                      {/* Thông tin check-in */}
                      {getBookingForRoom(selectedRoom!) && (
                        <div className="bg-green-500/90 backdrop-blur-sm rounded-xl p-4 mb-4">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-sm font-semibold text-white">Đã check-in</span>
                          </div>
                          <p className="text-xs text-green-100">Có quyền truy cập</p>
                        </div>
                      )}
                      
                      
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">Hướng dẫn</p>
                      <p className="text-xs text-blue-800 leading-relaxed">
                        {faceStatus === "no-face" && "Không thấy khuôn mặt, vui lòng đưa mặt vào khung oval."}
                        {faceStatus === "off-center" && "Khuôn mặt đang lệch, hãy canh khuôn mặt vào giữa khung oval."}
                        {faceStatus === "too-close" && "Bạn đang quá gần, hãy lùi xa camera một chút."}
                        {faceStatus === "too-far" && "Bạn đang quá xa, hãy tiến lại gần camera hơn."}
                        {faceStatus === "good" && "Vị trí tốt, giữ nguyên khuôn mặt và nhấn nút để chụp và gửi xác thực."}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  variant="primary"
                  className="w-full h-12 text-base font-semibold rounded-xl shadow-sm hover:shadow-md transition-all"
                  onClick={handleOpenDoor}
                  disabled={loading || !!cameraError || faceStatus !== "good"}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Đang xác thực...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                      Xác thực & Mở cửa
                    </>
                  )}
                </Button>
              </div>
            </CardBody>
          </Card>
          </div>
        )}

        {/* Error/Failure - Hiển thị bên dưới camera view */}
        {result && !result.success && selectedRoom && (() => {
          const validBooking = getBookingForRoom(selectedRoom);
          return (
            <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden mt-6">
              <CardBody className="p-8">
                <div className="text-center">
                  {/* Error icon */}
                  <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  
                  {/* Error message */}
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Xác thực thất bại</h2>
                  <p className="text-lg text-gray-900 mb-1">{selectedRoom.name || `Phòng ${selectedRoom.code}`}</p>
                  <p className="text-sm text-gray-500 mb-6">{result.message || 'Xác thực khuôn mặt thất bại'}</p>
                  
                  {/* Card xanh với thông tin phòng */}
                  <div className="bg-green-500 rounded-xl p-5 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-left">
                        <p className="text-base font-bold text-white">
                          {selectedRoom.name || `Phòng ${selectedRoom.code}`}
                        </p>
                        <p className="text-sm text-green-100 mt-1">
                          {validBooking ? 'Có quyền truy cập' : 'Không có quyền truy cập'}
                        </p>
                      </div>
                      {validBooking ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-white">Đã check-in</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-white">Chưa check-in</span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="primary"
                      className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
                      onClick={handleBack}
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                      Mở cửa
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })()}


      </div>
    </div>
  );
}
