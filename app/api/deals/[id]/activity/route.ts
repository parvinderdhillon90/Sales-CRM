import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(params.id) as any;
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

  if (session.role === 'manager' && deal.assigned_to !== session.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await req.json();
  const { activity_type, description, contact_date } = body;

  if (!activity_type || !description) {
    return NextResponse.json({ error: 'Activity type and description are required' }, { status: 400 });
  }

  // Anti-bypass: minimum meaningful description length
  if (description.trim().length < 15) {
    return NextResponse.json({ error: 'Description must be at least 15 characters. Provide meaningful details.' }, { status: 400 });
  }

  // Anti-bypass: detect suspiciously rapid activity (more than 5 activities in 10 minutes)
  const recentCount = (db.prepare(`
    SELECT COUNT(*) as c FROM deal_activities
    WHERE deal_id = ? AND user_id = ? AND created_at > datetime('now', '-10 minutes')
  `).get(params.id, session.userId) as any).c;

  if (recentCount >= 5) {
    return NextResponse.json({ error: 'Too many activities logged in a short period. Please wait before adding more.' }, { status: 429 });
  }

  db.prepare(`
    INSERT INTO deal_activities (deal_id, user_id, activity_type, description) VALUES (?, ?, ?, ?)
  `).run(params.id, session.userId, activity_type, description.trim());

  // Update last_contact_date if a contact activity
  const contactTypes = ['call', 'email', 'meeting'];
  if (contactTypes.includes(activity_type)) {
    const date = contact_date || new Date().toISOString().split('T')[0];
    db.prepare(`
      UPDATE deals SET last_contact_date = ?, last_contact_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(date, description.trim().substring(0, 500), params.id);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
