"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useAvailableRooms, useRoomTypes } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import type { Room, RoomType } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/hooks/useAuth";
import { getFaceStatus, registerFace } from "@/lib/services";
import { isValidCCCD, isValidEmail, isValidPhone, isValidDateOfBirth, validatePersonalInfo } from "@/lib/utils";
import Image from "next/image";
import roomImage from "@/img/Room.jpg";
import dynamic from "next/dynamic";
import * as faceapi from "face-api.js";

// Dynamic import Webcam để tránh SSR issues
const WebcamComponent = dynamic(
  // @ts-ignore - react-webcam type incompatibility with Next.js dynamic import
  () => import("react-webcam"),
  { 
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white">Đang tải camera...</div>
  }
) as any;

export default function BookRoomPage() {
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [roomTypeId, setRoomTypeId] = useState<number | "">("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Modal states
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [faceStatus, setFaceStatus] = useState<{ registered: boolean; loading: boolean }>({ registered: false, loading: false });
  
  // Separate dates for confirmation modal
  const [modalCheckin, setModalCheckin] = useState("");
  const [modalCheckout, setModalCheckout] = useState("");
  
  // Multi-step form states
  const [currentStep, setCurrentStep] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [personalInfo, setPersonalInfo] = useState({
    fullName: "",
    dateOfBirth: "",
    cccd: "",
    phone: "",
    email: "",
  });
  const [showContactFields, setShowContactFields] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceDetecting, setFaceDetecting] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedImages, setCapturedImages] = useState<{
    faceFront: string | null;
    faceLeft: string | null;
    faceRight: string | null;
    cccdFront: string | null;
    cccdBack: string | null;
  }>({
    faceFront: null,
    faceLeft: null,
    faceRight: null,
    cccdFront: null,
    cccdBack: null,
  });
  const [currentPhotoStep, setCurrentPhotoStep] = useState<1 | 2 | 3 | 4 | 5>(1); // 1: faceFront, 2: faceLeft, 3: faceRight, 4: cccdFront, 5: cccdBack
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const webcamRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stableFaceCountRef = useRef<number>(0);
  
  const { user } = useAuth();

  const { data: roomsData, loading: roomsLoading } = useAvailableRooms(
    checkin || undefined,
    checkout || undefined
  );
  const { data: roomTypesData, loading: roomTypesLoading } = useRoomTypes();

  const rooms = useMemo(() => {
    if (!roomsData) return [];
    const roomList = Array.isArray(roomsData) ? roomsData : (roomsData as any).items || (roomsData as any).data?.content || [];
    return roomList;
  }, [roomsData]);

  const roomTypes = useMemo(() => {
    if (!roomTypesData) return [];
    return Array.isArray(roomTypesData) ? roomTypesData : (roomTypesData as any).items || [];
  }, [roomTypesData]);

  const filteredRooms = useMemo(() => {
    return rooms;
  }, [rooms]);

  // Auto-hide flash messages
  useEffect(() => {
    if (flash) {
      const timer = setTimeout(() => setFlash(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [flash]);

  // Initialize personal info from user
  useEffect(() => {
    if (user) {
      setPersonalInfo({
        fullName: user?.name || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "") || "",
        dateOfBirth: user?.dob || "",
        cccd: "",
        phone: user?.phoneNumber || "",
        email: user?.email || "",
      });
      if (user?.email || user?.phoneNumber) {
        setShowContactFields(false);
      }
    }
  }, [user]);

  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Error loading face-api models:", err);
        setFormError("Không thể tải mô hình nhận diện khuôn mặt. Vui lòng thử lại.");
      }
    };
    
    loadModels();
  }, []);

  // Face detection when camera is active (only for face photos, not CCCD)
  useEffect(() => {
    const isFacePhoto = currentPhotoStep <= 3; // Steps 1-3 are face photos
    const currentImage = currentPhotoStep === 1 ? capturedImages.faceFront 
      : currentPhotoStep === 2 ? capturedImages.faceLeft 
      : currentPhotoStep === 3 ? capturedImages.faceRight 
      : null;
    
    if (showCamera && modelsLoaded && webcamRef.current && canvasRef.current && isFacePhoto && !currentImage) {
      const STABLE_THRESHOLD = 15; // Giảm xuống 15 frames (1.5 giây) để nhanh hơn
      stableFaceCountRef.current = 0;
      let isCapturing = false; // Flag để tránh chụp nhiều lần
      
      const detectFace = async () => {
        if (!webcamRef.current || !canvasRef.current || currentImage || isCapturing) return;
        
        try {
          const video = webcamRef.current.video;
          if (!video || video.readyState !== 4) return;

          const displaySize = { width: video.width, height: video.height };
          canvasRef.current.width = displaySize.width;
          canvasRef.current.height = displaySize.height;

          const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();

          const ctx = canvasRef.current.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            
            if (detections.length === 1) {
              const detection = detections[0];
              const box = detection.detection.box;
              
              ctx.strokeStyle = "#00ff00";
              ctx.lineWidth = 2;
              ctx.strokeRect(box.x, box.y, box.width, box.height);
              
              if (detection.landmarks) {
                ctx.fillStyle = "#00ff00";
                detection.landmarks.positions.forEach((point: any) => {
                  ctx.beginPath();
                  ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
                  ctx.fill();
                });
              }
              
              setFaceDetected(true);
              stableFaceCountRef.current++;
              
              // Hiển thị progress bar ở dưới cùng
              const progress = Math.min((stableFaceCountRef.current / STABLE_THRESHOLD) * 100, 100);
              ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
              ctx.fillRect(0, displaySize.height - 8, (displaySize.width * progress) / 100, 8);
              
              // Hiển thị countdown số lớn ở giữa
              const remaining = Math.max(0, STABLE_THRESHOLD - stableFaceCountRef.current);
              if (remaining > 0) {
                ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
                ctx.fillRect(displaySize.width / 2 - 40, displaySize.height / 2 - 30, 80, 60);
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 36px Arial";
                ctx.textAlign = "center";
                ctx.fillText(`${remaining}`, displaySize.width / 2, displaySize.height / 2 + 10);
              }
              
              // Tự động chụp khi đạt ngưỡng
              if (!faceDetecting && !currentImage && stableFaceCountRef.current >= STABLE_THRESHOLD && !isCapturing) {
                isCapturing = true;
                stableFaceCountRef.current = 0;
                // Gọi capturePhoto ngay lập tức
                setTimeout(() => {
                  if (webcamRef.current && !currentImage) {
                    capturePhoto();
                  }
                }, 50);
              }
            } else if (detections.length === 0) {
              setFaceDetected(false);
              stableFaceCountRef.current = 0;
            } else {
              setFaceDetected(false);
              stableFaceCountRef.current = 0;
              ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
              ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              ctx.fillStyle = "#ffffff";
              ctx.font = "20px Arial";
              ctx.textAlign = "center";
              ctx.fillText("Phát hiện nhiều khuôn mặt. Vui lòng chỉ có 1 người trong khung hình.", displaySize.width / 2, displaySize.height / 2);
            }
          }
        } catch (err) {
          console.error("Face detection error:", err);
        }
      };

      detectionIntervalRef.current = setInterval(detectFace, 100);
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      stableFaceCountRef.current = 0;
    };
  }, [showCamera, modelsLoaded, currentPhotoStep, capturedImages, faceDetecting]);

  const capturePhoto = () => {
    // For CCCD photos (steps 4-5), no face detection required
    const isFacePhoto = currentPhotoStep <= 3;
    
    if (isFacePhoto && (!webcamRef.current || !faceDetected)) {
      setFormError("Vui lòng đảm bảo có đúng 1 khuôn mặt trong khung hình");
      return;
    }

    if (!webcamRef.current) {
      setFormError("Camera chưa sẵn sàng");
      return;
    }

    try {
      setFaceDetecting(true);
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        // Save to appropriate key based on current step
        const imageKey = currentPhotoStep === 1 ? 'faceFront'
          : currentPhotoStep === 2 ? 'faceLeft'
          : currentPhotoStep === 3 ? 'faceRight'
          : currentPhotoStep === 4 ? 'cccdFront'
          : 'cccdBack';
        
        setCapturedImages(prev => ({ ...prev, [imageKey]: imageSrc }));
        
        // Stop detection interval for face photos
        if (isFacePhoto && detectionIntervalRef.current) {
          clearInterval(detectionIntervalRef.current);
        }
        
        // Move to next step or finish
        if (currentPhotoStep < 5) {
          setCurrentPhotoStep((currentPhotoStep + 1) as 1 | 2 | 3 | 4 | 5);
          setFaceDetected(false);
          stableFaceCountRef.current = 0;
        } else {
          // All photos captured, move to confirmation step
          setShowCamera(false);
          setCurrentStep(3);
        }
      } else {
        setFormError("Không thể chụp ảnh");
      }
    } catch (err) {
      console.error("Capture error:", err);
      setFormError("Lỗi khi chụp ảnh");
    } finally {
      setFaceDetecting(false);
    }
  };

  const handleStep1Next = () => {
    const validation = validatePersonalInfo(personalInfo);
    
    if (!validation.isValid) {
      setFormError(validation.errors[0]); // Hiển thị lỗi đầu tiên
      return;
    }

    setFormError(null);
    setCurrentStep(2);
    setCurrentPhotoStep(1);
    setCapturedImages({
      faceFront: null,
      faceLeft: null,
      faceRight: null,
      cccdFront: null,
      cccdBack: null,
    });
    setShowCamera(true);
  };

  const handleStep2Next = () => {
    // Check if all 5 photos are captured
    const allCaptured = capturedImages.faceFront && 
      capturedImages.faceLeft && 
      capturedImages.faceRight && 
      capturedImages.cccdFront && 
      capturedImages.cccdBack;
    
    if (!allCaptured) {
      setFormError("Vui lòng chụp đầy đủ 5 ảnh: khuôn mặt chính diện, trái, phải, CCCD mặt trước và mặt sau");
      return;
    }
    setFormError(null);
    setShowCamera(false);
    setCurrentStep(3);
  };

  const handleConfirmBookingWithFace = async () => {
    // Validate lại tất cả thông tin trước khi submit
    const validation = validatePersonalInfo(personalInfo);
    if (!validation.isValid) {
      setFormError(validation.errors[0]);
      return;
    }

    // Check if all 5 photos are captured
    const allCaptured = capturedImages.faceFront && 
      capturedImages.faceLeft && 
      capturedImages.faceRight && 
      capturedImages.cccdFront && 
      capturedImages.cccdBack;
    
    if (!allCaptured) {
      setFormError("Vui lòng chụp đầy đủ 5 ảnh: khuôn mặt chính diện, trái, phải, CCCD mặt trước và mặt sau");
      return;
    }
    
    if (!selectedRoom) {
      setFormError("Phòng không hợp lệ");
      return;
    }
    if (!modalCheckin || !modalCheckout) {
      setFormError("Vui lòng chọn ngày check-in và check-out");
      return;
    }

    // Validate dates
    const checkinDate = new Date(modalCheckin);
    const checkoutDate = new Date(modalCheckout);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkinDate < today) {
      setFormError("Ngày check-in không thể là ngày trong quá khứ");
      return;
    }
    if (checkoutDate <= checkinDate) {
      setFormError("Ngày check-out phải sau ngày check-in");
      return;
    }

    try {
      setBookingLoading(true);
      setFormError(null);

      const bookingData = {
        roomId: selectedRoom.id,
        checkinDate: modalCheckin,
        checkoutDate: modalCheckout,
        numGuests: 1,
      };
      
      const bookingResponse = await apiClient.createBooking(bookingData);
      
      if (!bookingResponse.success) {
        throw new Error(bookingResponse.error || "Đặt phòng thất bại");
      }

      const booking = bookingResponse.data as any;
      const bookingId = booking?.id || booking?.bookingId || 0;

      // Đăng ký khuôn mặt với tất cả ảnh khuôn mặt (backend yêu cầu 3-5 ảnh)
      const formData = new FormData();
      
      // Helper function to convert base64 to File
      const base64ToFile = async (base64: string, filename: string): Promise<File> => {
        const response = await fetch(base64);
        const blob = await response.blob();
        return new File([blob], filename, { type: "image/jpeg" });
      };

      // Backend expects "images" parameter (List<MultipartFile>)
      // Add face images (3 face photos are required, CCCD is optional)
      const faceImageFiles: File[] = [];
      
      if (capturedImages.faceFront) {
        const file = await base64ToFile(capturedImages.faceFront, `face-front-${Date.now()}.jpg`);
        faceImageFiles.push(file);
      }
      if (capturedImages.faceLeft) {
        const file = await base64ToFile(capturedImages.faceLeft, `face-left-${Date.now()}.jpg`);
        faceImageFiles.push(file);
      }
      if (capturedImages.faceRight) {
        const file = await base64ToFile(capturedImages.faceRight, `face-right-${Date.now()}.jpg`);
        faceImageFiles.push(file);
      }

      // Ensure we have at least 3 face images (backend requirement)
      if (faceImageFiles.length < 3) {
        // If we don't have 3 different angles, duplicate the front image
        while (faceImageFiles.length < 3 && capturedImages.faceFront) {
          const file = await base64ToFile(capturedImages.faceFront, `face-${Date.now()}-${faceImageFiles.length}.jpg`);
          faceImageFiles.push(file);
        }
      }

      // Add all face images to "images" parameter (backend expects this)
      faceImageFiles.forEach((file) => {
        formData.append("images", file);
      });

      // Note: CCCD images are not sent to face recognition API
      // They might be stored separately if needed for identity verification

      await registerFace(bookingId, formData);

      setFlash({ type: 'success', text: 'Đặt phòng thành công! Vui lòng chờ xác nhận.' });
      setConfirmModalOpen(false);
      setSelectedRoom(null);
      setModalCheckin("");
      setModalCheckout("");
      setCurrentStep(1);
      setCurrentPhotoStep(1);
      setCapturedImages({
        faceFront: null,
        faceLeft: null,
        faceRight: null,
        cccdFront: null,
        cccdBack: null,
      });
      setCapturedImage(null);
      setPersonalInfo({
        fullName: user?.name || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "") || "",
        dateOfBirth: user?.dob || "",
        cccd: "",
        phone: user?.phoneNumber || "",
        email: user?.email || "",
      });
    } catch (err: any) {
      console.error("Booking error:", err);
      setFormError(err?.message || "Có lỗi xảy ra khi đặt phòng");
    } finally {
      setBookingLoading(false);
    }
  };

  // Open detail modal
  const handleViewDetails = (room: Room) => {
    setSelectedRoom(room);
    setDetailModalOpen(true);
  };

  // Open confirm modal and reset form
  const handleBookRoom = async (room: Room) => {
    // Validate dates if provided
    if (checkin && checkout) {
      const checkinDate = new Date(checkin);
      const checkoutDate = new Date(checkout);
      if (checkoutDate <= checkinDate) {
        setFlash({ type: 'error', text: 'Ngày check-out phải sau ngày check-in' });
        return;
      }
    }

    setSelectedRoom(room);
    setModalCheckin(checkin);
    setModalCheckout(checkout);
    setConfirmModalOpen(true);
    setCurrentStep(1);
    setCurrentPhotoStep(1);
    setCapturedImage(null);
    setCapturedImages({
      faceFront: null,
      faceLeft: null,
      faceRight: null,
      cccdFront: null,
      cccdBack: null,
    });
    setFormError(null);
    setShowCamera(false);
    setFaceDetected(false);
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    setPersonalInfo({
      fullName: user?.name || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "") || "",
      dateOfBirth: user?.dob || "",
      cccd: "",
      phone: user?.phoneNumber || "",
      email: user?.email || "",
    });
  };

  // Confirm booking
  const handleConfirmBooking = async () => {
    if (!selectedRoom) return;

    // Require dates to be selected in modal
    if (!modalCheckin || !modalCheckout) {
      setFlash({ type: 'error', text: 'Vui lòng chọn ngày check-in và check-out' });
      return;
    }

    const checkinDate = new Date(modalCheckin);
    const checkoutDate = new Date(modalCheckout);
    if (checkoutDate <= checkinDate) {
      setFlash({ type: 'error', text: 'Ngày check-out phải sau ngày check-in' });
      return;
    }

    try {
      setBookingLoading(true);
      const bookingData = {
        roomId: selectedRoom.id,
        checkinDate: modalCheckin,
        checkoutDate: modalCheckout,
        numGuests: 1,
      };
      const response = await apiClient.createBooking(bookingData);
      if (response.success) {
        setFlash({ type: 'success', text: 'Đặt phòng thành công! Vui lòng chờ xác nhận.' });
        setConfirmModalOpen(false);
        setSelectedRoom(null);
        setModalCheckin("");
        setModalCheckout("");
        // Don't reset page filter dates
      } else {
        setFlash({ type: 'error', text: response.error || "Đặt phòng thất bại" });
      }
    } catch (error: any) {
      setFlash({ type: 'error', text: error?.message || "Có lỗi xảy ra khi đặt phòng" });
      console.error(error);
    } finally {
      setBookingLoading(false);
    }
  };

  // Calculate number of nights
  const calculateNights = () => {
    if (!checkin || !checkout) return 0;
    const checkinDate = new Date(checkin);
    const checkoutDate = new Date(checkout);
    const diffTime = Math.abs(checkoutDate.getTime() - checkinDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getRoomStatusBadge = (status: string): "available" | "occupied" | "maintenance" => {
    if (status === "AVAILABLE") return "available";
    if (status === "OCCUPIED") return "occupied";
    return "maintenance";
  };

  return (
    <div className="px-4 lg:px-6 py-6">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">Đặt phòng</p>
        <h1 className="text-2xl font-bold text-gray-900">Tìm và đặt phòng</h1>
        <p className="text-sm text-gray-600 mt-2">
          Chọn ngày và loại phòng để xem danh sách phòng khả dụng
        </p>
      </div>

      {flash && (
        <div className={`mb-4 p-3 rounded-lg ${
          flash.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {flash.text}
        </div>
      )}

      {/* Filter section - Header */}
      <Card className="mb-6">
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ngày nhận phòng
              </label>
              <Input
                type="date"
                value={checkin}
                onChange={(e) => setCheckin(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ngày trả phòng
              </label>
              <Input
                type="date"
                value={checkout}
                onChange={(e) => setCheckout(e.target.value)}
                min={checkin || new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="flex items-end">
              {(checkin || checkout) ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCheckin("");
                    setCheckout("");
                  }}
                  className="w-full"
                >
                  Xóa bộ lọc
                </Button>
              ) : (
                <div className="w-full">
                  {checkin && checkout && calculateNights() > 0 && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-600 font-medium text-center">
                        <span className="font-bold">{calculateNights()}</span> đêm
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {checkin && checkout && calculateNights() > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <span className="font-medium">Số đêm:</span>
                <span className="font-bold text-[hsl(var(--primary))]">{calculateNights()}</span>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

        {/* Available rooms */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Phòng khả dụng</h2>
              <p className="text-sm text-gray-500 mt-1">
                {checkin && checkout 
                  ? `Tìm thấy ${filteredRooms.length} phòng từ ${new Date(checkin).toLocaleDateString("vi-VN")} đến ${new Date(checkout).toLocaleDateString("vi-VN")}`
                  : "Chọn ngày để xem phòng khả dụng"}
              </p>
            </div>
            {filteredRooms.length > 0 && (
              <Badge tone="info" className="text-sm px-3 py-1">
                {filteredRooms.length} phòng
              </Badge>
            )}
          </div>

          {roomsLoading ? (
            <Card>
              <CardBody>
                <div className="py-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(var(--primary))] mb-3"></div>
                  <p className="text-sm text-gray-500">Đang tải danh sách phòng...</p>
                </div>
              </CardBody>
            </Card>
          ) : filteredRooms.length === 0 ? (
            <Card>
              <CardBody>
                <div className="py-12 text-center">
                  <p className="text-sm text-gray-500 font-medium">
                    {checkin && checkout
                      ? "Không có phòng phù hợp với bộ lọc của bạn"
                      : "Vui lòng chọn ngày check-in và check-out để xem phòng khả dụng"}
                  </p>
                  {checkin && checkout && (
                    <p className="text-xs text-gray-400 mt-2">
                      Thử thay đổi bộ lọc hoặc chọn khoảng thời gian khác
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((room: Room) => {
                const roomType = roomTypes.find((rt: RoomType) => rt.id === room.roomTypeId);
                const isAvailable = room.status === "AVAILABLE";
                const canBook = isAvailable && !bookingLoading;
                const totalPrice = roomType && checkin && checkout 
                  ? roomType.basePrice * calculateNights() 
                  : roomType?.basePrice || 0;

                return (
                  <Card key={room.id} className={`transition-all hover:shadow-lg overflow-hidden border-gray-200 ${
                    !isAvailable ? 'opacity-75' : ''
                  }`}>
                    {/* Room thumbnail with overlay info */}
                    <div className="relative w-full h-48 overflow-hidden">
                      <Image
                        src={roomImage}
                        alt={room.code}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      {/* Gradient overlay for better text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
                      
                      {/* Room info overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <h3 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                {room.name ? `Phòng ${room.name}` : `Phòng ${room.code}`}
                              </h3>
                              {roomType && (
                                <Badge tone="default" className="text-xs font-medium px-2 py-0.5 bg-white text-gray-900 border-0 shadow-md">
                                  {roomType.name}
                                </Badge>
                              )}
                            </div>
                            {roomType && (
                              <div className="text-sm font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                Giá: {roomType.basePrice === 0 || !roomType.basePrice 
                                  ? <span className="text-green-300 font-bold">miễn phí</span>
                                  : <span className="text-white">{roomType.basePrice.toLocaleString("vi-VN")} VNĐ/tháng</span>}
                              </div>
                            )}
                          </div>
                          {isAvailable && (
                            <Badge tone="success" className="text-xs font-semibold px-2.5 py-1 bg-white text-green-700 border-0 shadow-md shrink-0">
                              Còn trống
                            </Badge>
                          )}
                          {!isAvailable && (
                            <Badge tone={getRoomStatusBadge(room.status)} className="text-xs font-semibold px-2.5 py-1 bg-white border-0 shadow-md shrink-0">
                              {room.status === "OCCUPIED" ? "Đang ở" : "Bảo trì"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <CardBody className="p-5">
                      <div className="space-y-4">
                        {/* Total price if dates selected */}
                        {checkin && checkout && calculateNights() > 0 && roomType && (
                          <div className="pt-2 border-t border-gray-200">
                            {roomType.basePrice > 0 ? (
                              <>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-gray-600 text-sm">Tổng cộng:</span>
                                  <span className="text-lg font-bold text-[hsl(var(--primary))]">
                                    {totalPrice.toLocaleString("vi-VN")} VNĐ
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500">
                                  {calculateNights()} đêm × {roomType.basePrice.toLocaleString("vi-VN")} VNĐ/tháng
                                </p>
                              </>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600 text-sm">Tổng cộng:</span>
                                <span className="text-lg font-bold text-green-600">
                                  Miễn phí
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-3 pt-2">
                          <Button
                            variant="primary"
                            className="flex-1 text-sm font-semibold"
                            onClick={() => handleViewDetails(room)}
                          >
                            Xem chi tiết
                          </Button>
                          <Button
                            onClick={() => handleBookRoom(room)}
                            disabled={!canBook}
                            variant={canBook ? "secondary" : "secondary"}
                            className="flex-1 text-sm font-semibold"
                          >
                            {bookingLoading ? (
                              <span className="flex items-center gap-2">
                                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></span>
                                Đang xử lý...
                              </span>
                            ) : !isAvailable ? (
                              "Không khả dụng"
                            ) : (
                              "Đặt phòng"
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      {/* Room Detail Modal */}
      <Modal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={selectedRoom ? `Chi tiết phòng ${selectedRoom.code}` : "Chi tiết phòng"}
        size="lg"
      >
        {selectedRoom && (() => {
          const roomType = roomTypes.find((rt: RoomType) => rt.id === selectedRoom.roomTypeId);
          const isAvailable = selectedRoom.status === "AVAILABLE";
          const canBook = isAvailable && checkin && checkout && !bookingLoading;
          
          return (
            <div className="space-y-4">
              {/* Large image */}
              <div className="relative w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden">
                <Image
                  src={roomImage}
                  alt={selectedRoom.code}
                  fill
                  className="object-cover rounded-lg"
                  sizes="(max-width: 768px) 100vw, 768px"
                />
                {isAvailable && (
                  <div className="absolute top-4 right-4">
                    <Badge tone="success">
                      Còn trống
                    </Badge>
                  </div>
                )}
              </div>

              {/* Room info */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-2xl font-bold text-gray-900">
                      {selectedRoom.name ? `Phòng ${selectedRoom.name}` : `Phòng ${selectedRoom.code}`}
                    </h3>
                    {roomType && (
                      <Badge tone="default">{roomType.name}</Badge>
                    )}
                  </div>
                  {checkin && checkout && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">Ngày khả dụng:</span>{" "}
                      <span>{new Date(checkin).toLocaleDateString("vi-VN")} - {new Date(checkout).toLocaleDateString("vi-VN")}</span>
                    </div>
                  )}
                </div>

                {roomType && (
                  <div className="space-y-2 text-sm">
                    <div className="text-gray-600">
                      <span>Sức chứa: <strong className="text-gray-900">{roomType.maxOccupancy} người</strong></span>
                    </div>
                    <div className="text-gray-600">
                      <span>Giá: <strong className="text-gray-900">
                        {roomType.basePrice === 0 || !roomType.basePrice 
                          ? "miễn phí" 
                          : `${roomType.basePrice.toLocaleString("vi-VN")} VNĐ/tháng`}
                      </strong></span>
                    </div>
                  </div>
                )}

                {/* Amenities description */}
                <div className="pt-3 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-2">Mô tả tiện nghi:</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    {selectedRoom.description ? (
                      <p>{selectedRoom.description}</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div>Điều hòa nhiệt độ</div>
                        <div>WiFi miễn phí</div>
                        <div>Nước nóng</div>
                        <div>Giường đôi</div>
                        <div>Tủ quần áo</div>
                        <div>Bàn làm việc</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              setDetailModalOpen(false);
              if (selectedRoom) {
                handleBookRoom(selectedRoom);
              }
            }}
            disabled={selectedRoom?.status !== "AVAILABLE"}
          >
            Đặt ngay
          </Button>
        </div>
      </Modal>

      {/* Booking Multi-Step Form Modal */}
      <Modal
        open={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setSelectedRoom(null);
          setModalCheckin("");
          setModalCheckout("");
          setCurrentStep(1);
          setCurrentPhotoStep(1);
          setCapturedImage(null);
          setCapturedImages({
            faceFront: null,
            faceLeft: null,
            faceRight: null,
            cccdFront: null,
            cccdBack: null,
          });
          setShowCamera(false);
          setFaceDetected(false);
          if (detectionIntervalRef.current) {
            clearInterval(detectionIntervalRef.current);
          }
        }}
        title="Đặt phòng"
        size="lg"
      >
        {selectedRoom && modalCheckin && modalCheckout ? (
          <div className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  currentStep >= 1 ? "bg-[hsl(var(--primary))] text-white" : "bg-gray-200 text-gray-600"
                }`}>
                  1
                </div>
                <div className={`flex-1 h-1 ${currentStep >= 2 ? "bg-[hsl(var(--primary))]" : "bg-gray-200"}`} />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  currentStep >= 2 ? "bg-[hsl(var(--primary))] text-white" : "bg-gray-200 text-gray-600"
                }`}>
                  2
                </div>
                <div className={`flex-1 h-1 ${currentStep >= 3 ? "bg-[hsl(var(--primary))]" : "bg-gray-200"}`} />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  currentStep >= 3 ? "bg-[hsl(var(--primary))] text-white" : "bg-gray-200 text-gray-600"
                }`}>
                  3
                </div>
              </div>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
                {formError}
              </div>
            )}

            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Thông tin cá nhân</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Họ tên <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={personalInfo.fullName}
                    onChange={(e) => setPersonalInfo({ ...personalInfo, fullName: e.target.value })}
                    placeholder="Nhập họ tên"
                  />
                  </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Ngày sinh
                  </label>
                  <Input
                    type="date"
                    value={personalInfo.dateOfBirth}
                    onChange={(e) => {
                      setPersonalInfo({ ...personalInfo, dateOfBirth: e.target.value });
                      if (formError && formError.includes("Ngày sinh")) {
                        setFormError(null);
                      }
                    }}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  {user?.dob && (
                    <p className="text-xs text-gray-500 mt-1">Tự động điền từ thông tin đã xác thực</p>
                  )}
                  {personalInfo.dateOfBirth && !isValidDateOfBirth(personalInfo.dateOfBirth) && (
                    <p className="text-xs text-red-500 mt-1">Ngày sinh không hợp lệ</p>
                  )}
                </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Số CCCD / CMND <span className="text-red-500">*</span>
                </label>
                  <Input
                    type="text"
                    value={personalInfo.cccd}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ''); // Chỉ cho phép số
                      setPersonalInfo({ ...personalInfo, cccd: value });
                      if (formError && formError.includes("CCCD")) {
                        setFormError(null);
                      }
                    }}
                    placeholder="Nhập số CCCD/CMND (9 hoặc 12 chữ số)"
                    maxLength={12}
                  />
                  {personalInfo.cccd && !isValidCCCD(personalInfo.cccd) && (
                    <p className="text-xs text-red-500 mt-1">Số CCCD/CMND phải có 9 hoặc 12 chữ số</p>
                  )}
                </div>

                {showContactFields && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Số điện thoại
                      </label>
                      <Input
                        type="tel"
                        value={personalInfo.phone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d+]/g, ''); // Chỉ cho phép số và dấu +
                          setPersonalInfo({ ...personalInfo, phone: value });
                          if (formError && formError.includes("điện thoại")) {
                            setFormError(null);
                          }
                        }}
                        placeholder="Nhập số điện thoại (VD: 0912345678 hoặc +84912345678)"
                        maxLength={13}
                      />
                      {personalInfo.phone && !isValidPhone(personalInfo.phone) && (
                        <p className="text-xs text-red-500 mt-1">Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam</p>
                      )}
              </div>

              <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Email
                </label>
                      <Input
                        type="email"
                        value={personalInfo.email}
                        onChange={(e) => {
                          setPersonalInfo({ ...personalInfo, email: e.target.value });
                          if (formError && formError.includes("Email")) {
                            setFormError(null);
                          }
                        }}
                        placeholder="Nhập email"
                      />
                      {personalInfo.email && !isValidEmail(personalInfo.email) && (
                        <p className="text-xs text-red-500 mt-1">Email không hợp lệ</p>
                      )}
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" onClick={() => {
                    setConfirmModalOpen(false);
                    setSelectedRoom(null);
                    setModalCheckin("");
                    setModalCheckout("");
                  }} className="flex-1">
                    Hủy
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={handleStep1Next} 
                    className="flex-1"
                    disabled={!validatePersonalInfo(personalInfo).isValid}
                  >
                    Tiếp theo
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Photo Capture (5 photos) */}
            {currentStep === 2 && (() => {
              const photoSteps = [
                { num: 1, title: "Khuôn mặt chính diện", key: "faceFront" as const },
                { num: 2, title: "Khuôn mặt trái", key: "faceLeft" as const },
                { num: 3, title: "Khuôn mặt phải", key: "faceRight" as const },
                { num: 4, title: "CCCD mặt trước", key: "cccdFront" as const },
                { num: 5, title: "CCCD mặt sau", key: "cccdBack" as const },
              ];
              
              const currentStepInfo = photoSteps[currentPhotoStep - 1];
              const currentImage = capturedImages[currentStepInfo.key];
              const isFacePhoto = currentPhotoStep <= 3;
              const allCaptured = capturedImages.faceFront && 
                capturedImages.faceLeft && 
                capturedImages.faceRight && 
                capturedImages.cccdFront && 
                capturedImages.cccdBack;
              
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Chụp ảnh</h3>
                    <Badge tone="info" className="text-sm">
                      {currentPhotoStep}/5
                    </Badge>
                  </div>
                  
                  {/* Progress indicator */}
                  <div className="flex items-center gap-2 mb-4">
                    {photoSteps.map((step, idx) => (
                      <div key={step.num} className="flex-1 flex items-center">
                        <div className={`flex-1 h-2 rounded-full ${
                          idx < currentPhotoStep - 1 ? 'bg-green-500' :
                          idx === currentPhotoStep - 1 ? 'bg-[hsl(var(--primary))]' :
                          'bg-gray-200'
                        }`} />
                        {idx < photoSteps.length - 1 && (
                          <div className={`w-2 h-2 rounded-full mx-1 ${
                            idx < currentPhotoStep - 1 ? 'bg-green-500' :
                            idx === currentPhotoStep - 1 ? 'bg-[hsl(var(--primary))]' :
                            'bg-gray-200'
                          }`} />
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-4">
                    <p className="text-sm font-medium text-blue-900">
                      Bước {currentPhotoStep}/5: {currentStepInfo.title}
                    </p>
                  </div>
                  
                  {showCamera && (isFacePhoto ? modelsLoaded : true) ? (
                    <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                      <WebcamComponent
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{
                          facingMode: currentPhotoStep <= 3 ? "user" : { exact: "environment" },
                          width: 1280,
                          height: 720,
                        }}
                        className="w-full h-full object-cover"
                      />
                      {isFacePhoto && (
                        <canvas
                          ref={canvasRef}
                          className="absolute inset-0 pointer-events-none"
                          style={{ width: '100%', height: '100%' }}
                        />
                      )}
                      
                      {isFacePhoto && !faceDetected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <div className="text-white text-center p-4">
                            <p className="text-lg font-semibold mb-2">Đang chờ nhận diện khuôn mặt...</p>
                            <p className="text-sm">
                              {currentPhotoStep === 1 && "Vui lòng nhìn thẳng vào camera"}
                              {currentPhotoStep === 2 && "Vui lòng quay mặt sang trái"}
                              {currentPhotoStep === 3 && "Vui lòng quay mặt sang phải"}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {isFacePhoto && faceDetected && (
                        <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          ✓ Đã phát hiện khuôn mặt
                        </div>
                      )}
                      
                      {!isFacePhoto && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="text-white text-center p-4 bg-black/50 rounded-lg">
                            <p className="text-lg font-semibold mb-2">
                              {currentPhotoStep === 4 && "Chụp mặt trước CCCD"}
                              {currentPhotoStep === 5 && "Chụp mặt sau CCCD"}
                            </p>
                            <p className="text-sm">Đảm bảo ảnh rõ ràng, đầy đủ thông tin</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : showCamera && isFacePhoto && !modelsLoaded ? (
                    <div className="bg-gray-900 rounded-lg flex items-center justify-center text-white p-12" style={{ aspectRatio: '4/3' }}>
                      <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-3"></div>
                        <p>Đang tải mô hình nhận diện...</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Preview of captured images */}
                  {Object.values(capturedImages).some(img => img !== null) && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">Ảnh đã chụp:</p>
                      <div className="grid grid-cols-5 gap-2">
                        {photoSteps.map((step) => {
                          const img = capturedImages[step.key];
                          return (
                            <div key={step.num} className="relative">
                              {img ? (
                                <img 
                                  src={img} 
                                  alt={step.title} 
                                  className="w-full aspect-square object-cover rounded border-2 border-green-500" 
                                />
                              ) : (
                                <div className="w-full aspect-square bg-gray-200 rounded border-2 border-gray-300 flex items-center justify-center">
                                  <span className="text-xs text-gray-400">{step.num}</span>
                                </div>
                              )}
                              <p className="text-xs text-gray-600 mt-1 text-center">{step.title}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 text-sm text-gray-600">
                    <p><strong>Hướng dẫn:</strong></p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      {currentPhotoStep === 1 && (
                        <>
                          <li>Nhìn thẳng vào camera, không nghiêng đầu</li>
                          <li>Đảm bảo ánh sáng đủ và rõ ràng</li>
                          <li>Không đeo khẩu trang hoặc che khuất khuôn mặt</li>
                          <li>Hệ thống sẽ tự động chụp sau 1.5 giây khi phát hiện ổn định</li>
                        </>
                      )}
                      {currentPhotoStep === 2 && (
                        <>
                          <li>Quay mặt sang trái một góc khoảng 45 độ</li>
                          <li>Giữ nguyên tư thế, không di chuyển</li>
                          <li>Đảm bảo toàn bộ khuôn mặt trong khung hình</li>
                          <li>Hệ thống sẽ tự động chụp sau 1.5 giây khi phát hiện ổn định</li>
                        </>
                      )}
                      {currentPhotoStep === 3 && (
                        <>
                          <li>Quay mặt sang phải một góc khoảng 45 độ</li>
                          <li>Giữ nguyên tư thế, không di chuyển</li>
                          <li>Đảm bảo toàn bộ khuôn mặt trong khung hình</li>
                          <li>Hệ thống sẽ tự động chụp sau 1.5 giây khi phát hiện ổn định</li>
                        </>
                      )}
                      {currentPhotoStep === 4 && (
                        <>
                          <li>Đặt CCCD/CMND phẳng, không bị cong</li>
                          <li>Đảm bảo ánh sáng đủ, không bị phản quang</li>
                          <li>Chụp toàn bộ mặt trước của CCCD/CMND</li>
                          <li>Ảnh phải rõ ràng, đọc được tất cả thông tin</li>
                        </>
                      )}
                      {currentPhotoStep === 5 && (
                        <>
                          <li>Lật CCCD/CMND sang mặt sau</li>
                          <li>Đặt phẳng, không bị cong</li>
                          <li>Chụp toàn bộ mặt sau của CCCD/CMND</li>
                          <li>Ảnh phải rõ ràng, đọc được tất cả thông tin</li>
                        </>
                      )}
                    </ul>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button 
                      variant="secondary" 
                      onClick={() => { 
                        setCurrentStep(1); 
                        setShowCamera(false);
                        setCurrentPhotoStep(1);
                      }} 
                      className="flex-1"
                    >
                      Quay lại
                    </Button>
                    {allCaptured ? (
                      <Button variant="primary" onClick={handleStep2Next} className="flex-1">
                        Hoàn tất
                      </Button>
                    ) : (
                      <Button 
                        variant="primary" 
                        onClick={capturePhoto} 
                        disabled={(isFacePhoto && !faceDetected) || faceDetecting} 
                        className="flex-1"
                      >
                        {faceDetecting ? "Đang xử lý..." : currentImage ? "Chụp lại" : "Chụp ảnh"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Step 3: Confirmation */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Xác nhận & hoàn tất</h3>
                
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tên người đặt:</span>
                        <span className="font-medium text-gray-900">{personalInfo.fullName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Thời gian đặt phòng:</span>
                        <span className="font-medium text-gray-900">
                          {new Date().toLocaleString("vi-VN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mã phòng:</span>
                        <span className="font-medium text-gray-900">{selectedRoom.code}</span>
                      </div>
                      {selectedRoom.name && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tên phòng:</span>
                          <span className="font-medium text-gray-900">{selectedRoom.name}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                      <span className="text-gray-600">Check-in:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(modalCheckin).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                      <div className="flex justify-between">
                      <span className="text-gray-600">Check-out:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(modalCheckout).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                          </div>
                  </div>

                  {/* Preview all captured images */}
                  {(capturedImages.faceFront || capturedImages.faceLeft || capturedImages.faceRight || capturedImages.cccdFront || capturedImages.cccdBack) && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Ảnh đã chụp:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {capturedImages.faceFront && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Khuôn mặt chính diện</p>
                            <img src={capturedImages.faceFront} alt="Face front" className="w-full rounded-lg border-2 border-gray-200" />
                          </div>
                        )}
                        {capturedImages.faceLeft && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Khuôn mặt trái</p>
                            <img src={capturedImages.faceLeft} alt="Face left" className="w-full rounded-lg border-2 border-gray-200" />
                          </div>
                        )}
                        {capturedImages.faceRight && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Khuôn mặt phải</p>
                            <img src={capturedImages.faceRight} alt="Face right" className="w-full rounded-lg border-2 border-gray-200" />
                          </div>
                        )}
                        {capturedImages.cccdFront && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">CCCD mặt trước</p>
                            <img src={capturedImages.cccdFront} alt="CCCD front" className="w-full rounded-lg border-2 border-gray-200" />
                          </div>
                        )}
                        {capturedImages.cccdBack && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">CCCD mặt sau</p>
                            <img src={capturedImages.cccdBack} alt="CCCD back" className="w-full rounded-lg border-2 border-gray-200" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="secondary" 
                    onClick={() => { 
                      setCurrentStep(2); 
                      setShowCamera(true);
                      // Go back to first incomplete photo step
                      if (!capturedImages.faceFront) setCurrentPhotoStep(1);
                      else if (!capturedImages.faceLeft) setCurrentPhotoStep(2);
                      else if (!capturedImages.faceRight) setCurrentPhotoStep(3);
                      else if (!capturedImages.cccdFront) setCurrentPhotoStep(4);
                      else setCurrentPhotoStep(5);
                    }} 
                    disabled={bookingLoading}
                    className="flex-1"
                  >
                    Quay lại chỉnh sửa
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={handleConfirmBookingWithFace} 
                    disabled={bookingLoading}
                    className="flex-1"
                  >
                    {bookingLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                        Đang xử lý...
                              </span>
                    ) : (
                      "Xác nhận đặt phòng"
                    )}
                  </Button>
                </div>
                            </div>
                          )}
                  </div>
                ) : (
          <div className="space-y-4">
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-sm text-amber-700 font-medium mb-3">
                      Vui lòng chọn ngày check-in và check-out để tiếp tục đặt phòng.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Ngày check-in</label>
                        <Input
                          type="date"
                          value={modalCheckin}
                          onChange={(e) => setModalCheckin(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Ngày check-out</label>
                        <Input
                          type="date"
                          value={modalCheckout}
                          onChange={(e) => setModalCheckout(e.target.value)}
                          min={modalCheckin || new Date().toISOString().split('T')[0]}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
            <div className="flex gap-3 pt-4">
              <Button variant="secondary" onClick={() => setConfirmModalOpen(false)} className="flex-1">
                Hủy
                </Button>
              </div>
            </div>
        )}
      </Modal>
    </div>
  );
}


