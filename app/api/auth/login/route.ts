import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { signToken, cookieOptions, COOKIE_NAME } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    const ip = req.headers.get('x-forwarded-for') || 'unknown';

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      if (user) {
        db.prepare('INSERT INTO login_log (user_id, success, ip_address) VALUES (?, 0, ?)').run(user.id, ip);
      }
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    db.prepare('INSERT INTO login_log (user_id, success, ip_address) VALUES (?, 1, ?)').run(user.id, ip);

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      zone: user.zone,
      name: user.name,
    });

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, zone: user.zone },
    });
    res.cookies.set(COOKIE_NAME, token, cookieOptions());
    return res;
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
