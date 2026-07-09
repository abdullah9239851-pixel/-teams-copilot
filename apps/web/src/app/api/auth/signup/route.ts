import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  if (process.env.ALLOW_PUBLIC_SIGNUP !== 'true') {
    return NextResponse.json({ error: 'Account creation is invite-only' }, { status: 403 });
  }

  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Signup is not configured on the server' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    const status = error.message.toLowerCase().includes('already') ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  if (data.user) {
    await supabase.from('users').upsert({
      id: data.user.id,
      email: data.user.email || email,
      name: '',
      role: 'member',
    });
  }

  return NextResponse.json({ ok: true });
}
