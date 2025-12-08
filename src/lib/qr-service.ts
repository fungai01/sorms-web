export async function getBookingQr(bookingId: number) {
  const res = await fetch(`/api/user/bookings?bookingId=${bookingId}&action=qr`, {
    credentials: 'include',
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || 'Không thể lấy mã QR')
  }

  return res.json()
}







