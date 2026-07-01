import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.users.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, zone: true, last_login: true, created_at: true },
  });
  return NextResponse.json(user);
}
