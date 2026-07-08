import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
  apiKey: process.env.LLM_API_KEY!,
});

export async function generateSuggestions(transcriptContext: string, goals: string, kbContext: string) {
  const response = await openai.chat.completions.create({
    model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `You are a meeting copilot. Based on the transcript, meeting goals, and knowledge base context, suggest:
1. Questions the user should ask
2. Topics they haven't covered
3. Risks or red flags
4. Client commitments detected

Return a JSON array of suggestions with type and content. Keep suggestions brief and actionable.`,
      },
      {
        role: 'user',
        content: `Transcript: ${transcriptContext}\n\nGoals: ${goals}\n\nContext: ${kbContext}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content;
}
