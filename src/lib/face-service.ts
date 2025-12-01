// Client-side helper cho luồng đăng ký khuôn mặt

export async function getFaceStatus(bookingId: number) {
  const res = await fetch(`/api/user/bookings/${bookingId}/face`, {
    credentials: 'include',
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || 'Không thể lấy trạng thái khuôn mặt')
  }

  return res.json()
}

export async function registerFace(bookingId: number, formData: FormData) {
  const res = await fetch(`/api/user/bookings/${bookingId}/face`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || 'Không thể đăng ký khuôn mặt')
  }

  return res.json()
}


