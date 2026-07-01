import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const dealId = Number(id);

  const deal = await prisma.deals.findUnique({ where: { id: dealId } });
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  if (session.role === 'manager' && deal.assigned_to !== session.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await req.json();
  const { activity_type, description, contact_date } = body;

  if (!activity_type || !description) {
    return NextResponse.json({ error: 'Activity type and description are required' }, { status: 400 });
  }
  if (description.trim().length < 15) {
    return NextResponse.json({ error: 'Description must be at least 15 characters. Provide meaningful details.' }, { status: 400 });
  }

  const recentCount = await prisma.deal_activities.count({
    where: {
      deal_id: dealId,
      user_id: session.userId,
      created_at: { gt: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });

  if (recentCount >= 5) {
    return NextResponse.json({ error: 'Too many activities logged in a short period. Please wait before adding more.' }, { status: 429 });
  }

  await prisma.deal_activities.create({
    data: { deal_id: dealId, user_id: session.userId, activity_type, description: description.trim() },
  });

  const contactTypes = ['call', 'email', 'meeting'];
  if (contactTypes.includes(activity_type)) {
    const date = contact_date ? new Date(contact_date) : new Date();
    await prisma.deals.update({
      where: { id: dealId },
      data: {
        last_contact_date: date,
        last_contact_summary: description.trim().substring(0, 500),
        updated_at: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
