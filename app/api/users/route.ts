import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const users = await prisma.users.findMany({
    select: { id: true, name: true, email: true, role: true, zone: true, last_login: true, created_at: true },
    orderBy: [{ role: 'desc' }, { name: 'asc' }],
  });
  return NextResponse.json(users);
}
