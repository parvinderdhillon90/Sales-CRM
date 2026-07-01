import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const box = searchParams.get('box') || 'inbox';

  if (box === 'sent') {
    const messages = await prisma.messages.findMany({
      where: { sender_id: session.userId },
      include: {
        recipient: { select: { name: true } },
        deal: { select: { title: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return NextResponse.json(messages.map(m => ({
      ...m,
      other_name: m.recipient.name,
      deal_title: m.deal?.title ?? null,
      recipient: undefined,
      deal: undefined,
    })));
  }

  const messages = await prisma.messages.findMany({
    where: { recipient_id: session.userId },
    include: {
      sender: { select: { name: true } },
      deal: { select: { title: true } },
    },
    orderBy: { created_at: 'desc' },
  });
  return NextResponse.json(messages.map(m => ({
    ...m,
    other_name: m.sender.name,
    deal_title: m.deal?.title ?? null,
    sender: undefined,
    deal: undefined,
  })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { recipient_id, subject, content, deal_id } = body;

  if (!recipient_id || !content) {
    return NextResponse.json({ error: 'Recipient and content are required' }, { status: 400 });
  }
  if (content.trim().length < 5) {
    return NextResponse.json({ error: 'Message is too short' }, { status: 400 });
  }

  const msg = await prisma.messages.create({
    data: {
      sender_id: session.userId,
      recipient_id: Number(recipient_id),
      subject: subject || null,
      content: content.trim(),
      deal_id: deal_id ? Number(deal_id) : null,
    },
  });

  return NextResponse.json({ id: msg.id }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  await prisma.messages.updateMany({
    where: { id: Number(id), recipient_id: session.userId },
    data: { read_at: new Date() },
  });
  return NextResponse.json({ ok: true });
}
