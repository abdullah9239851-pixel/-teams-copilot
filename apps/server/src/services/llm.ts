import OpenAI from 'openai';
import type { Suggestion, SuggestionType } from '@teams-copilot/shared';

function getOpenAI() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY must be set in .env');
  return new OpenAI({
    baseURL: process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
    apiKey,
  });
}

interface SuggestionInput {
  transcriptWindow: string;
  goals: string;
  checklist: string[];
  kbContext: string;
  recentSuggestions: string[];
}

export async function generateSuggestions(input: SuggestionInput): Promise<Suggestion[]> {
  const response = await getOpenAI().chat.completions.create({
    model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `You are a meeting copilot analyzing a live transcript. Return a JSON object with a "suggestions" array.

Each suggestion must have:
- "type": one of "question", "missed_topic", "risk", "commitment"
- "content": brief actionable text (1 sentence, under 100 chars)

Rules:
- Only suggest if genuinely useful — quality over quantity
- Don't repeat recent suggestions
- Max 2 suggestions per response
- Be specific to what was just said`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          recentTranscript: input.transcriptWindow,
          meetingGoals: input.goals || 'Not specified',
          checklist: input.checklist,
          knowledgeBase: input.kbContext || 'No KB context available',
          alreadySuggested: input.recentSuggestions,
        }),
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 300,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  try {
    const parsed = JSON.parse(content);
    const suggestions = parsed.suggestions || parsed;
    return Array.isArray(suggestions) ? suggestions.slice(0, 2) : [];
  } catch {
    return [];
  }
}

// Two-way chat (streaming)
export async function chatWithAI(
  transcript: string,
  message: string,
  kbContext: string,
  onToken: (token: string) => void
): Promise<string> {
  const stream = await getOpenAI().chat.completions.create({
    model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `You are a meeting copilot assistant. Use the transcript and knowledge base to answer the user's question.
Keep answers brief and focused. If you don't know something not in the transcript, say so.`,
      },
      {
        role: 'user',
        content: `Transcript so far: ${transcript}\n\nContext: ${kbContext}\n\nQuestion: ${message}`,
      },
    ],
    stream: true,
    max_tokens: 500,
    temperature: 0.7,
  });

  let fullResponse = '';
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content || '';
    fullResponse += token;
    onToken(token);
  }

  return fullResponse;
}

// Post-meeting generation
export async function generatePostMeeting(transcript: string, goals: string) {
  const response = await openai.chat.completions.create({
    model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `Generate a post-meeting package from the transcript. Return JSON with:
- "summary": 3-5 sentence executive summary
- "actionItems": array of {text, owner: "yours"|"client"}
- "requirementDoc": structured markdown of discussed requirements
- "emailDraft": ready-to-send follow-up email`,
      },
      {
        role: 'user',
        content: `Meeting goals: ${goals}\n\nFull transcript:\n${transcript}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1500,
    temperature: 0.5,
  });

  return response.choices[0]?.message?.content;
}
