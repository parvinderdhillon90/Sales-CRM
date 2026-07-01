import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const taskId = Number(id);

  const task = await prisma.tasks.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.role === 'manager' && task.assigned_to !== session.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await req.json();
  const { status, completion_note, priority, due_date } = body;

  if (status === 'completed' && !completion_note) {
    return NextResponse.json({ error: 'Completion note is required when marking a task as done' }, { status: 400 });
  }

  const updateData: Record<string, any> = { updated_at: new Date() };
  if (status) updateData.status = status;
  if (completion_note) updateData.completion_note = completion_note;
  if (status === 'completed') updateData.completed_at = new Date();
  if (priority && session.role === 'director') updateData.priority = priority;
  if (due_date && session.role === 'director') updateData.due_date = new Date(due_date);

  await prisma.tasks.update({ where: { id: taskId }, data: updateData });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'director') {
    return NextResponse.json({ error: 'Only director can delete tasks' }, { status: 403 });
  }

  const { id } = await params;
  await prisma.tasks.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
