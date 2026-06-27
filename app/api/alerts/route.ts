import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const countOnly = searchParams.get('count') === '1';

  if (countOnly) {
    const count = (db.prepare(`
      SELECT COUNT(*) as c FROM alerts
      WHERE recipient_id = ? AND acknowledged_at IS NULL
    `).get(session.userId) as any).c;
    return NextResponse.json({ count });
  }

  const alerts = db.prepare(`
    SELECT a.*, d.title as deal_title
    FROM alerts a
    LEFT JOIN deals d ON a.deal_id = d.id
    WHERE a.recipient_id = ? AND a.acknowledged_at IS NULL
    ORDER BY a.created_at DESC
    LIMIT 20
  `).all(session.userId);

  return NextResponse.json(alerts);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { id, all } = await req.json();

  if (all) {
    db.prepare(`
      UPDATE alerts SET acknowledged_at = CURRENT_TIMESTAMP
      WHERE recipient_id = ? AND acknowledged_at IS NULL
    `).run(session.userId);
  } else if (id) {
    db.prepare(`
      UPDATE alerts SET acknowledged_at = CURRENT_TIMESTAMP
      WHERE id = ? AND recipient_id = ?
    `).run(id, session.userId);
  }

  return NextResponse.json({ ok: true });
}
