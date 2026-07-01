import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const zone = searchParams.get('zone');
  const stage = searchParams.get('stage');
  const temperature = searchParams.get('temperature');
  const stale = searchParams.get('stale');
  const assigned_to = searchParams.get('assigned_to');

  const roleFilter = session.role === 'manager'
    ? Prisma.sql`AND d.assigned_to = ${session.userId}`
    : assigned_to
    ? Prisma.sql`AND d.assigned_to = ${Number(assigned_to)}`
    : zone
    ? Prisma.sql`AND u.zone = ${zone}`
    : Prisma.empty;

  const stageFilter = stage ? Prisma.sql`AND d.stage = ${stage}` : Prisma.empty;
  const tempFilter = temperature ? Prisma.sql`AND d.temperature = ${temperature}` : Prisma.empty;
  const staleFilter = stale === '1'
    ? Prisma.sql`AND (
        (d.last_contact_date IS NOT NULL AND d.last_contact_date < NOW() - INTERVAL '14 days')
        OR d.last_contact_date IS NULL
      ) AND d.stage NOT IN ('closed_won','closed_lost')`
    : Prisma.empty;

  const deals = await prisma.$queryRaw<any[]>`
    SELECT d.*,
      c.name as client_name, c.company as client_company, c.zone as client_zone,
      u.name as assigned_user_name, u.zone as assigned_user_zone,
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
    WHERE 1=1
    ${roleFilter}
    ${stageFilter}
    ${tempFilter}
    ${staleFilter}
    ORDER BY CASE d.temperature WHEN 'hot' THEN 1 WHEN 'warm' THEN 2 ELSE 3 END, d.updated_at DESC
  `;

  return NextResponse.json(deals);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { title, client_id, value, stage, temperature, expected_close_date, notes, assigned_to } = body;

  if (!title || !client_id) {
    return NextResponse.json({ error: 'Title and client are required' }, { status: 400 });
  }
  if (stage && stage !== 'lead' && !expected_close_date) {
    return NextResponse.json({ error: 'Expected close date is required for deals beyond Lead stage' }, { status: 400 });
  }

  const client = await prisma.clients.findUnique({ where: { id: Number(client_id) } });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 400 });
  if (session.role === 'manager' && client.zone !== session.zone) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const effectiveAssignedTo = session.role === 'director'
    ? (assigned_to ? Number(assigned_to) : session.userId)
    : session.userId;

  const deal = await prisma.deals.create({
    data: {
      title,
      client_id: Number(client_id),
      assigned_to: effectiveAssignedTo,
      created_by: session.userId,
      value: value ? Number(value) : null,
      stage: stage || 'lead',
      temperature: temperature || 'warm',
      expected_close_date: expected_close_date ? new Date(expected_close_date) : null,
      notes: notes || null,
    },
  });

  await prisma.deal_activities.create({
    data: {
      deal_id: deal.id,
      user_id: session.userId,
      activity_type: 'created',
      description: `Deal created: ${title}`,
    },
  });

  return NextResponse.json({ id: deal.id }, { status: 201 });
}
