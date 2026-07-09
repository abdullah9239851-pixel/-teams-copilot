import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/supabaseAdmin';

export const runtime = 'nodejs';

// List team members (admin only).
export async function GET(req: Request) {
  try {
    const { supabase } = await requireAdmin(req);
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ members: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

// Invite a member (admin only) — creates an auth user + profile row.
export async function POST(req: Request) {
  try {
    const { supabase } = await requireAdmin(req);
    const { email, password, role } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;

    if (data.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        email,
        name: '',
        role: role === 'admin' ? 'admin' : 'member',
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Change a member's role (admin only).
export async function PUT(req: Request) {
  try {
    const { supabase } = await requireAdmin(req);
    const { userId, role } = await req.json();
    if (!userId || !['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'userId and valid role required' }, { status: 400 });
    }
    const { error } = await supabase.from('users').update({ role }).eq('id', userId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
