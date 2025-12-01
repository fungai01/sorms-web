import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { verifyToken } from '@/lib/auth-utils'

// GET - Fetch all bookings, specific booking by ID, or filtered bookings
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    // Get specific booking by ID
    if (id) {
      const bookingId = parseInt(id);
      if (isNaN(bookingId)) {
        return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
      }
      const response = await apiClient.getBooking(bookingId);
      if (response.success) {
        return NextResponse.json(response.data);
      }
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    // Get bookings by user ID
    if (userId) {
      const user = parseInt(userId);
      if (isNaN(user)) {
        return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
      }
      const response = await apiClient.getBookingsByUser(user);
      if (response.success) {
        return NextResponse.json(response.data);
      }
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    // Get bookings by status
    if (status) {
      const validStatuses = ['PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'REJECTED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid booking status' }, { status: 400 });
      }
      const response = await apiClient.getBookingsByStatus(status);
      if (response.success) {
        return NextResponse.json(response.data);
      }
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    // Get all bookings (default)
    const response = await apiClient.getBookings()
    
    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to fetch bookings' }, 
        { status: 500 }
      )
    }
    
    return NextResponse.json(response.data)
  } catch (error) {
    console.error('Bookings API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

// POST - Create new booking or perform actions (checkin, approve)
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    // Handle checkin action
    if (action === 'checkin' && id) {
      const bookingId = parseInt(id);
      if (isNaN(bookingId)) {
        return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
      }
      const response = await apiClient.checkinBooking(bookingId);
      if (response.success) {
        return NextResponse.json(response.data);
      }
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    // Handle approve action
    if (action === 'approve' && id) {
      const bookingId = parseInt(id);
      if (isNaN(bookingId)) {
        return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
      }

      // Lấy approverId từ token nếu có
      let approverId: string | undefined
      try {
        const userInfo = await verifyToken(req)
        if (userInfo?.id) {
          approverId = String(userInfo.id)
        }
      } catch (e) {
        console.error('Error getting approver info from token:', e)
      }

      const response = await apiClient.approveBooking(bookingId, approverId)
      if (response.success) {
        return NextResponse.json(response.data);
      }
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    // Create new booking (default)
    const body = await req.json()
    
    // Try to get userId from token if not provided
    if (!body.userId && !body.user_id) {
      try {
        const userInfo = await verifyToken(req)
        if (userInfo?.id) {
          // Use user ID from token if available
          body.userId = userInfo.id
        }
        // If we have user email, we might need to look up userId
        // For now, we'll let the backend handle it or use a default
        // TODO: Query user by email to get userId if needed
      } catch (error) {
        console.error('Error getting user info from token:', error)
      }
    }
    
    const response = await apiClient.createBooking(body)
    
    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to create booking' }, 
        { status: 500 }
      )
    }
    
    return NextResponse.json(response.data, { status: 201 })
  } catch (error) {
    console.error('Create booking API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const response = await apiClient.updateBooking(body.id, body)
    
    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to update booking' }, 
        { status: 500 }
      )
    }
    
    return NextResponse.json(response.data)
  } catch (error) {
    console.error('Update booking API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Booking ID is required for deletion' }, { status: 400 });
    }
    
    const bookingId = parseInt(id);
    if (isNaN(bookingId)) {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
    }
    
    const response = await apiClient.deleteBooking(bookingId);
    if (response.success) {
      return NextResponse.json({ message: 'Booking deleted successfully' });
    }
    return NextResponse.json({ error: response.error }, { status: 500 });
  } catch (error) {
    console.error('Delete booking API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}


