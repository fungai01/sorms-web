import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'

// GET - Fetch all services or specific service by ID
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // Get specific service by ID
    if (id) {
      const serviceId = parseInt(id);
      if (isNaN(serviceId)) {
        return NextResponse.json({ error: 'Invalid service ID' }, { status: 400 });
      }
      const response = await apiClient.getService(serviceId);
      if (response.success) {
        return NextResponse.json(response.data);
      }
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    // Get all services (default)
    const response = await apiClient.getServices()
    
    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to fetch services' }, 
        { status: 500 }
      )
    }
    
    const raw: any = response.data
    const items = Array.isArray(raw?.content) ? raw.content : (Array.isArray(raw) ? raw : [])
    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error('Services API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  let body
  try {
    body = await req.json()
    console.log('POST /api/system/services - Request body:', JSON.stringify(body, null, 2))
  } catch (parseError) {
    console.error('POST /api/system/services - Failed to parse request body:', parseError)
    return NextResponse.json(
      { error: 'Invalid request body. Expected JSON format.' },
      { status: 400 }
    )
  }

  try {
    const response = await apiClient.createService(body)
    console.log('POST /api/system/services - API response:', JSON.stringify(response, null, 2))

    if (!response.success) {
      const errorMessage = response.error || 'Failed to create service'
      console.error('POST /api/system/services - API error:', errorMessage)
      console.error('POST /api/system/services - Full error response:', response)
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

    console.log('POST /api/system/services - Success:', response.data)
    return NextResponse.json(response.data, { status: 201 })
  } catch (error) {
    // Log chi tiết error để debug
    console.error('Create service API error - Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('Create service API error - Error message:', error instanceof Error ? error.message : String(error))
    console.error('Create service API error - Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Create service API error - Full error object:', error)
    
    // Xác định error message phù hợp
    let errorMessage = 'Internal server error'
    if (error instanceof Error) {
      errorMessage = error.message || 'Internal server error'
    } else if (typeof error === 'string') {
      errorMessage = error
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('PUT /api/system/services - Request body:', body)
    
    const response = await apiClient.updateService(body.id, body)
    console.log('PUT /api/system/services - API response:', response)
    
    if (!response.success) {
      console.error('PUT /api/system/services - API error:', response.error)
      return NextResponse.json(
        { error: response.error || 'Failed to update service' }, 
        { status: 500 }
      )
    }
    
    return NextResponse.json(response.data)
  } catch (error) {
    console.error('Update service API error:', error)
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
      return NextResponse.json({ error: 'Service ID is required for deletion' }, { status: 400 });
    }
    
    const serviceId = parseInt(id);
    if (isNaN(serviceId)) {
      return NextResponse.json({ error: 'Invalid service ID' }, { status: 400 });
    }
    
    const response = await apiClient.deleteService(serviceId);
    if (response.success) {
      return NextResponse.json({ message: 'Service deleted successfully' });
    }
    return NextResponse.json({ error: response.error }, { status: 500 });
  } catch (error) {
    console.error('Delete service API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}




