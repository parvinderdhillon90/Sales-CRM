import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const client = await prisma.$queryRaw<any[]>`
    SELECT c.*, u.name as assigned_user_name, cb.name as created_by_name
    FROM clients c
    LEFT JOIN users u ON c.assigned_to = u.id
    LEFT JOIN users cb ON c.created_by = cb.id
    WHERE c.id = ${Number(id)}
  `;

  if (!client[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.role === 'manager' && client[0].zone !== session.zone) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const deals = await prisma.$queryRaw<any[]>`
    SELECT d.*, u.name as assigned_user_name,
      CASE WHEN d.last_contact_date IS NULL THEN NULL
           ELSE EXTRACT(DAY FROM (NOW() - d.last_contact_date))::INTEGER
      END as days_since_contact,
      CASE WHEN d.last_contact_date IS NOT NULL
                AND d.last_contact_date < NOW() - INTERVAL '14 days'
                AND d.stage NOT IN ('closed_won','closed_lost')
           THEN 1 ELSE 0 END as is_stale
    FROM deals d
    LEFT JOIN users u ON d.assigned_to = u.id
    WHERE d.client_id = ${Number(id)}
    ORDER BY d.created_at DESC
  `;

  return NextResponse.json({ ...client[0], deals });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const client = await prisma.clients.findUnique({ where: { id: Number(id) } });
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.role === 'manager' && client.zone !== session.zone) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await req.json();
  const { name, company, phone, email, address, notes, assigned_to } = body;

  const effectiveAssignedTo = session.role === 'director'
    ? (assigned_to != null ? Number(assigned_to) : client.assigned_to)
    : client.assigned_to;

  await prisma.clients.update({
    where: { id: Number(id) },
    data: {
      name: name || client.name,
      company: company || client.company,
      phone: phone ?? client.phone,
      email: email ?? client.email,
      address: address ?? client.address,
      notes: notes ?? client.notes,
      assigned_to: effectiveAssignedTo,
      updated_at: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
