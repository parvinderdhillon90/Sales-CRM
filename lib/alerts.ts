import Database from 'better-sqlite3';

let lastScheduledCheck = 0;

function fmt(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

function maybeInsert(
  db: Database.Database,
  rule_type: string,
  severity: string,
  message: string,
  deal_id: number | null,
  about_user_id: number | null,
  recipient_ids: number[],
) {
  const insert = db.prepare(`
    INSERT INTO alerts (rule_type, severity, message, deal_id, about_user_id, recipient_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const rid of recipient_ids) {
    // Deduplicate: skip if an identical alert was created for this recipient in the last 24 hours
    const exists = deal_id !== null
      ? db.prepare(`
          SELECT id FROM alerts
          WHERE rule_type = ? AND deal_id = ? AND recipient_id = ?
            AND created_at > datetime('now', '-24 hours')
          LIMIT 1
        `).get(rule_type, deal_id, rid)
      : db.prepare(`
          SELECT id FROM alerts
          WHERE rule_type = ? AND about_user_id IS ? AND recipient_id = ?
            AND created_at > datetime('now', '-24 hours')
          LIMIT 1
        `).get(rule_type, about_user_id, rid);

    if (!exists) {
      insert.run(rule_type, severity, message, deal_id, about_user_id, rid);
    }
  }
}

/**
 * Run rule-based alert checks.  Throttled to at most once per hour to avoid
 * hammering the DB on every dashboard load.  Recipients are all cmd and
 * director users.
 */
export function runScheduledAlertChecks(db: Database.Database): void {
  try {
    const now = Date.now();
    if (now - lastScheduledCheck < 60 * 60 * 1000) return;
    lastScheduledCheck = now;

    const recipients = db.prepare(`SELECT id FROM users WHERE role IN ('cmd', 'director')`).all() as { id: number }[];
    const rids = recipients.map(r => r.id);
    if (rids.length === 0) return;

    // Rule 1: Hot deal with no contact in 5+ days
    const hotStale = db.prepare(`
      SELECT d.id, d.title,
        u.name as assigned_name,
        CAST(julianday('now') - julianday(COALESCE(d.last_contact_date, d.created_at)) AS INTEGER) as days
      FROM deals d
      LEFT JOIN users u ON d.assigned_to = u.id
      WHERE d.temperature = 'hot'
        AND d.stage NOT IN ('closed_won', 'closed_lost')
        AND (d.last_contact_date IS NULL OR julianday('now') - julianday(d.last_contact_date) >= 5)
    `).all() as any[];

    for (const deal of hotStale) {
      maybeInsert(db, 'hot_stale', 'critical',
        `HOT deal "${deal.title}" — no contact for ${deal.days} day${deal.days !== 1 ? 's' : ''} (${deal.assigned_name})`,
        deal.id, null, rids);
    }

    // Rule 2: Close date has passed on open deals
    const overdue = db.prepare(`
      SELECT d.id, d.title, d.expected_close_date,
        u.name as assigned_name,
        CAST(julianday('now') - julianday(d.expected_close_date) AS INTEGER) as days_overdue
      FROM deals d
      LEFT JOIN users u ON d.assigned_to = u.id
      WHERE d.stage NOT IN ('closed_won', 'closed_lost')
        AND d.expected_close_date IS NOT NULL
        AND d.expected_close_date < date('now')
    `).all() as any[];

    for (const deal of overdue) {
      maybeInsert(db, 'overdue_close', 'warning',
        `Close date passed: "${deal.title}" was due ${deal.days_overdue} day${deal.days_overdue !== 1 ? 's' : ''} ago (${deal.assigned_name})`,
        deal.id, null, rids);
    }

    // Rule 3: Big deal (≥₹1L) closed_lost in the last 25 hours
    const bigLost = db.prepare(`
      SELECT d.id, d.title, d.value,
        u.name as assigned_name
      FROM deals d
      LEFT JOIN users u ON d.assigned_to = u.id
      WHERE d.stage = 'closed_lost'
        AND d.value >= 100000
        AND d.updated_at > datetime('now', '-25 hours')
    `).all() as any[];

    for (const deal of bigLost) {
      maybeInsert(db, 'big_deal_lost', 'critical',
        `Big deal lost: "${deal.title}" (${fmt(deal.value)}) — ${deal.assigned_name}`,
        deal.id, null, rids);
    }

    // Rule 4: Open deals with 3+ close-date slips
    const slips = db.prepare(`
      SELECT d.id, d.title, d.close_date_change_count,
        u.name as assigned_name
      FROM deals d
      LEFT JOIN users u ON d.assigned_to = u.id
      WHERE d.stage NOT IN ('closed_won', 'closed_lost')
        AND d.close_date_change_count >= 3
    `).all() as any[];

    for (const deal of slips) {
      maybeInsert(db, 'date_slip_3plus', 'warning',
        `Close date pushed ${deal.close_date_change_count}× on "${deal.title}" (${deal.assigned_name})`,
        deal.id, null, rids);
    }
  } catch {
    // Never crash the dashboard load due to alert processing
  }
}
