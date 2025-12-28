"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAvailableRooms, useRoomTypes, useSelfUser } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import type { Room, RoomType } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/hooks/useAuth";
import { getFaceStatus, registerFace, deleteFace } from "@/lib/services";
import { FaceCapture } from "@/components/ui/FaceCapture";
import { isValidCCCD, isValidEmail, isValidPhone, isValidDateOfBirth, validatePersonalInfo } from "@/lib/utils";
import Image from "next/image";
import roomImage from "@/img/Room.jpg";


export default function BookRoomPage() {
  const BOOKING_INFO_KEY = "booking_personal_info";

  const addDays = (dateStr: string, days: number) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };
  const router = useRouter();
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [checkinTime, setCheckinTime] = useState("14:00");
  const [checkoutTime, setCheckoutTime] = useState("12:00");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Modal states
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  
  // Separate dates for confirmation modal
  const [modalCheckin, setModalCheckin] = useState("");
  const [modalCheckout, setModalCheckout] = useState("");
  const [modalCheckinTime, setModalCheckinTime] = useState("14:00");
  const [modalCheckoutTime, setModalCheckoutTime] = useState("12:00");
  
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

  // Đăng ký khuôn mặt trực tiếp trong flow đặt phòng (5 ảnh)
  const [faceCaptureOpen, setFaceCaptureOpen] = useState(false);
  const [faceCaptureStep, setFaceCaptureStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [faceCaptureImages, setFaceCaptureImages] = useState<{
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
  const [faceRegistering, setFaceRegistering] = useState(false);
  const [showContactFields, setShowContactFields] = useState(true);
  
  const { user } = useAuth();
  const [faceStatus, setFaceStatus] = useState<{ registered: boolean; loading: boolean }>({ registered: false, loading: false });

  const { data: roomsData, loading: roomsLoading } = useAvailableRooms(
    checkin || undefined,
    checkout || undefined
  );
  const { data: roomTypesData } = useRoomTypes();

  const rooms = useMemo(() => {
    if (!roomsData) return [];
    const roomList = Array.isArray(roomsData) ? roomsData : (roomsData as any).items || (roomsData as any).data?.content || [];
    return roomList;
  }, [roomsData]);

  const roomTypes = useMemo(() => {
    if (!roomTypesData) return [];
    return Array.isArray(roomTypesData) ? roomTypesData : (roomTypesData as any).items || [];
  }, [roomTypesData]);


  // Auto-hide flash messages
  useEffect(() => {
    if (flash) {
      const timer = setTimeout(() => setFlash(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [flash]);

  // Nhận ảnh từ FaceCapture trong flow đặt phòng
  const handleCapturedFaceImage = async (imageSrc: string) => {
    const stepMap: { [k in 1 | 2 | 3 | 4 | 5]: keyof typeof faceCaptureImages } = {
      1: "faceFront",
      2: "faceLeft",
      3: "faceRight",
      4: "cccdFront",
      5: "cccdBack",
    };

    const key = stepMap[faceCaptureStep];

    setFaceCaptureImages((prev) => ({
      ...prev,
      [key]: imageSrc,
    }));

    // Sau khi chụp:
    // - Nếu còn bước tiếp theo: chuyển sang bước tiếp theo và giữ modal mở để chụp tiếp
    // - Nếu đã là bước 5: đóng modal
    if (faceCaptureStep < 5) {
      const next = (faceCaptureStep + 1) as 1 | 2 | 3 | 4 | 5;
      setFaceCaptureStep(next);
      setCurrentStep(2); // vẫn ở bước 2, chỉ đổi nội dung gợi ý
    } else {
      setFaceCaptureOpen(false);
    }
  };

  const allFaceImagesCaptured =
    faceCaptureImages.faceFront &&
    faceCaptureImages.faceLeft &&
    faceCaptureImages.faceRight &&
    faceCaptureImages.cccdFront &&
    faceCaptureImages.cccdBack;

  const handleSubmitFaceRegister = async () => {
    if (!allFaceImagesCaptured) {
      setFlash({
        type: "error",
        text: "Vui lòng chụp đủ 5 ảnh (3 khuôn mặt + 2 mặt CCCD) trước khi đăng ký khuôn mặt.",
      });
      return;
    }

    try {
      setFaceRegistering(true);

      // Nếu đã có dữ liệu khuôn mặt thì xóa trước khi đăng ký lại
      if (faceStatus.registered) {
        try {
          await deleteFace(0); // backend dùng userId từ token, tham số này không quan trọng
        } catch (e) {
          console.warn("Xóa dữ liệu khuôn mặt cũ thất bại (bỏ qua, tiếp tục đăng ký mới):", e);
        }
      }

      const imageSrcs = [
        faceCaptureImages.faceFront,
        faceCaptureImages.faceLeft,
        faceCaptureImages.faceRight,
        faceCaptureImages.cccdFront,
        faceCaptureImages.cccdBack,
      ].filter(Boolean) as string[];

      const blobs = await Promise.all(
        imageSrcs.map((src, idx) =>
          fetch(src)
            .then((res) => res.blob())
            .then(
              (blob) =>
                new File([blob], `face-${idx}-${Date.now()}.jpg`, {
                  type: "image/jpeg",
                })
            )
        )
      );

      const formData = new FormData();
      blobs.forEach((file) => formData.append("images", file));

      await registerFace(formData);

      setFlash({
        type: "success",
        text: "Đăng ký khuôn mặt thành công! Hệ thống sẽ sử dụng dữ liệu này cho các lần check-in.",
      });
      setFaceStatus({ registered: true, loading: false });
      // Sau khi đăng ký khuôn mặt thành công, tự động chuyển sang bước xác nhận đặt phòng
      setCurrentStep(3);
    } catch (err: any) {
      console.error("Face register error:", err);
      const rawMessage = err?.message || "";
      let friendly = rawMessage || "Đăng ký khuôn mặt thất bại. Vui lòng thử lại.";

      if (
        rawMessage.toLowerCase().includes("unauthenticated") ||
        rawMessage.toLowerCase().includes("not authenticated") ||
        rawMessage.toLowerCase().includes("unauthorized")
      ) {
        friendly = "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng xuất và đăng nhập lại trước khi đăng ký khuôn mặt.";
      }

      setFlash({
        type: "error",
        text: friendly,
      });
      setFormError(friendly);
    } finally {
      setFaceRegistering(false);
    }
  };

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

  // Check face status once user is known
  useEffect(() => {
    const check = async () => {
      if (!user) return;
      setFaceStatus({ registered: false, loading: true });
      try {
        const res = await getFaceStatus(0); // bookingId not required, API uses userId
        setFaceStatus({ registered: !!res?.registered, loading: false });
      } catch (err) {
        console.warn("Face status check failed:", err);
        setFaceStatus({ registered: false, loading: false });
      }
    };
    check();
  }, [user]);

  // Prefill từ localStorage để người dùng không phải nhập lại mỗi lần
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = localStorage.getItem(BOOKING_INFO_KEY);
    if (!cached) return;
    try {
      const data = JSON.parse(cached);
      if (data && typeof data === "object") {
        setPersonalInfo((prev) => ({
          ...prev,
          ...data,
        }));
        if (data.email || data.phone) {
          setShowContactFields(false);
        }
      }
    } catch {
      // ignore cache parse error
    }
  }, []);

  // Lưu tạm thông tin nhập để lần sau tự động điền
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(BOOKING_INFO_KEY, JSON.stringify(personalInfo));
    } catch {
      // ignore write error
    }
  }, [personalInfo]);

  const { data: selfUserData, loading: selfUserLoading } = useSelfUser();

  // Prefill hồ sơ người dùng cho form đặt phòng từ self user data
  useEffect(() => {
    if (!user || selfUserLoading) return;

    const items: any[] = Array.isArray((selfUserData as any)?.items)
      ? (selfUserData as any).items
      : Array.isArray((selfUserData as any)?.data?.items)
        ? (selfUserData as any).data.items
        : Array.isArray(selfUserData as any)
          ? (selfUserData as any)
          : [];

    const me = items.find((u) => (u.email || "").toLowerCase() === (user.email || "").toLowerCase()) || items[0];
    if (!me) return;

    const fullNameFromProfile =
      me.fullName ??
      me.full_name ??
      (me.firstName && me.lastName ? `${me.firstName} ${me.lastName}` : undefined) ??
      user?.name;

    setPersonalInfo((prev) => ({
      ...prev,
      fullName: fullNameFromProfile || prev.fullName,
      dateOfBirth: me.dateOfBirth ?? me.date_of_birth ?? prev.dateOfBirth ?? "",
      cccd: me.idCardNumber ?? me.id_card_number ?? prev.cccd ?? "",
      phone: me.phoneNumber ?? me.phone_number ?? prev.phone ?? "",
      email: me.email ?? prev.email ?? "",
    }));

    if (me.email || me.phoneNumber || me.phone_number) {
      setShowContactFields(false);
    }
  }, [user, selfUserLoading, selfUserData]);

 
  // Bước 1 -> Bước 2 (kiểm tra khuôn mặt)
  const handleStep1Next = () => {
    const validation = validatePersonalInfo(personalInfo);
    if (!validation.isValid) {
      setFormError(validation.errors[0]);
      return;
    }
    setFormError(null);
    setCurrentStep(2);
  };

  // Bước 2 -> Bước 3 (xác nhận đặt phòng)
  const handleStep2Next = () => {
    setCurrentStep(3);
  };

  // Xác nhận đặt phòng (sau khi đã qua bước kiểm tra khuôn mặt)
  const handleConfirmBookingWithFace = async () => {
    // Validate lại tất cả thông tin trước khi submit
    const validation = validatePersonalInfo(personalInfo);
    if (!validation.isValid) {
      setFormError(validation.errors[0]);
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

      // Kết hợp ngày và giờ thành datetime string
      const checkinDateTime = `${modalCheckin}T${modalCheckinTime}:00`;
      const checkoutDateTime = `${modalCheckout}T${modalCheckoutTime}:00`;

      const bookingData = {
        roomId: selectedRoom.id,
        checkinDate: checkinDateTime,
        checkoutDate: checkoutDateTime,
        numGuests: 1,
      };
      
      const bookingResponse = await apiClient.createBooking(bookingData);
      
      if (!bookingResponse.success) {
        throw new Error(bookingResponse.error || "Đặt phòng thất bại");
      }

      const booking = bookingResponse.data as any;
      const bookingId = booking?.id || booking?.bookingId || 0;

      // Nếu chưa có khuôn mặt đã đăng ký, chuyển sang trang đăng ký khuôn mặt
      if (!faceStatus.registered) {
        router.push(bookingId ? `/user/face-register?bookingId=${bookingId}` : "/user/face-register");
        return;
      }

      setFlash({ type: 'success', text: 'Đặt phòng thành công! Vui lòng chờ xác nhận.' });
      setConfirmModalOpen(false);
      setSelectedRoom(null);
      setModalCheckin("");
      setModalCheckout("");
      setCurrentStep(1);

      // Reset lại form thông tin cá nhân về thông tin user hiện tại
      setPersonalInfo({
        fullName: user?.name || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "") || "",
        dateOfBirth: user?.dob || "",
        cccd: "",
        phone: user?.phoneNumber || "",
        email: user?.email || "",
      });
    } catch (err: any) {
      console.error("Booking error:", err);
      let errorMessage = err?.message || "Có lỗi xảy ra khi đặt phòng";
      
      // Dịch lỗi từ backend sang tiếng Việt
      if (errorMessage.toLowerCase().includes("check-out date must be after check-in")) {
        errorMessage = "Ngày check-out phải sau ngày check-in";
      } else if (errorMessage.toLowerCase().includes("check-in date")) {
        errorMessage = "Ngày check-in không hợp lệ";
      } else if (errorMessage.toLowerCase().includes("room not available")) {
        errorMessage = "Phòng không còn trống trong khoảng thời gian này";
      }
      
      setFormError(errorMessage);
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
    setModalCheckinTime(checkinTime);
    setModalCheckoutTime(checkoutTime);
    setConfirmModalOpen(true);
    setCurrentStep(1);
    // Giữ lại thông tin đã nhập trước đó; chỉ điền mặc định nếu trống
    setPersonalInfo((prev) => {
      const isEmpty =
        !prev.fullName && !prev.phone && !prev.email && !prev.cccd && !prev.dateOfBirth;
      if (!isEmpty) return prev;
      return {
        fullName:
          user?.name ||
          (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "") ||
          "",
      dateOfBirth: user?.dob || "",
      cccd: "",
      phone: user?.phoneNumber || "",
      email: user?.email || "",
      };
    });
  };


  const getRoomStatusBadge = (status: string): "available" | "occupied" | "maintenance" => {
    if (status === "AVAILABLE") return "available";
    if (status === "OCCUPIED") return "occupied";
    return "maintenance";
  };

  return (
    <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
          <div className="border-b border-gray-200/50 px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Tìm và đặt phòng</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Chọn ngày và loại phòng để xem danh sách phòng khả dụng
                </p>
              </div>
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

        {/* Filter section */}
        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
            <h2 className="text-xl font-bold text-gray-900">Bộ lọc tìm kiếm</h2>
          </CardHeader>
          <CardBody className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ngày nhận phòng
                </label>
                <input
                  type="date"
                  value={checkin}
                  onChange={(e) => {
                    const nextCheckin = e.target.value;
                    setCheckin(nextCheckin);

                    // Ensure checkout > checkin
                    if (!checkout || (nextCheckin && checkout <= nextCheckin)) {
                      setCheckout(nextCheckin ? addDays(nextCheckin, 1) : "");
                    }
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Giờ nhận phòng
                </label>
                <input
                  type="time"
                  value={checkinTime}
                  onChange={(e) => setCheckinTime(e.target.value)}
                  className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ngày trả phòng
                </label>
                <input
                  type="date"
                  value={checkout}
                  onChange={(e) => setCheckout(e.target.value)}
                  min={checkin ? addDays(checkin, 1) : new Date().toISOString().split('T')[0]}
                  className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Giờ trả phòng
                </label>
                <input
                  type="time"
                  value={checkoutTime}
                  onChange={(e) => setCheckoutTime(e.target.value)}
                  className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] bg-white"
                />
              </div>
              <div className="flex items-end">
                {(checkin || checkout) ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCheckin("");
                      setCheckout("");
                      setCheckinTime("14:00");
                      setCheckoutTime("12:00");
                    }}
                    className="w-full h-11"
                  >
                    Xóa bộ lọc
                  </Button>
                ) : (
                  <div className="w-full" />
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Available rooms */}
        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Phòng khả dụng</h2>
                <p className="text-sm text-gray-500">
                  {checkin && checkout 
                    ? `Tìm thấy ${rooms.length} phòng từ ${new Date(checkin).toLocaleDateString("vi-VN")} đến ${new Date(checkout).toLocaleDateString("vi-VN")}`
                    : "Chọn ngày để xem phòng khả dụng"}
                </p>
              </div>
              {rooms.length > 0 && (
                <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                  {rooms.length} phòng
                </span>
              )}
            </div>
          </CardHeader>
          <CardBody className="p-6">

          {roomsLoading ? (
              <div className="py-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(var(--primary))] mb-3"></div>
                <p className="text-sm text-gray-500">Đang tải danh sách phòng...</p>
              </div>
          ) : rooms.length === 0 ? (
              <div className="py-12 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room: Room) => {
                const roomType = roomTypes.find((rt: RoomType) => rt.id === room.roomTypeId);
                const isAvailable = room.status === "AVAILABLE";
                const canBook = isAvailable && !bookingLoading;

                return (
                  <div key={room.id} className={`border border-gray-200 rounded-xl overflow-hidden transition-all hover:shadow-lg hover:border-gray-300 ${
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
                            {/* Giá phòng đã được ẩn theo yêu cầu, không hiển thị giá ở đây */}
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

                    <div className="p-5">
                      <div className="space-y-4">
                        {/* Action buttons */}
                        <div className="flex gap-3 pt-2">
                          <Button
                            variant="secondary"
                            className="flex-1 h-10 text-sm font-semibold bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                            onClick={() => handleViewDetails(room)}
                          >
                            Xem chi tiết
                          </Button>
                          <Button
                            onClick={() => handleBookRoom(room)}
                            disabled={!canBook}
                            variant="primary"
                            className="flex-1 h-10 text-sm font-semibold"
                          >
                            {bookingLoading ? (
                              <span className="flex items-center gap-2">
                                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </CardBody>
        </Card>
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
                    {/* Giá phòng đã được ẩn trong modal chi tiết */}
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
            className="w-full h-11"
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
          setModalCheckinTime("14:00");
          setModalCheckoutTime("10:00");
          setCurrentStep(1);
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

                {/* Ngày giờ check-in / check-out */}
                <div className="pt-2 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Thời gian đặt phòng</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Check-in <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="date"
                          value={modalCheckin}
                          onChange={(e) => {
                            const nextCheckin = e.target.value;
                            setModalCheckin(nextCheckin);

                            // Ensure checkout > checkin
                            if (!modalCheckout || (nextCheckin && modalCheckout <= nextCheckin)) {
                              setModalCheckout(nextCheckin ? addDays(nextCheckin, 1) : "");
                            }
                          }}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] bg-white"
                        />
                        <input
                          type="time"
                          value={modalCheckinTime}
                          onChange={(e) => setModalCheckinTime(e.target.value)}
                          className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Check-out <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="date"
                          value={modalCheckout}
                          onChange={(e) => setModalCheckout(e.target.value)}
                          min={modalCheckin ? addDays(modalCheckin, 1) : new Date().toISOString().split('T')[0]}
                          className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] bg-white"
                        />
                        <input
                          type="time"
                          value={modalCheckoutTime}
                          onChange={(e) => setModalCheckoutTime(e.target.value)}
                          className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" onClick={() => {
                    setConfirmModalOpen(false);
                    setSelectedRoom(null);
                    setModalCheckin("");
                    setModalCheckout("");
                  }} className="flex-1 h-11">
                    Hủy
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={handleStep1Next} 
                    className="flex-1 h-11"
                    disabled={!validatePersonalInfo(personalInfo).isValid || !modalCheckin || !modalCheckout}
                  >
                    Tiếp theo
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Trạng thái khuôn mặt / đăng ký hoặc dùng lại */}
            {currentStep === 2 && (
                <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Trạng thái khuôn mặt</h3>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  {faceStatus.loading ? (
                    <p className="text-sm text-gray-600">Đang kiểm tra dữ liệu khuôn mặt...</p>
                  ) : faceStatus.registered ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-green-700">Đã có dữ liệu khuôn mặt</p>
                        <p className="text-xs text-gray-500">
                          Bạn có thể tiếp tục hoặc đăng ký lại nếu muốn cập nhật.
                    </p>
                  </div>
                      <Badge tone="success">Đã đăng ký</Badge>
                      </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-red-700">Chưa có dữ liệu khuôn mặt</p>
                        <p className="text-xs text-gray-500">
                          Cần đăng ký trước khi hoàn tất đặt phòng.
                        </p>
                          </div>
                      <Badge tone="warning">Chưa đăng ký</Badge>
                        </div>
                      )}
                  </div>
                  
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 h-11"
                  >
                    Quay lại
                  </Button>
                  {faceStatus.registered ? (
                    <>
                    <Button 
                      variant="secondary" 
                        disabled={faceStatus.loading || faceRegistering}
                      onClick={() => { 
                          setFaceCaptureImages({
                            faceFront: null,
                            faceLeft: null,
                            faceRight: null,
                            cccdFront: null,
                            cccdBack: null,
                          });
                          setFaceCaptureStep(1);
                          setFaceCaptureOpen(true);
                      }} 
                      className="flex-1 h-11"
                    >
                        Đăng ký lại
                    </Button>
                      <Button
                        variant="primary"
                        disabled={faceStatus.loading || faceRegistering}
                        onClick={handleStep2Next}
                        className="flex-1 h-11"
                      >
                        Tiếp tục
                      </Button>
                    </>
                    ) : (
                      <Button 
                        variant="primary" 
                      disabled={faceStatus.loading || faceRegistering}
                      onClick={() => {
                        setFaceCaptureImages({
                          faceFront: null,
                          faceLeft: null,
                          faceRight: null,
                          cccdFront: null,
                          cccdBack: null,
                        });
                        setFaceCaptureStep(1);
                        setFaceCaptureOpen(true);
                      }}
                        className="flex-1 h-11"
                      >
                      Đăng ký khuôn mặt
                      </Button>
                    )}
                  </div>

                  {/* Preview các ảnh đã chụp nếu có */}
                  {(faceCaptureImages.faceFront ||
                    faceCaptureImages.faceLeft ||
                    faceCaptureImages.faceRight ||
                    faceCaptureImages.cccdFront ||
                    faceCaptureImages.cccdBack) && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-medium text-gray-700">
                        Ảnh đã chụp cho đăng ký khuôn mặt:
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {faceCaptureImages.faceFront && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Khuôn mặt chính diện</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={faceCaptureImages.faceFront}
                              alt="Khuôn mặt chính diện"
                              className="w-full aspect-video object-cover rounded border"
                            />
                        </div>
                      )}
                        {faceCaptureImages.faceLeft && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Khuôn mặt bên trái</p>
                            <img
                              src={faceCaptureImages.faceLeft}
                              alt="Khuôn mặt bên trái"
                              className="w-full aspect-video object-cover rounded border"
                            />
                        </div>
                      )}
                        {faceCaptureImages.faceRight && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Khuôn mặt bên phải</p>
                            <img
                              src={faceCaptureImages.faceRight}
                              alt="Khuôn mặt bên phải"
                              className="w-full aspect-video object-cover rounded border"
                            />
                        </div>
                      )}
                        {faceCaptureImages.cccdFront && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">CCCD mặt trước</p>
                            <img
                              src={faceCaptureImages.cccdFront}
                              alt="CCCD mặt trước"
                              className="w-full aspect-video object-cover rounded border"
                            />
                    </div>
                        )}
                        {faceCaptureImages.cccdBack && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">CCCD mặt sau</p>
                            <img
                              src={faceCaptureImages.cccdBack}
                              alt="CCCD mặt sau"
                              className="w-full aspect-video object-cover rounded border"
                            />
                                </div>
                              )}
                      </div>
                      
                      {/* Chỉ hiển thị nút gửi khi đã chụp đủ ảnh */}
                      {allFaceImagesCaptured && (
                        <div className="flex gap-3 pt-3">
                          <Button 
                            variant="primary" 
                            className="flex-1 h-11"
                            onClick={handleSubmitFaceRegister}
                            disabled={faceRegistering}
                          >
                            {faceRegistering ? "Đang đăng ký khuôn mặt..." : "Gửi / cập nhật dữ liệu khuôn mặt"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                {!faceStatus.registered && !allFaceImagesCaptured && (
                  <p className="text-xs text-gray-500 text-center">
                    Hệ thống sẽ đăng ký khuôn mặt trực tiếp trong bước này. Vui lòng chụp đủ 5 ảnh để tiếp tục.
                  </p>
                    )}
                  </div>
            )}

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
                          {new Date(modalCheckin).toLocaleDateString("vi-VN")} lúc {modalCheckinTime}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Check-out:</span>
                        <span className="font-medium text-gray-900">
                          {new Date(modalCheckout).toLocaleDateString("vi-VN")} lúc {modalCheckoutTime}
                        </span>
                      </div>
                          </div>
                  </div>

                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="secondary" 
                    onClick={() => setCurrentStep(1)}
                    disabled={bookingLoading}
                    className="flex-1 h-11"
                  >
                    Chỉnh sửa
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleConfirmBookingWithFace}
                    disabled={bookingLoading}
                    className="flex-1 h-11"
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
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-sm text-amber-700 font-medium mb-4">
                      Vui lòng chọn ngày và giờ check-in, check-out để tiếp tục đặt phòng.
                    </p>
                    <div className="space-y-4">
                      {/* Check-in */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Ngày check-in</label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="relative">
                            <input
                              type="date"
                              value={modalCheckin}
                              onChange={(e) => {
                                const nextCheckin = e.target.value;
                                setModalCheckin(nextCheckin);

                                // Ensure checkout > checkin
                                if (!modalCheckout || (nextCheckin && modalCheckout <= nextCheckin)) {
                                  setModalCheckout(nextCheckin ? addDays(nextCheckin, 1) : "");
                                }
                              }}
                              min={new Date().toISOString().split('T')[0]}
                              className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] bg-white"
                            />
                          </div>
                          <div className="relative">
                            <input
                              type="time"
                              value={modalCheckinTime}
                              onChange={(e) => setModalCheckinTime(e.target.value)}
                              className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] bg-white"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Check-out */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Ngày check-out</label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="relative">
                            <input
                              type="date"
                              value={modalCheckout}
                              onChange={(e) => setModalCheckout(e.target.value)}
                              min={modalCheckin ? addDays(modalCheckin, 1) : new Date().toISOString().split('T')[0]}
                              className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] bg-white"
                            />
                          </div>
                          <div className="relative">
                            <input
                              type="time"
                              value={modalCheckoutTime}
                              onChange={(e) => setModalCheckoutTime(e.target.value)}
                              className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setConfirmModalOpen(false)} className="flex-1 h-11">
                Hủy
                </Button>
              </div>
            </div>
        )}
      </Modal>

      {/* Modal chụp 5 ảnh khuôn mặt + CCCD trong flow đặt phòng */}
      <FaceCapture
        open={faceCaptureOpen}
        onClose={() => setFaceCaptureOpen(false)}
        loading={faceRegistering}
        onCapture={handleCapturedFaceImage}
        enableFaceGuidance={faceCaptureStep <= 3}
        faceCaptureStep={faceCaptureStep}
        title={
          faceCaptureStep === 1
            ? "Chụp khuôn mặt chính diện"
            : faceCaptureStep === 2
            ? "Chụp khuôn mặt nghiêng trái"
            : faceCaptureStep === 3
            ? "Chụp khuôn mặt nghiêng phải"
            : faceCaptureStep === 4
            ? "Chụp CCCD mặt trước"
            : faceCaptureStep === 5
            ? "Chụp CCCD mặt sau"
            : "Chụp ảnh khuôn mặt"
        }
      />
    </div>
  );
}


