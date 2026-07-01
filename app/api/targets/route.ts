import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const monthInt = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const yearInt = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

  const targets = await prisma.$queryRaw<any[]>`
    SELECT t.*, u.name as user_name, u.zone,
      COALESCE((
        SELECT SUM(d.value)::FLOAT
        FROM deals d
        WHERE d.assigned_to = t.user_id
          AND d.stage = 'closed_won'
          AND EXTRACT(MONTH FROM d.updated_at) = t.month
          AND EXTRACT(YEAR FROM d.updated_at) = t.year
      ), 0) as achieved_revenue,
      COALESCE((
        SELECT COUNT(*)::INTEGER
        FROM deals d
        WHERE d.assigned_to = t.user_id
          AND d.stage = 'closed_won'
          AND EXTRACT(MONTH FROM d.updated_at) = t.month
          AND EXTRACT(YEAR FROM d.updated_at) = t.year
      ), 0) as achieved_deals
    FROM targets t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.month = ${monthInt} AND t.year = ${yearInt}
    ORDER BY u.zone
  `;

  return NextResponse.json(targets);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['cmd', 'director'].includes(session.role)) {
    return NextResponse.json({ error: 'Only cmd or director can set targets' }, { status: 403 });
  }

  const body = await req.json();
  const { user_id, month, year, revenue_target, deal_count_target } = body;

  if (!user_id || !month || !year) {
    return NextResponse.json({ error: 'user_id, month, year are required' }, { status: 400 });
  }

  await prisma.targets.upsert({
    where: { user_id_month_year: { user_id: Number(user_id), month: Number(month), year: Number(year) } },
    update: {
      revenue_target: revenue_target ?? null,
      deal_count_target: deal_count_target ?? null,
    },
    create: {
      user_id: Number(user_id),
      month: Number(month),
      year: Number(year),
      revenue_target: revenue_target ?? null,
      deal_count_target: deal_count_target ?? null,
      created_by: session.userId,
    },
  });

  return NextResponse.json({ ok: true });
}
