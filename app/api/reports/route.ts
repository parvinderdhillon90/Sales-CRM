import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = getRequestSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());

  // Dashboard stats for current user (or all for director)
  const isDirector = session.role === 'director';
  const userFilter = isDirector ? '' : `AND d.assigned_to = ${session.userId}`;

  const total_deals = (db.prepare(`SELECT COUNT(*) as c FROM deals d WHERE d.stage NOT IN ('closed_won','closed_lost') ${userFilter}`).get() as any).c;
  const hot_deals = (db.prepare(`SELECT COUNT(*) as c FROM deals d WHERE d.stage NOT IN ('closed_won','closed_lost') AND d.temperature = 'hot' ${userFilter}`).get() as any).c;
  const total_clients = (db.prepare(`SELECT COUNT(*) as c FROM clients ${isDirector ? '' : `WHERE assigned_to = ${session.userId}`}`).get() as any).c;

  const stale_deals = (db.prepare(`
    SELECT COUNT(*) as c FROM deals d WHERE d.stage NOT IN ('closed_won','closed_lost') ${userFilter}
    AND (
      (d.last_contact_date IS NOT NULL AND julianday('now') - julianday(d.last_contact_date) > 14)
      OR d.last_contact_date IS NULL
    )
  `).get() as any).c;

  const overdue_tasks = (db.prepare(`
    SELECT COUNT(*) as c FROM tasks WHERE status = 'overdue' ${isDirector ? '' : `AND assigned_to = ${session.userId}`}
  `).get() as any).c;

  const pending_tasks = (db.prepare(`
    SELECT COUNT(*) as c FROM tasks WHERE status IN ('pending','in_progress') ${isDirector ? '' : `AND assigned_to = ${session.userId}`}
  `).get() as any).c;

  const unread_messages = (db.prepare(`
    SELECT COUNT(*) as c FROM messages WHERE recipient_id = ? AND read_at IS NULL
  `).get(session.userId) as any).c;

  const pipeline_value = (db.prepare(`
    SELECT COALESCE(SUM(d.value), 0) as v FROM deals d WHERE d.stage NOT IN ('closed_won','closed_lost') ${userFilter}
  `).get() as any).v;

  const closed_won_month = (db.prepare(`
    SELECT COUNT(*) as c FROM deals d WHERE d.stage = 'closed_won' ${userFilter}
    AND strftime('%m', d.updated_at) = ? AND strftime('%Y', d.updated_at) = ?
  `).get(month, year) as any).c;

  const closed_won_value_month = (db.prepare(`
    SELECT COALESCE(SUM(d.value), 0) as v FROM deals d WHERE d.stage = 'closed_won' ${userFilter}
    AND strftime('%m', d.updated_at) = ? AND strftime('%Y', d.updated_at) = ?
  `).get(month, year) as any).v;

  const deals_closing_soon = (db.prepare(`
    SELECT COUNT(*) as c FROM deals d WHERE d.stage NOT IN ('closed_won','closed_lost') ${userFilter}
    AND d.expected_close_date BETWEEN date('now') AND date('now', '+7 days')
  `).get() as any).c;

  const stage_breakdown = db.prepare(`
    SELECT d.stage, COUNT(*) as count FROM deals d WHERE 1=1 ${userFilter}
    AND d.stage NOT IN ('closed_won','closed_lost')
    GROUP BY d.stage
  `).all() as any[];

  let zone_stats: any[] = [];
  if (isDirector) {
    zone_stats = db.prepare(`
      SELECT
        u.zone,
        u.name as manager_name,
        COUNT(CASE WHEN d.stage NOT IN ('closed_won','closed_lost') THEN 1 END) as total_deals,
        COUNT(CASE WHEN d.temperature = 'hot' AND d.stage NOT IN ('closed_won','closed_lost') THEN 1 END) as hot_deals,
        COUNT(CASE WHEN d.stage NOT IN ('closed_won','closed_lost') AND (
          (d.last_contact_date IS NOT NULL AND julianday('now') - julianday(d.last_contact_date) > 14)
          OR d.last_contact_date IS NULL
        ) THEN 1 END) as stale_deals,
        COALESCE(SUM(CASE WHEN d.stage NOT IN ('closed_won','closed_lost') THEN d.value END), 0) as pipeline_value,
        COUNT(CASE WHEN d.stage = 'closed_won'
          AND strftime('%m', d.updated_at) = '${month}'
          AND strftime('%Y', d.updated_at) = '${year}'
          THEN 1 END) as closed_won_month,
        COALESCE(AVG(CASE WHEN d.last_contact_date IS NOT NULL AND d.stage NOT IN ('closed_won','closed_lost')
          THEN julianday('now') - julianday(d.last_contact_date) END), 0) as avg_days_since_contact,
        COALESCE(SUM(d.close_date_change_count), 0) as date_slips_total
      FROM users u
      LEFT JOIN deals d ON d.assigned_to = u.id
      WHERE u.role = 'manager'
      GROUP BY u.id
      ORDER BY u.zone
    `).all();
  }

  // Stale deals details
  const stale_deal_list = db.prepare(`
    SELECT d.id, d.title, d.temperature, d.stage, d.value, d.expected_close_date,
      d.last_contact_date, d.close_date_change_count,
      c.name as client_name, c.company,
      u.name as assigned_user_name,
      CAST(julianday('now') - julianday(COALESCE(d.last_contact_date, d.created_at)) AS INTEGER) as days_since_contact
    FROM deals d
    LEFT JOIN clients c ON d.client_id = c.id
    LEFT JOIN users u ON d.assigned_to = u.id
    WHERE d.stage NOT IN ('closed_won','closed_lost') ${userFilter}
    AND (
      (d.last_contact_date IS NOT NULL AND julianday('now') - julianday(d.last_contact_date) > 14)
      OR d.last_contact_date IS NULL
    )
    ORDER BY days_since_contact DESC
  `).all();

  // Deals with date slippage
  const slip_deals = isDirector ? db.prepare(`
    SELECT d.id, d.title, d.close_date_change_count, d.expected_close_date, d.stage, d.value,
      c.name as client_name, u.name as assigned_user_name
    FROM deals d
    LEFT JOIN clients c ON d.client_id = c.id
    LEFT JOIN users u ON d.assigned_to = u.id
    WHERE d.close_date_change_count > 0 AND d.stage NOT IN ('closed_won','closed_lost')
    ORDER BY d.close_date_change_count DESC, d.expected_close_date ASC
  `).all() : [];

  return NextResponse.json({
    total_deals, hot_deals, total_clients, stale_deals, overdue_tasks, pending_tasks,
    unread_messages, pipeline_value, closed_won_month, closed_won_value_month,
    deals_closing_soon, zone_stats,
    stage_breakdown: Object.fromEntries(stage_breakdown.map((r: any) => [r.stage, r.count])),
    stale_deal_list,
    slip_deals,
  });
}
