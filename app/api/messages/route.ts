import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const box = searchParams.get('box') || 'inbox';

  const query = box === 'sent'
    ? `SELECT m.*, u.name as other_name, d.title as deal_title
       FROM messages m
       LEFT JOIN users u ON m.recipient_id = u.id
       LEFT JOIN deals d ON m.deal_id = d.id
       WHERE m.sender_id = ? ORDER BY m.created_at DESC`
    : `SELECT m.*, u.name as other_name, d.title as deal_title
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       LEFT JOIN deals d ON m.deal_id = d.id
       WHERE m.recipient_id = ? ORDER BY m.created_at DESC`;

  const messages = db.prepare(query).all(session.userId);
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const body = await req.json();
  const { recipient_id, subject, content, deal_id } = body;

  if (!recipient_id || !content) {
    return NextResponse.json({ error: 'Recipient and content are required' }, { status: 400 });
  }

  if (content.trim().length < 5) {
    return NextResponse.json({ error: 'Message is too short' }, { status: 400 });
  }

  const result = db.prepare(`
    INSERT INTO messages (sender_id, recipient_id, subject, content, deal_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(session.userId, recipient_id, subject || null, content.trim(), deal_id || null);

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const body = await req.json();
  const { id } = body;

  db.prepare(`UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND recipient_id = ?`).run(id, session.userId);
  return NextResponse.json({ ok: true });
}
