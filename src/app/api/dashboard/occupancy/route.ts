import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'

export async function GET(req: NextRequest) {
  try {
    console.log('[Dashboard API] Fetching occupancy data...')
    
    // Extract Authorization header from request and pass to apiClient
    const authHeader = req.headers.get('authorization')
    console.log('[Dashboard API] Authorization header:', {
      found: !!authHeader,
      prefix: authHeader ? authHeader.substring(0, 20) + '...' : 'none',
      fullHeader: authHeader ? authHeader : 'none'
    })
    
    // Calculate occupancy from rooms data
    // Pass headers via options parameter
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {}
    console.log('[Dashboard API] Calling apiClient.getRooms with headers:', {
      hasHeaders: Object.keys(headers).length > 0,
      headerKeys: Object.keys(headers),
      hasAuth: !!headers['Authorization']
    })
    
    let roomsResponse
    try {
      roomsResponse = await apiClient.getRooms({ headers })
    } catch (apiError) {
      console.error('[Dashboard API] Error calling apiClient.getRooms:', {
        error: apiError,
        message: apiError instanceof Error ? apiError.message : String(apiError),
        stack: apiError instanceof Error ? apiError.stack : undefined
      })
      throw apiError
    }
    
    console.log('[Dashboard API] Rooms response:', {
      success: roomsResponse.success,
      hasData: !!roomsResponse.data,
      error: roomsResponse.error,
      dataType: typeof roomsResponse.data,
      isArray: Array.isArray(roomsResponse.data),
    })
    
    if (!roomsResponse.success) {
      console.error('[Dashboard API] Failed to fetch rooms:', roomsResponse.error)
      return NextResponse.json(
        { error: roomsResponse.error || 'Failed to fetch rooms data' }, 
        { status: 500 }
      )
    }
    
    // Ensure rooms is an array, otherwise use empty array
    const rooms = Array.isArray(roomsResponse.data) ? roomsResponse.data : []
    const total = rooms.length
    const occupied = rooms.filter((room: any) => room?.status === 'OCCUPIED').length

    console.log('[Dashboard API] Occupancy calculated:', { total, occupied })

    // Add caching headers - cache for 30 seconds
    return NextResponse.json(
      { total, occupied },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error) {
    console.error('[Dashboard API] Occupancy error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' }, 
      { status: 500 }
    )
  }
}



