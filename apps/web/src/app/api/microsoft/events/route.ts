import { NextResponse } from 'next/server';
import {
  getUserFromBearer,
  GraphEvent,
  MicrosoftTokens,
  refreshMicrosoftTokens,
  readMicrosoftTokens,
  sealMicrosoftTokens,
} from '@/lib/server/microsoft';

function toMeeting(event: GraphEvent) {
  return {
    id: event.id,
    title: event.subject || 'Untitled meeting',
    start: event.start?.dateTime,
    end: event.end?.dateTime,
    timeZone: event.start?.timeZone,
    agenda: event.bodyPreview || '',
    joinLink: event.onlineMeeting?.joinUrl || event.webLink || '',
    attendees: (event.attendees || [])
      .map((attendee) => attendee.emailAddress?.name || attendee.emailAddress?.address)
      .filter(Boolean),
  };
}

export async function GET(req: Request) {
  try {
    const { supabase, user } = await getUserFromBearer(req);
    const { data: profile, error } = await supabase
      .from('users')
      .select('ms_oauth_tokens')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;

    let tokens: MicrosoftTokens | null = readMicrosoftTokens(profile?.ms_oauth_tokens);
    if (!tokens?.access_token) {
      return NextResponse.json({ connected: false, meetings: [] });
    }

    if (tokens.expires_at < Date.now() + 60_000) {
      tokens = await refreshMicrosoftTokens(tokens);
      await supabase
        .from('users')
        .update({ ms_oauth_tokens: sealMicrosoftTokens(tokens) })
        .eq('id', user.id);
    }

    const start = new Date();
    const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const graphUrl = new URL('https://graph.microsoft.com/v1.0/me/calendarView');
    graphUrl.searchParams.set('startDateTime', start.toISOString());
    graphUrl.searchParams.set('endDateTime', end.toISOString());
    graphUrl.searchParams.set('$top', '20');
    graphUrl.searchParams.set('$orderby', 'start/dateTime');
    graphUrl.searchParams.set('$select', 'id,subject,start,end,bodyPreview,webLink,onlineMeeting,attendees');

    const response = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });
    const json = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { connected: true, error: json.error?.message || 'Could not fetch Microsoft calendar' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      connected: true,
      meetings: (json.value || []).map(toMeeting),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Calendar fetch failed' }, { status: 500 });
  }
}
