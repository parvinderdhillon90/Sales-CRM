import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { runScheduledAlertChecks } from '@/lib/alerts';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const monthInt = now.getMonth() + 1;
  const yearInt = now.getFullYear();

  const isCmd = session.role === 'cmd';
  const isDirector = session.role === 'director';
  const isManager = session.role === 'manager';

  if (isCmd || isDirector) {
    runScheduledAlertChecks().catch(() => {});
  }

  const userFilter: Prisma.dealsWhereInput = isManager ? { assigned_to: session.userId } : {};
  const taskFilter = isManager ? { assigned_to: session.userId } : {};

  const [
    total_deals,
    hot_deals,
    total_clients,
    stale_deals,
    overdue_tasks,
    pending_tasks,
    unread_messages,
    pipeline_agg,
    weighted_agg,
    closed_won_month,
    closed_won_value_agg,
    deals_closing_soon,
    stage_breakdown,
  ] = await Promise.all([
    prisma.deals.count({ where: { ...userFilter, stage: { notIn: ['closed_won', 'closed_lost'] } } }),
    prisma.deals.count({ where: { ...userFilter, stage: { notIn: ['closed_won', 'closed_lost'] }, temperature: 'hot' } }),
    isManager
      ? prisma.clients.count({ where: { assigned_to: session.userId } })
      : prisma.clients.count(),
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::BIGINT as c FROM deals d
      WHERE d.stage NOT IN ('closed_won','closed_lost')
        ${isManager ? Prisma.sql`AND d.assigned_to = ${session.userId}` : Prisma.empty}
        AND (
          (d.last_contact_date IS NOT NULL AND d.last_contact_date < NOW() - INTERVAL '14 days')
          OR d.last_contact_date IS NULL
        )
    `,
    prisma.tasks.count({ where: { ...taskFilter, status: 'overdue' } }),
    prisma.tasks.count({ where: { ...taskFilter, status: { in: ['pending', 'in_progress'] } } }),
    prisma.messages.count({ where: { recipient_id: session.userId, read_at: null } }),
    prisma.deals.aggregate({
      where: { ...userFilter, stage: { notIn: ['closed_won', 'closed_lost'] } },
      _sum: { value: true },
    }),
    prisma.$queryRaw<Array<{ v: number }>>`
      SELECT COALESCE(SUM(d.value * COALESCE(d.probability, 0.3)), 0)::FLOAT as v FROM deals d
      WHERE d.stage NOT IN ('closed_won','closed_lost')
        ${isManager ? Prisma.sql`AND d.assigned_to = ${session.userId}` : Prisma.empty}
    `,
    prisma.deals.count({
      where: {
        ...userFilter,
        stage: 'closed_won',
        updated_at: {
          gte: new Date(yearInt, monthInt - 1, 1),
          lt: new Date(monthInt === 12 ? yearInt + 1 : yearInt, monthInt === 12 ? 0 : monthInt, 1),
        },
      },
    }),
    prisma.deals.aggregate({
      where: {
        ...userFilter,
        stage: 'closed_won',
        updated_at: {
          gte: new Date(yearInt, monthInt - 1, 1),
          lt: new Date(monthInt === 12 ? yearInt + 1 : yearInt, monthInt === 12 ? 0 : monthInt, 1),
        },
      },
      _sum: { value: true },
    }),
    prisma.deals.count({
      where: {
        ...userFilter,
        stage: { notIn: ['closed_won', 'closed_lost'] },
        expected_close_date: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.deals.groupBy({
      by: ['stage'],
      where: { ...userFilter, stage: { notIn: ['closed_won', 'closed_lost'] } },
      _count: { id: true },
    }),
  ]);

  // ─── Zone stats (director and cmd) ────────────────────────────────────────
  let zone_stats: any[] = [];
  if (isDirector || isCmd) {
    zone_stats = await prisma.$queryRaw<any[]>`
      SELECT
        u.zone,
        u.name as manager_name,
        COUNT(CASE WHEN d.stage NOT IN ('closed_won','closed_lost') THEN 1 END)::INTEGER as total_deals,
        COUNT(CASE WHEN d.temperature = 'hot' AND d.stage NOT IN ('closed_won','closed_lost') THEN 1 END)::INTEGER as hot_deals,
        COUNT(CASE WHEN d.stage NOT IN ('closed_won','closed_lost') AND (
          (d.last_contact_date IS NOT NULL AND d.last_contact_date < NOW() - INTERVAL '14 days')
          OR d.last_contact_date IS NULL
        ) THEN 1 END)::INTEGER as stale_deals,
        COALESCE(SUM(CASE WHEN d.stage NOT IN ('closed_won','closed_lost') THEN d.value END), 0)::FLOAT as pipeline_value,
        COUNT(CASE WHEN d.stage = 'closed_won'
          AND EXTRACT(MONTH FROM d.updated_at) = ${monthInt}
          AND EXTRACT(YEAR FROM d.updated_at) = ${yearInt}
          THEN 1 END)::INTEGER as closed_won_month,
        COALESCE(AVG(CASE WHEN d.last_contact_date IS NOT NULL AND d.stage NOT IN ('closed_won','closed_lost')
          THEN EXTRACT(DAY FROM (NOW() - d.last_contact_date)) END), 0)::FLOAT as avg_days_since_contact,
        COALESCE(SUM(d.close_date_change_count), 0)::INTEGER as date_slips_total
      FROM users u
      LEFT JOIN deals d ON d.assigned_to = u.id
      WHERE u.role = 'manager'
      GROUP BY u.id, u.zone, u.name
      ORDER BY u.zone
    `;
  }

  // ─── Stale deal details ──────────────────────────────────────────────────
  const stale_deal_list = await prisma.$queryRaw<any[]>`
    SELECT d.id, d.title, d.temperature, d.stage, d.value::FLOAT as value, d.expected_close_date,
      d.last_contact_date, d.close_date_change_count,
      c.name as client_name, c.company,
      u.name as assigned_user_name,
      EXTRACT(DAY FROM (NOW() - COALESCE(d.last_contact_date, d.created_at)))::INTEGER as days_since_contact
    FROM deals d
    LEFT JOIN clients c ON d.client_id = c.id
    LEFT JOIN users u ON d.assigned_to = u.id
    WHERE d.stage NOT IN ('closed_won','closed_lost')
      ${isManager ? Prisma.sql`AND d.assigned_to = ${session.userId}` : Prisma.empty}
      AND (
        (d.last_contact_date IS NOT NULL AND d.last_contact_date < NOW() - INTERVAL '14 days')
        OR d.last_contact_date IS NULL
      )
    ORDER BY days_since_contact DESC
  `;

  // ─── Date slippage (director and cmd) ────────────────────────────────────
  const slip_deals = (isDirector || isCmd) ? await prisma.$queryRaw<any[]>`
    SELECT d.id, d.title, d.close_date_change_count, d.expected_close_date, d.stage, d.value::FLOAT as value,
      c.name as client_name, u.name as assigned_user_name
    FROM deals d
    LEFT JOIN clients c ON d.client_id = c.id
    LEFT JOIN users u ON d.assigned_to = u.id
    WHERE d.close_date_change_count > 0 AND d.stage NOT IN ('closed_won','closed_lost')
    ORDER BY d.close_date_change_count DESC, d.expected_close_date ASC
  ` : [];

  // ─── Team member scorecard (cmd and director) ─────────────────────────────
  let team_members: any[] = [];
  if (isCmd || isDirector) {
    const memberRows = await prisma.$queryRaw<any[]>`
      SELECT
        u.id as user_id, u.name, u.zone, u.role,
        COALESCE(t.revenue_target, 0)::FLOAT as revenue_target,
        COALESCE((
          SELECT SUM(d.value)::FLOAT FROM deals d
          WHERE d.assigned_to = u.id AND d.stage = 'closed_won'
            AND EXTRACT(MONTH FROM d.updated_at) = ${monthInt}
            AND EXTRACT(YEAR FROM d.updated_at) = ${yearInt}
        ), 0) as achieved_revenue,
        COALESCE((
          SELECT SUM(d.value * COALESCE(d.probability, 0.3))::FLOAT FROM deals d
          WHERE d.assigned_to = u.id AND d.stage NOT IN ('closed_won','closed_lost')
        ), 0) as weighted_pipeline,
        (SELECT COUNT(*)::INTEGER FROM deals d WHERE d.assigned_to = u.id AND d.stage NOT IN ('closed_won','closed_lost')) as total_deals,
        (SELECT COUNT(*)::INTEGER FROM deals d WHERE d.assigned_to = u.id AND d.stage NOT IN ('closed_won','closed_lost') AND d.temperature = 'hot') as hot_deals,
        (SELECT COUNT(*)::INTEGER FROM deals d WHERE d.assigned_to = u.id AND d.stage NOT IN ('closed_won','closed_lost') AND (
          (d.last_contact_date IS NOT NULL AND d.last_contact_date < NOW() - INTERVAL '14 days')
          OR d.last_contact_date IS NULL
        )) as stale_deals
      FROM users u
      LEFT JOIN targets t ON t.user_id = u.id AND t.month = ${monthInt} AND t.year = ${yearInt}
      WHERE u.role = 'manager'
      ORDER BY u.zone
    `;

    const members = memberRows.map((m: any) => ({
      ...m,
      revenue_target: Number(m.revenue_target),
      achieved_revenue: Number(m.achieved_revenue),
      weighted_pipeline: Number(m.weighted_pipeline),
      total_deals: Number(m.total_deals),
      hot_deals: Number(m.hot_deals),
      stale_deals: Number(m.stale_deals),
      pipeline_coverage: Number(m.revenue_target) > 0 ? Number(m.weighted_pipeline) / Number(m.revenue_target) : 0,
    }));

    if (isDirector) {
      const teamRevTarget = members.reduce((s, m) => s + m.revenue_target, 0);
      const teamAchieved = members.reduce((s, m) => s + m.achieved_revenue, 0);
      const teamWeighted = members.reduce((s, m) => s + m.weighted_pipeline, 0);
      team_members = [...members, {
        user_id: -1, name: 'TEAM TOTAL', zone: null, role: 'director',
        revenue_target: teamRevTarget, achieved_revenue: teamAchieved, weighted_pipeline: teamWeighted,
        pipeline_coverage: teamRevTarget > 0 ? teamWeighted / teamRevTarget : 0,
        total_deals: members.reduce((s, m) => s + m.total_deals, 0),
        hot_deals: members.reduce((s, m) => s + m.hot_deals, 0),
        stale_deals: members.reduce((s, m) => s + m.stale_deals, 0),
        is_team_row: true,
      }];
    } else {
      const director = await prisma.users.findFirst({
        where: { role: 'director' },
        select: { id: true, name: true },
      });
      const teamRevTarget = members.reduce((s, m) => s + m.revenue_target, 0);
      const teamAchieved = members.reduce((s, m) => s + m.achieved_revenue, 0);
      const teamWeighted = members.reduce((s, m) => s + m.weighted_pipeline, 0);
      const directorRow = director ? {
        user_id: director.id, name: director.name + ' (Team)', zone: null, role: 'director',
        revenue_target: teamRevTarget, achieved_revenue: teamAchieved, weighted_pipeline: teamWeighted,
        pipeline_coverage: teamRevTarget > 0 ? teamWeighted / teamRevTarget : 0,
        total_deals: members.reduce((s, m) => s + m.total_deals, 0),
        hot_deals: members.reduce((s, m) => s + m.hot_deals, 0),
        stale_deals: members.reduce((s, m) => s + m.stale_deals, 0),
        is_team_row: true,
      } : null;
      team_members = directorRow ? [...members, directorRow] : members;
    }
  }

  // ─── Alerts for current user ──────────────────────────────────────────────
  const my_alerts = (isCmd || isDirector) ? await prisma.alerts.findMany({
    where: { recipient_id: session.userId, acknowledged_at: null },
    include: { deal: { select: { title: true } } },
    orderBy: { created_at: 'desc' },
    take: 10,
  }).then(alerts => alerts.map(a => ({ ...a, deal_title: a.deal?.title ?? null, deal: undefined }))) : [];

  return NextResponse.json({
    total_deals,
    hot_deals,
    total_clients,
    stale_deals: Number(stale_deals[0]?.c ?? 0),
    overdue_tasks,
    pending_tasks,
    unread_messages,
    pipeline_value: pipeline_agg._sum.value ?? 0,
    weighted_pipeline: Number(weighted_agg[0]?.v ?? 0),
    closed_won_month,
    closed_won_value_month: closed_won_value_agg._sum.value ?? 0,
    deals_closing_soon,
    zone_stats,
    stage_breakdown: Object.fromEntries(stage_breakdown.map(r => [r.stage, r._count.id])),
    stale_deal_list,
    slip_deals,
    team_members,
    my_alerts,
  });
}
