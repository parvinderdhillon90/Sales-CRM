import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const countOnly = searchParams.get('count') === '1';

  if (countOnly) {
    const count = await prisma.alerts.count({
      where: { recipient_id: session.userId, acknowledged_at: null },
    });
    return NextResponse.json({ count });
  }

  const alerts = await prisma.alerts.findMany({
    where: { recipient_id: session.userId, acknowledged_at: null },
    include: { deal: { select: { title: true } } },
    orderBy: { created_at: 'desc' },
    take: 20,
  });

  const result = alerts.map(a => ({
    ...a,
    deal_title: a.deal?.title ?? null,
    deal: undefined,
  }));

  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, all } = await req.json();

  if (all) {
    await prisma.alerts.updateMany({
      where: { recipient_id: session.userId, acknowledged_at: null },
      data: { acknowledged_at: new Date() },
    });
  } else if (id) {
    await prisma.alerts.updateMany({
      where: { id: Number(id), recipient_id: session.userId },
      data: { acknowledged_at: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
