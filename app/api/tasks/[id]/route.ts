import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getRequestSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(params.id) as any;
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session.role === 'manager' && task.assigned_to !== session.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await req.json();
  const { status, completion_note, priority, due_date } = body;

  if (status === 'completed' && !completion_note) {
    return NextResponse.json({ error: 'Completion note is required when marking a task as done' }, { status: 400 });
  }

  const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  if (status) updates.push(`status = '${status}'`);
  if (completion_note) updates.push(`completion_note = '${completion_note.replace(/'/g, "''")}'`);
  if (status === 'completed') updates.push(`completed_at = CURRENT_TIMESTAMP`);
  if (priority && session.role === 'director') updates.push(`priority = '${priority}'`);
  if (due_date && session.role === 'director') updates.push(`due_date = '${due_date}'`);

  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(params.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getRequestSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'director') return NextResponse.json({ error: 'Only director can delete tasks' }, { status: 403 });

  const db = getDb();
  db.prepare('DELETE FROM tasks WHERE id = ?').run(params.id);
  return NextResponse.json({ ok: true });
}
