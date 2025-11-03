import { NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'

export async function GET() {
  try {
    // Calculate occupancy from rooms data
    const roomsResponse = await apiClient.getRooms()
    if (!roomsResponse.success) {
      return NextResponse.json(
        { error: 'Failed to fetch rooms data' }, 
        { status: 500 }
      )
    }
    
    // Ensure rooms is an array, otherwise use empty array
    const rooms = Array.isArray(roomsResponse.data) ? roomsResponse.data : []
    const total = rooms.length
    const occupied = rooms.filter((room) => room?.status === 'OCCUPIED').length

    return NextResponse.json({ total, occupied })
  } catch (error) {
    console.error('Occupancy API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}



