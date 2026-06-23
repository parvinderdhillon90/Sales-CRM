import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getRequestSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const client = db.prepare(`
    SELECT c.*, u.name as assigned_user_name, cb.name as created_by_name
    FROM clients c
    LEFT JOIN users u ON c.assigned_to = u.id
    LEFT JOIN users cb ON c.created_by = cb.id
    WHERE c.id = ?
  `).get(params.id) as any;

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session.role === 'manager' && client.zone !== session.zone) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const deals = db.prepare(`
    SELECT d.*, u.name as assigned_user_name,
      CASE WHEN d.last_contact_date IS NULL THEN NULL
           ELSE CAST(julianday('now') - julianday(d.last_contact_date) AS INTEGER)
      END as days_since_contact,
      CASE WHEN d.last_contact_date IS NOT NULL AND
                julianday('now') - julianday(d.last_contact_date) > 14
                AND d.stage NOT IN ('closed_won','closed_lost')
           THEN 1 ELSE 0 END as is_stale
    FROM deals d
    LEFT JOIN users u ON d.assigned_to = u.id
    WHERE d.client_id = ?
    ORDER BY d.created_at DESC
  `).all(params.id);

  return NextResponse.json({ ...client, deals });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getRequestSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(params.id) as any;
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session.role === 'manager' && client.zone !== session.zone) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await req.json();
  const { name, company, phone, email, address, notes, assigned_to } = body;

  // Only director can reassign clients
  const effectiveAssignedTo = session.role === 'director' ? (assigned_to ?? client.assigned_to) : client.assigned_to;

  db.prepare(`
    UPDATE clients SET name=?, company=?, phone=?, email=?, address=?, notes=?, assigned_to=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(name || client.name, company || client.company, phone ?? client.phone, email ?? client.email, address ?? client.address, notes ?? client.notes, effectiveAssignedTo, params.id);

  return NextResponse.json({ ok: true });
}
