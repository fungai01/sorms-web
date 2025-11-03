import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory store for demo purposes
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'
type StaffTask = {
  id: number
  title: string
  assignee: string
  due_date?: string
  priority: TaskPriority
  status: TaskStatus
  description?: string
  created_at: string
  isActive: boolean
}

let tasks: StaffTask[] = []

const nextId = () => (tasks.length ? Math.max(...tasks.map(t => t.id)) + 1 : 1)

export async function GET(req: NextRequest) {
  // Only return active tasks by default
  const { searchParams } = new URL(req.url)
  const showInactive = searchParams.get('showInactive') === 'true'
  const filteredTasks = showInactive ? tasks : tasks.filter(t => t.isActive)
  return NextResponse.json(filteredTasks)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const item: StaffTask = {
      id: nextId(),
      title: String(body.title || ''),
      assignee: String(body.assignee || ''),
      due_date: body.due_date || undefined,
      priority: (body.priority || 'MEDIUM') as TaskPriority,
      status: (body.status || 'TODO') as TaskStatus,
      description: (body.description || undefined),
      created_at: new Date().toISOString(),
      isActive: true,
    }
    if (!item.title.trim() || !item.assignee.trim()) {
      return NextResponse.json({ error: 'Thiếu tiêu đề hoặc người phụ trách' }, { status: 400 })
    }
    tasks.push(item)
    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const idx = tasks.findIndex(t => t.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const prev = tasks[idx]
    const updated: StaffTask = {
      ...prev,
      title: body.title ?? prev.title,
      assignee: body.assignee ?? prev.assignee,
      due_date: body.due_date ?? prev.due_date,
      priority: (body.priority ?? prev.priority) as TaskPriority,
      status: (body.status ?? prev.status) as TaskStatus,
      description: body.description ?? prev.description,
      isActive: body.isActive ?? prev.isActive,
    }
    tasks[idx] = updated
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const idParam = req.nextUrl.searchParams.get('id')
  const id = idParam ? Number(idParam) : 0
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const idx = tasks.findIndex(t => t.id === id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Soft delete: set isActive to false instead of removing from array
  tasks[idx].isActive = false
  return NextResponse.json({ ok: true })
}

