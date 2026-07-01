import { prisma } from './prisma';

let lastScheduledCheck = 0;

function fmt(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

async function maybeInsert(
  rule_type: string,
  severity: string,
  message: string,
  deal_id: number | null,
  about_user_id: number | null,
  recipient_ids: number[],
) {
  for (const rid of recipient_ids) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const exists = await prisma.alerts.findFirst({
      where: {
        rule_type,
        recipient_id: rid,
        created_at: { gt: cutoff },
        ...(deal_id !== null ? { deal_id } : { about_user_id }),
      },
      select: { id: true },
    });

    if (!exists) {
      await prisma.alerts.create({
        data: { rule_type, severity, message, deal_id, about_user_id, recipient_id: rid },
      });
    }
  }
}

export async function runScheduledAlertChecks(): Promise<void> {
  try {
    const now = Date.now();
    if (now - lastScheduledCheck < 60 * 60 * 1000) return;
    lastScheduledCheck = now;

    const recipients = await prisma.users.findMany({
      where: { role: { in: ['cmd', 'director'] } },
      select: { id: true },
    });
    const rids = recipients.map(r => r.id);
    if (rids.length === 0) return;

    // Rule 1: Hot deal with no contact in 5+ days
    const hotStale = await prisma.$queryRaw<Array<{
      id: number; title: string; assigned_name: string; days: number;
    }>>`
      SELECT d.id, d.title,
        u.name as assigned_name,
        EXTRACT(DAY FROM (NOW() - COALESCE(d.last_contact_date, d.created_at)))::INTEGER as days
      FROM deals d
      LEFT JOIN users u ON d.assigned_to = u.id
      WHERE d.temperature = 'hot'
        AND d.stage NOT IN ('closed_won', 'closed_lost')
        AND (d.last_contact_date IS NULL OR d.last_contact_date < NOW() - INTERVAL '5 days')
    `;

    for (const deal of hotStale) {
      await maybeInsert('hot_stale', 'critical',
        `HOT deal "${deal.title}" — no contact for ${deal.days} day${deal.days !== 1 ? 's' : ''} (${deal.assigned_name})`,
        deal.id, null, rids);
    }

    // Rule 2: Close date has passed on open deals
    const overdue = await prisma.$queryRaw<Array<{
      id: number; title: string; assigned_name: string; days_overdue: number;
    }>>`
      SELECT d.id, d.title,
        u.name as assigned_name,
        EXTRACT(DAY FROM (NOW() - d.expected_close_date))::INTEGER as days_overdue
      FROM deals d
      LEFT JOIN users u ON d.assigned_to = u.id
      WHERE d.stage NOT IN ('closed_won', 'closed_lost')
        AND d.expected_close_date IS NOT NULL
        AND d.expected_close_date < CURRENT_DATE
    `;

    for (const deal of overdue) {
      await maybeInsert('overdue_close', 'warning',
        `Close date passed: "${deal.title}" was due ${deal.days_overdue} day${deal.days_overdue !== 1 ? 's' : ''} ago (${deal.assigned_name})`,
        deal.id, null, rids);
    }

    // Rule 3: Big deal (≥₹1L) closed_lost in the last 25 hours
    const bigLost = await prisma.$queryRaw<Array<{
      id: number; title: string; value: number; assigned_name: string;
    }>>`
      SELECT d.id, d.title, d.value,
        u.name as assigned_name
      FROM deals d
      LEFT JOIN users u ON d.assigned_to = u.id
      WHERE d.stage = 'closed_lost'
        AND d.value >= 100000
        AND d.updated_at > NOW() - INTERVAL '25 hours'
    `;

    for (const deal of bigLost) {
      await maybeInsert('big_deal_lost', 'critical',
        `Big deal lost: "${deal.title}" (${fmt(Number(deal.value))}) — ${deal.assigned_name}`,
        deal.id, null, rids);
    }

    // Rule 4: Open deals with 3+ close-date slips
    const slips = await prisma.$queryRaw<Array<{
      id: number; title: string; close_date_change_count: number; assigned_name: string;
    }>>`
      SELECT d.id, d.title, d.close_date_change_count,
        u.name as assigned_name
      FROM deals d
      LEFT JOIN users u ON d.assigned_to = u.id
      WHERE d.stage NOT IN ('closed_won', 'closed_lost')
        AND d.close_date_change_count >= 3
    `;

    for (const deal of slips) {
      await maybeInsert('date_slip_3plus', 'warning',
        `Close date pushed ${deal.close_date_change_count}× on "${deal.title}" (${deal.assigned_name})`,
        deal.id, null, rids);
    }
  } catch {
    // Never crash the dashboard load due to alert processing
  }
}
