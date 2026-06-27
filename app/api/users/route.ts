import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const users = db.prepare('SELECT id, name, email, role, zone, last_login, created_at FROM users ORDER BY role DESC, name').all();
  return NextResponse.json(users);
}
