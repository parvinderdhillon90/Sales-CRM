import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const zone = searchParams.get('zone');
  const stage = searchParams.get('stage');
  const temperature = searchParams.get('temperature');
  const stale = searchParams.get('stale');
  const assigned_to = searchParams.get('assigned_to');

  let query = `
    SELECT d.*,
      c.name as client_name, c.company as client_company, c.zone as client_zone,
      u.name as assigned_user_name, u.zone as assigned_user_zone,
      CASE WHEN d.last_contact_date IS NULL THEN NULL
           ELSE CAST(julianday('now') - julianday(d.last_contact_date) AS INTEGER)
      END as days_since_contact,
      CASE WHEN d.last_contact_date IS NOT NULL AND
                julianday('now') - julianday(d.last_contact_date) > 14
                AND d.stage NOT IN ('closed_won','closed_lost')
           THEN 1
           WHEN d.last_contact_date IS NULL AND d.stage NOT IN ('closed_won','closed_lost')
           THEN 1
           ELSE 0 END as is_stale
    FROM deals d
    LEFT JOIN clients c ON d.client_id = c.id
    LEFT JOIN users u ON d.assigned_to = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (session.role === 'manager') {
    query += ' AND d.assigned_to = ?';
    params.push(session.userId);
  } else {
    if (assigned_to) { query += ' AND d.assigned_to = ?'; params.push(assigned_to); }
    if (zone) { query += ' AND u.zone = ?'; params.push(zone); }
  }

  if (stage) { query += ' AND d.stage = ?'; params.push(stage); }
  if (temperature) { query += ' AND d.temperature = ?'; params.push(temperature); }
  if (stale === '1') {
    query += ` AND (
      (d.last_contact_date IS NOT NULL AND julianday('now') - julianday(d.last_contact_date) > 14)
      OR (d.last_contact_date IS NULL)
    ) AND d.stage NOT IN ('closed_won','closed_lost')`;
  }

  query += ' ORDER BY CASE d.temperature WHEN \'hot\' THEN 1 WHEN \'warm\' THEN 2 ELSE 3 END, d.updated_at DESC';

  const deals = db.prepare(query).all(...params);
  return NextResponse.json(deals);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const body = await req.json();
  const { title, client_id, value, stage, temperature, expected_close_date, notes, assigned_to } = body;

  if (!title || !client_id) {
    return NextResponse.json({ error: 'Title and client are required' }, { status: 400 });
  }

  // Business rule: anything beyond lead stage requires expected_close_date
  if (stage && stage !== 'lead' && !expected_close_date) {
    return NextResponse.json({ error: 'Expected close date is required for deals beyond Lead stage' }, { status: 400 });
  }

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(client_id) as any;
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 400 });

  if (session.role === 'manager' && client.zone !== session.zone) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const effectiveAssignedTo = session.role === 'director' ? (assigned_to || session.userId) : session.userId;

  const result = db.prepare(`
    INSERT INTO deals (title, client_id, assigned_to, created_by, value, stage, temperature, expected_close_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, client_id, effectiveAssignedTo, session.userId, value || null, stage || 'lead', temperature || 'warm', expected_close_date || null, notes || null);

  const dealId = result.lastInsertRowid;
  db.prepare(`
    INSERT INTO deal_activities (deal_id, user_id, activity_type, description)
    VALUES (?, ?, 'created', ?)
  `).run(dealId, session.userId, `Deal created: ${title}`);

  return NextResponse.json({ id: dealId }, { status: 201 });
}
