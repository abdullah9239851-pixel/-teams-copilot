import OpenAI from 'openai';

/**
 * Server-side LLM helper for the web app (briefing prep + post-meeting package).
 * Uses the same OpenAI-compatible endpoint as the realtime server (Groq by
 * default). Kept separate from the bot server so briefing/history work on
 * Vercel without the realtime server running.
 */
function getClient() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY must be set');
  return new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
  });
}

const MODEL = () => process.env.LLM_MODEL || 'llama-3.3-70b-versatile';

export async function generatePrepQuestions(input: {
  title: string;
  agenda: string;
  goals: string;
  clientHistory: string;
  kbContext: string;
}): Promise<string[]> {
  const res = await getClient().chat.completions.create({
    model: MODEL(),
    messages: [
      {
        role: 'system',
        content: `You prepare a salesperson for a client discovery call. Return a JSON object with a "questions" array of 6-10 specific, high-value discovery questions grounded in the agenda, the user's goals, prior client history, and the company knowledge base when relevant. Each question is one sentence.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          meetingTitle: input.title,
          agenda: input.agenda || 'Not specified',
          userGoals: input.goals || 'Not specified',
          clientHistory: input.clientHistory || 'No prior meetings',
          knowledgeBase: input.kbContext || 'No KB context available',
        }),
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.6,
    max_tokens: 600,
  });

  const content = res.choices[0]?.message?.content;
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    const questions = parsed.questions || parsed;
    return Array.isArray(questions) ? questions.map(String).slice(0, 10) : [];
  } catch {
    return [];
  }
}

// Answer a question grounded in a transcript (+ optional KB). Used by the
// practice simulator's "Ask AI" and any transcript Q&A on the web side.
export async function chatOverTranscript(
  transcript: string,
  message: string,
  kbContext = ''
): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: MODEL(),
    messages: [
      {
        role: 'system',
        content: `You are a meeting copilot assistant. Use the transcript and knowledge base to answer the user's question briefly and specifically. If the answer isn't in the transcript, say so and offer your best general guidance.`,
      },
      {
        role: 'user',
        content: `Transcript so far:\n${transcript || '(empty)'}\n\nKnowledge base:\n${kbContext || '(none)'}\n\nQuestion: ${message}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.6,
  });
  return res.choices[0]?.message?.content || '';
}

export interface PostMeetingPackage {
  summary: string;
  actionItems: Array<{ text: string; owner: 'yours' | 'client' }>;
  requirementDoc: string;
  emailDraft: string;
}

export async function generatePostMeeting(
  transcript: string,
  goals: string
): Promise<PostMeetingPackage> {
  const res = await getClient().chat.completions.create({
    model: MODEL(),
    messages: [
      {
        role: 'system',
        content: `Generate a post-meeting package from the transcript. Return JSON with:
- "summary": 3-5 sentence executive summary
- "actionItems": array of {text, owner: "yours"|"client"}
- "requirementDoc": structured markdown of discussed requirements (goals, features, constraints, open questions)
- "emailDraft": ready-to-send follow-up email`,
      },
      {
        role: 'user',
        content: `Meeting goals: ${goals || 'Not specified'}\n\nFull transcript:\n${transcript}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1800,
    temperature: 0.5,
  });

  const content = res.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  return {
    summary: parsed.summary || '',
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    requirementDoc: parsed.requirementDoc || '',
    emailDraft: parsed.emailDraft || '',
  };
}
