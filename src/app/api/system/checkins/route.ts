import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'

// GET - Fetch all checkins
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // Get specific checkin by ID
    if (id) {
      const checkinId = parseInt(id);
      if (isNaN(checkinId)) {
        return NextResponse.json({ error: 'Invalid checkin ID' }, { status: 400 });
      }
      // For now, we'll fetch all and filter - can be optimized later
      const response = await apiClient.getBookings();
      if (response.success) {
        const bookings = Array.isArray(response.data?.content) 
          ? response.data.content 
          : (Array.isArray(response.data) ? response.data : []);
        
        const checkin = bookings.find((b: any) => b.id === checkinId && b.status === 'CHECKED_IN');
        if (checkin) {
          return NextResponse.json(checkin);
        }
        return NextResponse.json({ error: 'Checkin not found' }, { status: 404 });
      }
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    // Get all checkins (bookings with CHECKED_IN status)
    const response = await apiClient.getBookings();
    
    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to fetch checkins' }, 
        { status: 500 }
      );
    }
    
    // Extract bookings array from response
    const bookings = Array.isArray(response.data?.content) 
      ? response.data.content 
      : (Array.isArray(response.data) ? response.data : []);
    
    // Filter for checked-in bookings
    const checkins = bookings.filter((booking: any) => 
      booking.status === 'CHECKED_IN' || booking.status === 'CHECKED_OUT'
    );
    
    // Return in a consistent format
    return NextResponse.json({ 
      items: checkins,
      total: checkins.length 
    });
  } catch (error) {
    console.error('Checkins API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

