import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || String(new Date().getMonth() + 1);
  const year = searchParams.get('year') || String(new Date().getFullYear());

  const targets = db.prepare(`
    SELECT t.*, u.name as user_name, u.zone,
      COALESCE((
        SELECT SUM(d.value)
        FROM deals d
        WHERE d.assigned_to = t.user_id
          AND d.stage = 'closed_won'
          AND strftime('%m', d.updated_at) = printf('%02d', t.month)
          AND strftime('%Y', d.updated_at) = CAST(t.year AS TEXT)
      ), 0) as achieved_revenue,
      COALESCE((
        SELECT COUNT(*)
        FROM deals d
        WHERE d.assigned_to = t.user_id
          AND d.stage = 'closed_won'
          AND strftime('%m', d.updated_at) = printf('%02d', t.month)
          AND strftime('%Y', d.updated_at) = CAST(t.year AS TEXT)
      ), 0) as achieved_deals
    FROM targets t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.month = ? AND t.year = ?
    ORDER BY u.zone
  `).all(month, year);

  return NextResponse.json(targets);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['cmd', 'director'].includes(session.role)) return NextResponse.json({ error: 'Only cmd or director can set targets' }, { status: 403 });

  const db = getDb();
  const body = await req.json();
  const { user_id, month, year, revenue_target, deal_count_target } = body;

  if (!user_id || !month || !year) {
    return NextResponse.json({ error: 'user_id, month, year are required' }, { status: 400 });
  }

  db.prepare(`
    INSERT INTO targets (user_id, month, year, revenue_target, deal_count_target, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, month, year) DO UPDATE SET
      revenue_target = excluded.revenue_target,
      deal_count_target = excluded.deal_count_target
  `).run(user_id, month, year, revenue_target || null, deal_count_target || null, session.userId);

  return NextResponse.json({ ok: true });
}
