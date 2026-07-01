import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const STAGE_ORDER = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const dealId = Number(id);

  const rows = await prisma.$queryRaw<any[]>`
    SELECT d.*,
      c.name as client_name, c.company as client_company, c.phone as client_phone,
      c.email as client_email, c.zone as client_zone,
      u.name as assigned_user_name, u.zone as assigned_user_zone,
      cb.name as created_by_name,
      CASE WHEN d.last_contact_date IS NULL THEN NULL
           ELSE EXTRACT(DAY FROM (NOW() - d.last_contact_date))::INTEGER
      END as days_since_contact,
      CASE WHEN d.last_contact_date IS NOT NULL
                AND d.last_contact_date < NOW() - INTERVAL '14 days'
                AND d.stage NOT IN ('closed_won','closed_lost')
           THEN 1
           WHEN d.last_contact_date IS NULL AND d.stage NOT IN ('closed_won','closed_lost')
           THEN 1
           ELSE 0 END as is_stale
    FROM deals d
    LEFT JOIN clients c ON d.client_id = c.id
    LEFT JOIN users u ON d.assigned_to = u.id
    LEFT JOIN users cb ON d.created_by = cb.id
    WHERE d.id = ${dealId}
  `;

  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const deal = rows[0];

  if (session.role === 'manager' && deal.assigned_to !== session.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const activities = await prisma.deal_activities.findMany({
    where: { deal_id: dealId },
    include: { user: { select: { name: true } } },
    orderBy: { created_at: 'asc' },
  });

  const tasks = await prisma.tasks.findMany({
    where: { deal_id: dealId },
    include: { assigned_user: { select: { name: true } } },
    orderBy: { due_date: 'asc' },
  });

  const activitiesOut = activities.map(a => ({ ...a, user_name: a.user.name, user: undefined }));
  const tasksOut = tasks.map(t => ({ ...t, assigned_user_name: t.assigned_user.name, assigned_user: undefined }));

  return NextResponse.json({ ...deal, activities: activitiesOut, tasks: tasksOut });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const dealId = Number(id);

  const deal = await prisma.deals.findUnique({ where: { id: dealId } });
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.role === 'manager' && deal.assigned_to !== session.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await req.json();
  const updateData: Record<string, any> = {};
  const logEntries: Array<{
    deal_id: number; user_id: number; activity_type: string; description: string;
    old_value?: string | null; new_value?: string | null;
  }> = [];

  if (body.stage && body.stage !== deal.stage) {
    const newIdx = STAGE_ORDER.indexOf(body.stage);
    const oldIdx = STAGE_ORDER.indexOf(deal.stage);

    if (session.role === 'manager' && newIdx < oldIdx) {
      return NextResponse.json({ error: 'Only the director can move a deal to a previous stage' }, { status: 403 });
    }
    if (body.stage !== 'lead' && body.stage !== 'closed_lost' && !deal.expected_close_date && !body.expected_close_date) {
      return NextResponse.json({ error: 'Expected close date is required before moving past Lead stage' }, { status: 400 });
    }
    if (body.stage === 'closed_lost' && !body.loss_reason) {
      return NextResponse.json({ error: 'Loss reason is required when marking a deal as Closed Lost' }, { status: 400 });
    }
    if ((body.stage === 'closed_won' || body.stage === 'closed_lost') && !deal.last_contact_summary && !body.last_contact_summary) {
      return NextResponse.json({ error: 'Last contact summary is required before closing a deal' }, { status: 400 });
    }
    updateData.stage = body.stage;
    logEntries.push({ deal_id: dealId, user_id: session.userId, activity_type: 'stage_change',
      description: body.stage_note || `Stage changed to ${body.stage}`, old_value: deal.stage, new_value: body.stage });
  }

  if (body.temperature && body.temperature !== deal.temperature) {
    if (!body.temperature_note || body.temperature_note.trim().length < 10) {
      return NextResponse.json({ error: 'Provide a reason (min 10 chars) when changing deal temperature' }, { status: 400 });
    }
    updateData.temperature = body.temperature;
    logEntries.push({ deal_id: dealId, user_id: session.userId, activity_type: 'temperature_change',
      description: body.temperature_note, old_value: deal.temperature, new_value: body.temperature });
  }

  if (body.expected_close_date !== undefined && body.expected_close_date !== (deal.expected_close_date?.toISOString().split('T')[0] ?? null)) {
    const newCount = (deal.close_date_change_count ?? 0) + (deal.expected_close_date ? 1 : 0);
    updateData.expected_close_date = body.expected_close_date ? new Date(body.expected_close_date) : null;
    updateData.close_date_change_count = newCount;
    if (deal.expected_close_date) {
      logEntries.push({ deal_id: dealId, user_id: session.userId, activity_type: 'close_date_change',
        description: `Close date changed: ${body.close_date_reason || 'No reason provided'}`,
        old_value: deal.expected_close_date.toISOString().split('T')[0], new_value: body.expected_close_date });
    }
  }

  if (body.value !== undefined && body.value !== deal.value) {
    updateData.value = body.value ? Number(body.value) : null;
    logEntries.push({ deal_id: dealId, user_id: session.userId, activity_type: 'value_change',
      description: `Deal value updated to ₹${(Number(body.value) || 0).toLocaleString()}`,
      old_value: String(deal.value), new_value: String(body.value) });
  }

  if (body.last_contact_date) {
    if (!body.last_contact_summary || body.last_contact_summary.trim().length < 15) {
      return NextResponse.json({ error: 'Contact summary must be at least 15 characters' }, { status: 400 });
    }
    updateData.last_contact_date = new Date(body.last_contact_date);
    updateData.last_contact_summary = body.last_contact_summary;
    logEntries.push({ deal_id: dealId, user_id: session.userId, activity_type: body.contact_type || 'note',
      description: body.last_contact_summary });
  }

  if (body.notes !== undefined) updateData.notes = body.notes || null;
  if (body.loss_reason !== undefined) updateData.loss_reason = body.loss_reason || null;

  if (body.assigned_to && session.role === 'director') {
    updateData.assigned_to = Number(body.assigned_to);
    logEntries.push({ deal_id: dealId, user_id: session.userId, activity_type: 'assignment_change',
      description: 'Deal reassigned', old_value: String(deal.assigned_to), new_value: String(body.assigned_to) });
  }

  if (Object.keys(updateData).length === 0 && logEntries.length === 0) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
  }

  if (Object.keys(updateData).length > 0) {
    updateData.updated_at = new Date();
    await prisma.deals.update({ where: { id: dealId }, data: updateData });
  }

  if (logEntries.length > 0) {
    await prisma.deal_activities.createMany({ data: logEntries });
  }

  return NextResponse.json({ ok: true });
}
