import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

const STAGE_ORDER = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getRequestSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const deal = db.prepare(`
    SELECT d.*,
      c.name as client_name, c.company as client_company, c.phone as client_phone,
      c.email as client_email, c.zone as client_zone,
      u.name as assigned_user_name, u.zone as assigned_user_zone,
      cb.name as created_by_name,
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
    LEFT JOIN users cb ON d.created_by = cb.id
    WHERE d.id = ?
  `).get(params.id) as any;

  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session.role === 'manager' && deal.assigned_to !== session.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const activities = db.prepare(`
    SELECT a.*, u.name as user_name
    FROM deal_activities a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.deal_id = ?
    ORDER BY a.created_at ASC
  `).all(params.id);

  const tasks = db.prepare(`
    SELECT t.*, u.name as assigned_user_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.deal_id = ?
    ORDER BY t.due_date ASC
  `).all(params.id);

  return NextResponse.json({ ...deal, activities, tasks });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getRequestSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(params.id) as any;
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session.role === 'manager' && deal.assigned_to !== session.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await req.json();
  const updates: string[] = [];
  const logEntries: any[] = [];
  const now = new Date().toISOString();

  // Stage change — validate and log
  if (body.stage && body.stage !== deal.stage) {
    const newIdx = STAGE_ORDER.indexOf(body.stage);
    const oldIdx = STAGE_ORDER.indexOf(deal.stage);

    // Managers cannot move stage backward
    if (session.role === 'manager' && newIdx < oldIdx) {
      return NextResponse.json({ error: 'Only the director can move a deal to a previous stage' }, { status: 403 });
    }

    // Past lead: expected_close_date mandatory
    if (body.stage !== 'lead' && body.stage !== 'closed_lost' && !deal.expected_close_date && !body.expected_close_date) {
      return NextResponse.json({ error: 'Expected close date is required before moving past Lead stage' }, { status: 400 });
    }

    // Closed lost: loss_reason mandatory
    if (body.stage === 'closed_lost' && !body.loss_reason) {
      return NextResponse.json({ error: 'Loss reason is required when marking a deal as Closed Lost' }, { status: 400 });
    }

    // Closed won/lost: last_contact_summary mandatory
    if ((body.stage === 'closed_won' || body.stage === 'closed_lost') && !deal.last_contact_summary && !body.last_contact_summary) {
      return NextResponse.json({ error: 'Last contact summary is required before closing a deal' }, { status: 400 });
    }

    updates.push(`stage = '${body.stage}'`);
    logEntries.push([params.id, session.userId, 'stage_change', body.stage_note || `Stage changed to ${body.stage}`, deal.stage, body.stage, now]);
  }

  // Temperature change
  if (body.temperature && body.temperature !== deal.temperature) {
    if (!body.temperature_note || body.temperature_note.trim().length < 10) {
      return NextResponse.json({ error: 'Provide a reason (min 10 chars) when changing deal temperature' }, { status: 400 });
    }
    updates.push(`temperature = '${body.temperature}'`);
    logEntries.push([params.id, session.userId, 'temperature_change', body.temperature_note, deal.temperature, body.temperature, now]);
  }

  // Close date change — tracked and counted
  if (body.expected_close_date !== undefined && body.expected_close_date !== deal.expected_close_date) {
    const newCount = deal.close_date_change_count + (deal.expected_close_date ? 1 : 0);
    updates.push(`expected_close_date = ${body.expected_close_date ? `'${body.expected_close_date}'` : 'NULL'}`);
    updates.push(`close_date_change_count = ${newCount}`);
    if (deal.expected_close_date) {
      const reason = body.close_date_reason || 'No reason provided';
      logEntries.push([params.id, session.userId, 'close_date_change', `Close date changed: ${reason}`, deal.expected_close_date, body.expected_close_date, now]);
    }
  }

  // Value change
  if (body.value !== undefined && body.value !== deal.value) {
    updates.push(`value = ${body.value || 'NULL'}`);
    logEntries.push([params.id, session.userId, 'value_change', `Deal value updated to ₹${(body.value || 0).toLocaleString()}`, String(deal.value), String(body.value), now]);
  }

  // Last contact (mandatory when provided)
  if (body.last_contact_date) {
    if (!body.last_contact_summary || body.last_contact_summary.trim().length < 15) {
      return NextResponse.json({ error: 'Contact summary must be at least 15 characters' }, { status: 400 });
    }
    updates.push(`last_contact_date = '${body.last_contact_date}'`);
    updates.push(`last_contact_summary = '${body.last_contact_summary.replace(/'/g, "''")}'`);

    const type = body.contact_type || 'note';
    logEntries.push([params.id, session.userId, type, body.last_contact_summary, null, null, now]);
  }

  // Other fields
  if (body.notes !== undefined) updates.push(`notes = ${body.notes ? `'${body.notes.replace(/'/g, "''")}'` : 'NULL'}`);
  if (body.loss_reason !== undefined) updates.push(`loss_reason = ${body.loss_reason ? `'${body.loss_reason.replace(/'/g, "''")}'` : 'NULL'}`);

  // Director only: reassign
  if (body.assigned_to && session.role === 'director') {
    updates.push(`assigned_to = ${body.assigned_to}`);
    logEntries.push([params.id, session.userId, 'assignment_change', `Deal reassigned`, String(deal.assigned_to), String(body.assigned_to), now]);
  }

  if (updates.length === 0 && logEntries.length === 0) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    db.prepare(`UPDATE deals SET ${updates.join(', ')} WHERE id = ?`).run(params.id);
  }

  const insertActivity = db.prepare(
    `INSERT INTO deal_activities (deal_id, user_id, activity_type, description, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const entry of logEntries) {
    insertActivity.run(...entry);
  }

  return NextResponse.json({ ok: true });
}
