import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  // Auto-mark overdue tasks
  await prisma.tasks.updateMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
      due_date: { lt: new Date() },
    },
    data: { status: 'overdue' },
  });

  const assignedFilter = session.role === 'manager'
    ? Prisma.sql`AND t.assigned_to = ${session.userId}`
    : Prisma.empty;
  const statusFilter = status ? Prisma.sql`AND t.status = ${status}` : Prisma.empty;

  const tasks = await prisma.$queryRaw<any[]>`
    SELECT t.*,
      u.name as assigned_user_name,
      cu.name as creator_name,
      d.title as deal_title,
      c.name as client_name, c.company as client_company
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users cu ON t.created_by = cu.id
    LEFT JOIN deals d ON t.deal_id = d.id
    LEFT JOIN clients c ON t.client_id = c.id
    WHERE 1=1
    ${assignedFilter}
    ${statusFilter}
    ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, t.due_date ASC
  `;

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { title, description, assigned_to, deal_id, client_id, due_date, priority } = body;

  if (!title || !assigned_to || !due_date) {
    return NextResponse.json({ error: 'Title, assignee, and due date are required' }, { status: 400 });
  }
  if (session.role === 'manager' && Number(assigned_to) !== session.userId) {
    return NextResponse.json({ error: 'Managers can only create tasks for themselves' }, { status: 403 });
  }

  const task = await prisma.tasks.create({
    data: {
      title,
      description: description || null,
      created_by: session.userId,
      assigned_to: Number(assigned_to),
      deal_id: deal_id ? Number(deal_id) : null,
      client_id: client_id ? Number(client_id) : null,
      due_date: new Date(due_date),
      priority: priority || 'medium',
    },
  });

  return NextResponse.json({ id: task.id }, { status: 201 });
}
