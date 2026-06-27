import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  // Auto-mark overdue tasks
  db.prepare(`
    UPDATE tasks SET status = 'overdue'
    WHERE status IN ('pending','in_progress') AND due_date < date('now')
  `).run();

  let query = `
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
  `;
  const params: any[] = [];

  if (session.role === 'manager') {
    query += ' AND t.assigned_to = ?';
    params.push(session.userId);
  }

  if (status) { query += ' AND t.status = ?'; params.push(status); }

  query += ' ORDER BY CASE t.priority WHEN \'urgent\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 ELSE 4 END, t.due_date ASC';

  return NextResponse.json(db.prepare(query).all(...params));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const body = await req.json();
  const { title, description, assigned_to, deal_id, client_id, due_date, priority } = body;

  if (!title || !assigned_to || !due_date) {
    return NextResponse.json({ error: 'Title, assignee, and due date are required' }, { status: 400 });
  }

  // Managers can only assign tasks to themselves
  if (session.role === 'manager' && Number(assigned_to) !== session.userId) {
    return NextResponse.json({ error: 'Managers can only create tasks for themselves' }, { status: 403 });
  }

  const result = db.prepare(`
    INSERT INTO tasks (title, description, created_by, assigned_to, deal_id, client_id, due_date, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, description || null, session.userId, assigned_to, deal_id || null, client_id || null, due_date, priority || 'medium');

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
