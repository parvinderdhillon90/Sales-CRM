import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, cookieOptions, COOKIE_NAME } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const user = await prisma.users.findUnique({ where: { email } });
    const ip = req.headers.get('x-forwarded-for') || 'unknown';

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      if (user) {
        await prisma.login_log.create({ data: { user_id: user.id, success: 0, ip_address: ip } });
      }
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await prisma.users.update({ where: { id: user.id }, data: { last_login: new Date() } });
    await prisma.login_log.create({ data: { user_id: user.id, success: 1, ip_address: ip } });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      zone: user.zone ?? null,
      name: user.name,
    });

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, zone: user.zone },
    });
    res.cookies.set(COOKIE_NAME, token, cookieOptions());
    return res;
  } catch (e) {
    console.error('Login error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
