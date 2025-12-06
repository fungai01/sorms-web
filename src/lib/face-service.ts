// Client-side helper cho luồng đăng ký khuôn mặt
import { API_CONFIG } from '@/lib/config'
import { authService } from '@/lib/auth-service'

// Lấy token và userInfo từ authService
function getAuthHeaders(): HeadersInit {
  const token = authService.getAccessToken()
  const headers: HeadersInit = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

function getUserInfo() {
  return authService.getUserInfo()
}

export async function getFaceStatus(bookingId: number) {
  const userInfo = getUserInfo()
  if (!userInfo?.id) {
    throw new Error('Chưa đăng nhập')
  }

  const headers = getAuthHeaders()
  const res = await fetch(
    `${API_CONFIG.BASE_URL}/ai/recognition/faces/${userInfo.id}`,
    {
      method: 'GET',
      headers,
    }
  )

  if (!res.ok) {
    if (res.status === 404) {
      return { registered: false }
    }
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || error.message || 'Không thể lấy trạng thái khuôn mặt')
  }

  const data = await res.json().catch(() => ({}))
  return {
    registered: true,
    data,
  }
}

export async function registerFace(bookingId: number, formData: FormData) {
  const userInfo = getUserInfo()
  if (!userInfo?.id) {
    throw new Error('Chưa đăng nhập')
  }

  const headers = getAuthHeaders()
  const url = `${API_CONFIG.BASE_URL}/ai/recognition/face/register?student_id=${userInfo.id}`
  const token = authService.getAccessToken()
  
  console.log('[Face Service] Registering face:', {
    url,
    student_id: userInfo.id,
    hasToken: !!token,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    let error: any = {}
    try {
      error = JSON.parse(errorText)
    } catch {
      error = { message: errorText || `HTTP ${res.status}` }
    }
    console.error('[Face Service] Register failed:', {
      status: res.status,
      statusText: res.statusText,
      error,
      url,
    })
    throw new Error(error.error || error.message || `Không thể đăng ký khuôn mặt (${res.status})`)
  }

  return res.json()
}

export async function updateFace(bookingId: number, formData: FormData) {
  const userInfo = getUserInfo()
  if (!userInfo?.id) {
    throw new Error('Chưa đăng nhập')
  }

  const headers = getAuthHeaders()
  const res = await fetch(
    `${API_CONFIG.BASE_URL}/ai/recognition/faces/${userInfo.id}`,
    {
      method: 'PUT',
      headers,
      body: formData,
    }
  )

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || error.message || 'Không thể cập nhật khuôn mặt')
  }

  return res.json()
}

export async function deleteFace(bookingId: number) {
  const userInfo = getUserInfo()
  if (!userInfo?.id) {
    throw new Error('Chưa đăng nhập')
  }

  const headers = getAuthHeaders()
  const res = await fetch(
    `${API_CONFIG.BASE_URL}/ai/recognition/faces/${userInfo.id}`,
    {
      method: 'DELETE',
      headers,
    }
  )

  if (!res.ok) {
    // 404 có thể coi là thành công (đã xóa rồi)
    if (res.status === 404) {
      return {
        success: true,
        message: 'Face data not found or already deleted',
      }
    }
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || error.message || 'Không thể xóa khuôn mặt')
  }

  return res.json()
}







