import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { runScheduledAlertChecks } from '@/lib/alerts';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  const monthInt = now.getMonth() + 1;
  const yearInt = now.getFullYear();

  const isCmd = session.role === 'cmd';
  const isDirector = session.role === 'director';
  const isManager = session.role === 'manager';

  // Run throttled alert checks for leadership views
  if (isCmd || isDirector) {
    runScheduledAlertChecks(db);
  }

  // ─── User-scoped filter for manager personal view ─────────────────────────
  const userFilter = isManager ? `AND d.assigned_to = ${session.userId}` : '';

  // ─── Basic stats (scoped per role) ───────────────────────────────────────
  const total_deals = (db.prepare(`
    SELECT COUNT(*) as c FROM deals d
    WHERE d.stage NOT IN ('closed_won','closed_lost') ${userFilter}
  `).get() as any).c;

  const hot_deals = (db.prepare(`
    SELECT COUNT(*) as c FROM deals d
    WHERE d.stage NOT IN ('closed_won','closed_lost') AND d.temperature = 'hot' ${userFilter}
  `).get() as any).c;

  const total_clients = (db.prepare(`
    SELECT COUNT(*) as c FROM clients ${isManager ? `WHERE assigned_to = ${session.userId}` : ''}
  `).get() as any).c;

  const stale_deals = (db.prepare(`
    SELECT COUNT(*) as c FROM deals d
    WHERE d.stage NOT IN ('closed_won','closed_lost') ${userFilter}
      AND (
        (d.last_contact_date IS NOT NULL AND julianday('now') - julianday(d.last_contact_date) > 14)
        OR d.last_contact_date IS NULL
      )
  `).get() as any).c;

  const overdue_tasks = (db.prepare(`
    SELECT COUNT(*) as c FROM tasks
    WHERE status = 'overdue' ${isManager ? `AND assigned_to = ${session.userId}` : ''}
  `).get() as any).c;

  const pending_tasks = (db.prepare(`
    SELECT COUNT(*) as c FROM tasks
    WHERE status IN ('pending','in_progress') ${isManager ? `AND assigned_to = ${session.userId}` : ''}
  `).get() as any).c;

  const unread_messages = (db.prepare(`
    SELECT COUNT(*) as c FROM messages WHERE recipient_id = ? AND read_at IS NULL
  `).get(session.userId) as any).c;

  const pipeline_value = (db.prepare(`
    SELECT COALESCE(SUM(d.value), 0) as v FROM deals d
    WHERE d.stage NOT IN ('closed_won','closed_lost') ${userFilter}
  `).get() as any).v;

  const weighted_pipeline = (db.prepare(`
    SELECT COALESCE(SUM(d.value * COALESCE(d.probability, 0.3)), 0) as v FROM deals d
    WHERE d.stage NOT IN ('closed_won','closed_lost') ${userFilter}
  `).get() as any).v;

  const closed_won_month = (db.prepare(`
    SELECT COUNT(*) as c FROM deals d
    WHERE d.stage = 'closed_won' ${userFilter}
      AND strftime('%m', d.updated_at) = ? AND strftime('%Y', d.updated_at) = ?
  `).get(month, year) as any).c;

  const closed_won_value_month = (db.prepare(`
    SELECT COALESCE(SUM(d.value), 0) as v FROM deals d
    WHERE d.stage = 'closed_won' ${userFilter}
      AND strftime('%m', d.updated_at) = ? AND strftime('%Y', d.updated_at) = ?
  `).get(month, year) as any).v;

  const deals_closing_soon = (db.prepare(`
    SELECT COUNT(*) as c FROM deals d
    WHERE d.stage NOT IN ('closed_won','closed_lost') ${userFilter}
      AND d.expected_close_date BETWEEN date('now') AND date('now', '+7 days')
  `).get() as any).c;

  const stage_breakdown = db.prepare(`
    SELECT d.stage, COUNT(*) as count FROM deals d
    WHERE 1=1 ${userFilter} AND d.stage NOT IN ('closed_won','closed_lost')
    GROUP BY d.stage
  `).all() as any[];

  // ─── Zone stats (director and cmd) ───────────────────────────────────────
  let zone_stats: any[] = [];
  if (isDirector || isCmd) {
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

  // ─── Stale deal details ───────────────────────────────────────────────────
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

  // ─── Date slippage (director and cmd) ────────────────────────────────────
  const slip_deals = (isDirector || isCmd) ? db.prepare(`
    SELECT d.id, d.title, d.close_date_change_count, d.expected_close_date, d.stage, d.value,
      c.name as client_name, u.name as assigned_user_name
    FROM deals d
    LEFT JOIN clients c ON d.client_id = c.id
    LEFT JOIN users u ON d.assigned_to = u.id
    WHERE d.close_date_change_count > 0 AND d.stage NOT IN ('closed_won','closed_lost')
    ORDER BY d.close_date_change_count DESC, d.expected_close_date ASC
  `).all() : [];

  // ─── Team member scorecard (cmd and director) ─────────────────────────────
  let team_members: any[] = [];
  if (isCmd || isDirector) {
    const memberRows = db.prepare(`
      SELECT
        u.id as user_id, u.name, u.zone, u.role,
        COALESCE(t.revenue_target, 0) as revenue_target,
        COALESCE((
          SELECT SUM(d.value) FROM deals d
          WHERE d.assigned_to = u.id AND d.stage = 'closed_won'
            AND strftime('%m', d.updated_at) = ? AND strftime('%Y', d.updated_at) = ?
        ), 0) as achieved_revenue,
        COALESCE((
          SELECT SUM(d.value * COALESCE(d.probability, 0.3)) FROM deals d
          WHERE d.assigned_to = u.id AND d.stage NOT IN ('closed_won','closed_lost')
        ), 0) as weighted_pipeline,
        (SELECT COUNT(*) FROM deals d WHERE d.assigned_to = u.id AND d.stage NOT IN ('closed_won','closed_lost')) as total_deals,
        (SELECT COUNT(*) FROM deals d WHERE d.assigned_to = u.id AND d.stage NOT IN ('closed_won','closed_lost') AND d.temperature = 'hot') as hot_deals,
        (SELECT COUNT(*) FROM deals d WHERE d.assigned_to = u.id AND d.stage NOT IN ('closed_won','closed_lost') AND (
          (d.last_contact_date IS NOT NULL AND julianday('now') - julianday(d.last_contact_date) > 14)
          OR d.last_contact_date IS NULL
        )) as stale_deals
      FROM users u
      LEFT JOIN targets t ON t.user_id = u.id AND t.month = ? AND t.year = ?
      WHERE u.role = 'manager'
      ORDER BY u.zone
    `).all(month, year, monthInt, yearInt) as any[];

    // Compute pipeline_coverage for each member
    const members = memberRows.map((m: any) => ({
      ...m,
      pipeline_coverage: m.revenue_target > 0 ? m.weighted_pipeline / m.revenue_target : 0,
    }));

    if (isDirector) {
      // Director sees individual manager rows + team total, but NOT their own personal row
      const teamRevTarget = members.reduce((s: number, m: any) => s + m.revenue_target, 0);
      const teamAchieved  = members.reduce((s: number, m: any) => s + m.achieved_revenue, 0);
      const teamWeighted  = members.reduce((s: number, m: any) => s + m.weighted_pipeline, 0);
      const teamTotalRow = {
        user_id: -1,
        name: 'TEAM TOTAL',
        zone: null,
        role: 'director',
        revenue_target: teamRevTarget,
        achieved_revenue: teamAchieved,
        weighted_pipeline: teamWeighted,
        pipeline_coverage: teamRevTarget > 0 ? teamWeighted / teamRevTarget : 0,
        total_deals: members.reduce((s: number, m: any) => s + m.total_deals, 0),
        hot_deals: members.reduce((s: number, m: any) => s + m.hot_deals, 0),
        stale_deals: members.reduce((s: number, m: any) => s + m.stale_deals, 0),
        is_team_row: true,
      };
      team_members = [...members, teamTotalRow];
    } else {
      // CMD sees all managers + a synthetic Rajesh (team) row + team total
      const director = db.prepare(`SELECT id, name FROM users WHERE role = 'director' LIMIT 1`).get() as any;
      const teamRevTarget = members.reduce((s: number, m: any) => s + m.revenue_target, 0);
      const teamAchieved  = members.reduce((s: number, m: any) => s + m.achieved_revenue, 0);
      const teamWeighted  = members.reduce((s: number, m: any) => s + m.weighted_pipeline, 0);

      const directorRow = director ? {
        user_id: director.id,
        name: director.name + ' (Team)',
        zone: null,
        role: 'director',
        revenue_target: teamRevTarget,
        achieved_revenue: teamAchieved,
        weighted_pipeline: teamWeighted,
        pipeline_coverage: teamRevTarget > 0 ? teamWeighted / teamRevTarget : 0,
        total_deals: members.reduce((s: number, m: any) => s + m.total_deals, 0),
        hot_deals: members.reduce((s: number, m: any) => s + m.hot_deals, 0),
        stale_deals: members.reduce((s: number, m: any) => s + m.stale_deals, 0),
        is_team_row: true,
      } : null;

      team_members = directorRow ? [...members, directorRow] : members;
    }
  }

  // ─── Alerts for current user ──────────────────────────────────────────────
  const my_alerts = (isCmd || isDirector) ? db.prepare(`
    SELECT a.*, d.title as deal_title
    FROM alerts a
    LEFT JOIN deals d ON a.deal_id = d.id
    WHERE a.recipient_id = ? AND a.acknowledged_at IS NULL
    ORDER BY a.created_at DESC
    LIMIT 10
  `).all(session.userId) : [];

  return NextResponse.json({
    total_deals, hot_deals, total_clients, stale_deals, overdue_tasks, pending_tasks,
    unread_messages, pipeline_value, weighted_pipeline,
    closed_won_month, closed_won_value_month,
    deals_closing_soon, zone_stats,
    stage_breakdown: Object.fromEntries(stage_breakdown.map((r: any) => [r.stage, r.count])),
    stale_deal_list,
    slip_deals,
    team_members,
    my_alerts,
  });
}
