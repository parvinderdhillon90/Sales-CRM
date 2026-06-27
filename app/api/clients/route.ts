import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const zone = searchParams.get('zone');
  const search = searchParams.get('search') || '';

  let query = `
    SELECT c.*, u.name as assigned_user_name,
           COUNT(d.id) as deal_count
    FROM clients c
    LEFT JOIN users u ON c.assigned_to = u.id
    LEFT JOIN deals d ON d.client_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (session.role === 'manager') {
    query += ' AND c.zone = ?';
    params.push(session.zone);
  } else if (zone) {
    query += ' AND c.zone = ?';
    params.push(zone);
  }

  if (search) {
    query += ' AND (c.name LIKE ? OR c.company LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  query += ' GROUP BY c.id ORDER BY c.updated_at DESC';

  const clients = db.prepare(query).all(...params);
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const body = await req.json();
  const { name, company, phone, email, address, zone, assigned_to, notes } = body;

  if (!name || !company || !zone) {
    return NextResponse.json({ error: 'Name, company, and zone are required' }, { status: 400 });
  }

  // Managers can only create clients in their zone
  if (session.role === 'manager' && zone !== session.zone) {
    return NextResponse.json({ error: 'You can only create clients in your zone' }, { status: 403 });
  }

  const effectiveAssignedTo = session.role === 'manager' ? session.userId : (assigned_to || session.userId);

  const result = db.prepare(`
    INSERT INTO clients (name, company, phone, email, address, zone, assigned_to, created_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, company, phone || null, email || null, address || null, zone, effectiveAssignedTo, session.userId, notes || null);

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
