import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const zone = searchParams.get('zone');
  const search = searchParams.get('search') || '';

  const zoneFilter = session.role === 'manager'
    ? Prisma.sql`AND c.zone = ${session.zone}`
    : zone
    ? Prisma.sql`AND c.zone = ${zone}`
    : Prisma.empty;

  const searchFilter = search
    ? Prisma.sql`AND (c.name ILIKE ${'%' + search + '%'} OR c.company ILIKE ${'%' + search + '%'} OR c.phone ILIKE ${'%' + search + '%'} OR c.email ILIKE ${'%' + search + '%'})`
    : Prisma.empty;

  const clients = await prisma.$queryRaw<any[]>`
    SELECT c.*, u.name as assigned_user_name,
           COUNT(d.id)::INTEGER as deal_count
    FROM clients c
    LEFT JOIN users u ON c.assigned_to = u.id
    LEFT JOIN deals d ON d.client_id = c.id
    WHERE 1=1
    ${zoneFilter}
    ${searchFilter}
    GROUP BY c.id, u.name
    ORDER BY c.updated_at DESC
  `;

  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, company, phone, email, address, zone, assigned_to, notes } = body;

  if (!name || !company || !zone) {
    return NextResponse.json({ error: 'Name, company, and zone are required' }, { status: 400 });
  }
  if (session.role === 'manager' && zone !== session.zone) {
    return NextResponse.json({ error: 'You can only create clients in your zone' }, { status: 403 });
  }

  const effectiveAssignedTo = session.role === 'manager' ? session.userId : (assigned_to ? Number(assigned_to) : session.userId);

  const client = await prisma.clients.create({
    data: {
      name, company,
      phone: phone || null,
      email: email || null,
      address: address || null,
      zone,
      assigned_to: effectiveAssignedTo,
      created_by: session.userId,
      notes: notes || null,
    },
  });

  return NextResponse.json({ id: client.id }, { status: 201 });
}
