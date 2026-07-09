import { NextResponse } from 'next/server';
import { getUserFromBearer } from '@/lib/server/supabaseAdmin';

export const runtime = 'nodejs';

// Dashboard quick stats: meetings this week, pending action items, recent summaries.
export async function GET(req: Request) {
  try {
    const { supabase } = await getUserFromBearer(req);

    // Current week: Monday 00:00 → next Monday 00:00 (local server time).
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);

    const [weekResult, outputsResult] = await Promise.all([
      supabase
        .from('meetings')
        .select('id', { count: 'exact', head: true })
        .gte('start_time', monday.toISOString())
        .lt('start_time', nextMonday.toISOString()),
      supabase
        .from('meeting_outputs')
        .select('meeting_id, summary, action_items, updated_at, meetings(title)')
        .order('updated_at', { ascending: false })
        .limit(25),
    ]);

    const outputs = outputsResult.data || [];

    const pendingActionItems: Array<{
      meetingId: string;
      meetingTitle: string;
      text: string;
      owner: string;
    }> = [];
    for (const o of outputs) {
      const title = (o as any).meetings?.title || 'Meeting';
      const items = Array.isArray(o.action_items) ? o.action_items : [];
      for (const item of items) {
        if (item && typeof item === 'object' && item.text && !item.done) {
          pendingActionItems.push({
            meetingId: o.meeting_id,
            meetingTitle: title,
            text: String(item.text),
            owner: item.owner === 'client' ? 'client' : 'yours',
          });
        }
      }
    }

    const recentSummaries = outputs.slice(0, 3).map((o) => ({
      meetingId: o.meeting_id,
      meetingTitle: (o as any).meetings?.title || 'Meeting',
      summary: String(o.summary || '').slice(0, 240),
      updatedAt: o.updated_at,
    }));

    return NextResponse.json({
      meetingsThisWeek: weekResult.count ?? 0,
      pendingActionItems,
      recentSummaries,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
