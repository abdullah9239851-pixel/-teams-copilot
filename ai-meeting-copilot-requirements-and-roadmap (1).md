# AI Meeting Copilot — Final Requirements & Development Roadmap

**Project codename:** Copilot for Client Calls
**Version:** 1.0 — Final agreed requirements
**Date:** July 2026

---

## PART 1 — FINAL REQUIREMENTS

### 1.1 Product Summary

A web application with an AI assistant (bot) that joins your Microsoft Teams meetings as a participant, listens to the conversation live, and acts as your private copilot on a separate screen. While you talk to a client, the AI analyzes the discussion in real time and suggests what to ask next ("ask about budget," "clarify the timeline," "you haven't covered hosting"). You can also chat with the AI mid-call to get answers, summaries, or drafts. Before each meeting, the app shows a briefing; after each meeting, it produces a full follow-up package.

### 1.2 Confirmed Decisions

| Decision | Answer |
|---|---|
| Users | You + small team (single organization, no SaaS/multi-tenant) |
| Meeting platform | Microsoft Teams only (v1) |
| Suggestion delivery | Separate screen with a live chat panel — two-way chat with the AI |
| Pre-meeting | Briefing screen with meeting details + AI-prepared questions |
| Knowledge base | Yes — company services, pricing, portfolio, question templates |
| Post-meeting output | Full package: summary, action items, requirement document, follow-up email draft |
| Language | English only |
| Teams tenant | You have Microsoft 365 admin control (required for bot approval) |
| Operating budget | $50–200/month acceptable |
| Builder | You/your team — comfortable with React, Node, Python, .NET |

### 1.3 Feature List (Complete)

**A. Authentication & Team**
- Email + password login (invite-only, no public signup)
- 2 roles: Admin (manages knowledge base, team) and Member
- Microsoft account connection (OAuth) per user for calendar access

**B. Dashboard (Home)**
- Today's + upcoming meetings pulled automatically from Teams calendar
- Quick stats: meetings this week, action items pending, recent summaries
- One-click "Prepare" and "Join with Copilot" per meeting

**C. Pre-Meeting Briefing**
- Meeting title, time, attendees, agenda (from Teams calendar via Microsoft Graph)
- Client profile: past meetings with this client, previous action items, notes
- AI-generated preparation: suggested discovery questions based on the agenda + knowledge base
- Ability to add your own notes/goals for the meeting before it starts

**D. Live Meeting Copilot (the core screen)**
- Bot joins the Teams meeting as a visible participant when you click "Join with Copilot"
- Live transcript panel (speaker-labeled, scrolling in real time)
- AI suggestions feed: proactive cards — questions to ask, topics not yet covered, risks/red flags detected, commitments the client made
- Two-way chat: type to the AI mid-call ("summarize last 5 minutes," "what's our usual price for this?", "draft a scope bullet for what he just described") — answers use the live transcript + knowledge base
- Meeting checklist: your pre-meeting questions auto-tick as they get answered in conversation
- Status indicators: bot connected, transcription live, AI thinking

**E. Knowledge Base**
- Upload documents: PDFs, Word docs, text (services, pricing sheets, portfolio, case studies)
- Freeform notes / FAQ entries
- Question template library (e.g., "New web project discovery," "Mobile app discovery")
- All content embedded into a vector store; AI retrieves relevant pieces during live calls and briefings

**F. Post-Meeting Package (auto-generated within ~2 minutes of meeting end)**
- Full transcript (searchable, speaker-labeled)
- Executive summary
- Action items (yours vs. client's, with owners)
- Draft requirement document (structured: goals, features discussed, constraints, open questions)
- Follow-up email draft, ready to copy/edit and send
- Everything editable and exportable (copy, PDF, Word)

**G. Meeting History**
- Searchable archive of all past meetings, filter by client/date
- Client view: all meetings + documents grouped per client

### 1.4 Non-Functional Requirements

- **Latency:** transcript appears within ~1–2 s of speech; AI suggestions within ~5–10 s of a relevant moment
- **Design:** modern, premium, dark-mode-first dashboard; smooth micro-animations; polished empty/loading/error states (details in §3)
- **Privacy/consent:** bot appears as a named participant (e.g., "Meeting Assistant") so clients can see it; a standard disclosure line is recommended at call start ("I have an assistant on the call taking notes"). Data stored in your own database only.
- **Reliability:** if the bot or AI fails mid-call, the meeting itself is unaffected; app shows a clear reconnect option
- **Cost ceiling:** designed to run within $50–200/month at small-team usage (~20–40 meeting-hours/month)

### 1.5 Explicitly Out of Scope (v1)

- Zoom / Google Meet support
- Urdu or multilingual transcription
- Multi-tenant SaaS, billing, public signup
- Mobile app (the web app is responsive; a phone/tablet can display the copilot screen)
- AI speaking in the meeting (the bot listens only — it never talks to the client)

---

## PART 2 — ARCHITECTURE & TECH STACK

### 2.1 The Critical Decision: How the Bot Joins Teams

This is the hardest part of the whole project, so choose deliberately:

**Option A — Meeting Bot API service (RECOMMENDED for v1)**
Use a meeting-bot-as-a-service API (e.g., Recall.ai or similar). You call their API with the Teams meeting link; their bot joins, and they stream you real-time, speaker-labeled transcript over a websocket/webhook.
- Pros: joining + audio capture + transcription solved in days, not months; works within budget (~$0.5–1 per meeting-hour); no Windows media servers.
- Cons: per-hour cost, third party processes call audio (acceptable for v1; revisit later).

**Option B — Native Microsoft bot (application-hosted media)**
Register your own Azure Bot, implement a real-time media bot with the Graph Communications SDK.
- Pros: no third party, no per-hour vendor fee.
- Cons: real-time media bots require **C#/.NET on Windows Server VMs**, complex certification/networking, easily 2–3 months of work just for audio capture. Not worth it for a small internal tool v1.

**Decision for this plan: Option A.** Architecture keeps the bot layer behind a single internal interface (`MeetingBotProvider`) so you can swap to Option B later without touching the rest of the app.

### 2.2 Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js (React) + TypeScript** | You know React; SSR + API routes; best ecosystem |
| Styling / UI | **Tailwind CSS + shadcn/ui + lucide-react icons** | Fast, modern, consistent |
| Animations | **Framer Motion** | Smooth micro-interactions, page transitions, live-feed animations |
| Realtime | **Socket.io** (Node) | Live transcript + suggestion push to the copilot screen |
| Backend | **Node.js (NestJS or Express) + TypeScript** | Same language as frontend; great websocket support |
| Database | **PostgreSQL + pgvector** (Supabase free tier) | Relational data + vector search for knowledge base in one DB |
| Auth | **NextAuth / Supabase Auth** + Microsoft OAuth (per-user calendar) | Simple, invite-only |
| Calendar | **Microsoft Graph API** | Pull meetings, attendees, agendas; needs admin consent (you have it) |
| Meeting bot | **Recall.ai-style API** | Joins Teams, streams live transcript |
| Transcription | Included in bot API (or Deepgram streaming if you want control) | Speaker-labeled, ~300 ms latency |
| AI | **OpenAI API** (e.g., gpt-4o for live suggestions, gpt-4o-mini for cheap frequent calls) | Live suggestion engine, chat copilot, post-meeting docs |
| File storage | Supabase Storage (free tier) | Knowledge base uploads |
| Hosting | **Your Hetzner server** — Docker Compose (Next.js + Node websocket server) behind Nginx/Caddy with SSL | Already owned, $0 extra, full control; websockets run great self-hosted |

### 2.3 How It Works (Data Flow)

```
Teams Meeting ──▶ Bot (joins via bot API) ──▶ Live audio ──▶ Transcription
                                                                │
                                              real-time transcript (websocket)
                                                                ▼
                                                       YOUR BACKEND (Node)
                                                                │
                        ┌───────────────────────────────────────┤
                        ▼                                       ▼
              Rolling transcript buffer               Store transcript in DB
                        │
                        ▼  (every ~20–30 s, or on trigger phrases)
              AI Suggestion Engine (LLM call:
              transcript window + meeting goals
              + knowledge base retrieval)
                        │
                        ▼
              Socket.io push ──▶ COPILOT SCREEN (suggestion cards + chat)

Meeting ends ──▶ Post-meeting pipeline: full transcript ──▶ summary,
action items, requirement doc, email draft ──▶ saved + shown in app
```

### 2.4 Data Model (Core Tables)

- `users` (id, name, email, role, ms_oauth_tokens)
- `clients` (id, name, company, notes)
- `meetings` (id, ms_event_id, title, client_id, start/end, agenda, status, bot_session_id)
- `meeting_prep` (meeting_id, user_goals, ai_questions[], checklist)
- `transcript_segments` (meeting_id, speaker, text, timestamp)
- `suggestions` (meeting_id, type, content, created_at, was_used)
- `copilot_messages` (meeting_id, role, content, timestamp)
- `meeting_outputs` (meeting_id, summary, action_items[], requirement_doc, email_draft)
- `kb_documents` (id, title, type, file_url) + `kb_chunks` (doc_id, text, embedding vector)

### 2.5 Monthly Cost Estimate (~30 meeting-hours)

| Item | Est. |
|---|---|
| Meeting bot API + transcription | $20–40 |
| OpenAI API (live suggestions + chat + post-meeting docs) | $15–50 |
| Hosting — existing Hetzner server | $0 extra (already owned) |
| Supabase free tier (DB + storage + auth) | $0 |
| **Total** | **~$35–90/month** ✅ well within budget |

*Note: Supabase free tier limits — 500 MB database, 1 GB file storage, 50k monthly auth users. Fine for a small team, but transcripts accumulate; plan a cleanup/archive policy or budget the $25 Pro tier as a fallback once history grows.*

---

## PART 3 — DESIGN DIRECTION

**Personality:** premium AI product — think Linear / Raycast / Vercel dashboard aesthetics. Dark-first, calm, confident.

- **Theme:** dark charcoal base (#0B0E14-ish), one electric accent (violet or cyan) used sparingly for AI moments; light mode as secondary
- **Typography:** Inter or Geist for UI; slightly larger, relaxed line-height for transcript readability
- **Signature visuals:**
  - Live transcript with a subtle typing/streaming animation and speaker color chips
  - Suggestion cards that slide in with a soft glow pulse when the AI posts something new
  - Animated "AI listening" waveform indicator during live meetings
  - Checklist items that animate-tick when a question gets answered in conversation
- **Motion rules:** 150–250 ms ease-out micro-interactions; Framer Motion layout animations on lists; skeleton loaders everywhere; zero jank on the live screen (virtualized transcript list)
- **Icons/imagery:** lucide icons; abstract gradient/mesh illustrations for empty states (no stock photos)
- **Copilot screen layout (the hero screen):** 3 columns — live transcript (left), AI suggestion feed (center), chat + checklist (right); collapses gracefully to a single-column chat view on tablet/phone

---

## PART 4 — STEP-BY-STEP DEVELOPMENT ROADMAP

Total estimate: **8–11 weeks** part-time for a small team (faster full-time). Each phase ends with something working you can demo.

### Phase 0 — Accounts, Access & Project Setup (2–4 days)
1. Create Azure AD app registration; grant admin consent for Microsoft Graph scopes: `Calendars.Read`, `OnlineMeetings.Read`, `User.Read`
2. Sign up for the meeting bot API (Recall.ai or chosen equivalent); run their "join a test Teams meeting" quickstart and confirm live transcript arrives — **do this before writing any app code; it de-risks the whole project**
3. Get OpenAI API key; create Supabase project (free tier); GitHub repo; prepare the Hetzner server (Docker, Nginx/Caddy, domain + SSL)
4. Scaffold monorepo: Next.js app + Node websocket server + shared types package
5. Set up Tailwind, shadcn/ui, Framer Motion, ESLint/Prettier, environment config

**Milestone:** test bot joined a real Teams meeting and you saw live transcript text in a console.

### Phase 1 — Foundation: Auth, DB, Design System (Week 1–2)
1. Create all database tables (§2.4) with migrations
2. Invite-only auth (email/password), roles, protected routes
3. Per-user Microsoft OAuth connect flow (store tokens for Graph calls)
4. Build the design system: theme tokens, layout shell (sidebar + topbar), buttons, cards, inputs, skeletons, toasts — the visual language everything else uses
5. Empty dashboard page with navigation

**Milestone:** team members can log in, connect their Microsoft account, and see a polished (empty) dashboard.

### Phase 2 — Calendar & Pre-Meeting Briefing (Week 2–3)
1. Graph API sync: pull upcoming meetings (title, time, attendees, Teams join link, agenda/body) on a schedule + manual refresh
2. Dashboard: today/upcoming meeting cards with "Prepare" and "Join with Copilot" buttons
3. Clients module: auto-suggest client from attendee email domain; client profile page with meeting history
4. Briefing page: meeting details + your goals/notes input
5. AI prep generation: LLM produces suggested discovery questions from agenda + client history (knowledge base plugs in during Phase 3)

**Milestone:** open the app in the morning → see today's client call → open briefing → get AI-suggested questions.

### Phase 3 — Knowledge Base (Week 3–4)
1. Upload UI: PDF/DOCX/TXT + freeform notes + question templates; file storage
2. Ingestion pipeline: extract text → chunk → embed → store in pgvector
3. Retrieval function: given a query/topic, return top-k relevant chunks
4. Wire retrieval into the Phase 2 prep generator (questions now reflect your services/pricing)
5. KB management page: list, preview, delete, re-index

**Milestone:** upload your pricing sheet → briefing questions start referencing your actual offerings.

### Phase 4 — Bot Joining & Live Transcript (Week 4–6) ⚠️ hardest phase
1. "Join with Copilot" → backend calls bot API with the Teams meeting link → bot appears in the meeting
2. Receive real-time transcript webhooks/stream in backend; normalize into `transcript_segments`
3. Socket.io channel per meeting; push segments to the browser live
4. Build the Copilot screen shell: 3-column layout, live transcript panel with speaker labels, auto-scroll, virtualized list, "AI listening" indicator, bot status states (joining / live / left / error)
5. Meeting lifecycle: detect meeting end, mark meeting complete, store full transcript
6. Handle edge cases: bot admitted from lobby, bot kicked, network drop + reconnect

**Milestone:** click one button → bot joins a real client-style call → words appear on your screen ~1 s after they're spoken.

### Phase 5 — Live AI Copilot (Week 6–8) — the heart of the product
1. Suggestion engine: every ~20–30 s (and on meeting-goal keywords), send the rolling transcript window + meeting goals + prep checklist + retrieved KB chunks to the LLM with a tight system prompt → structured suggestions (type: question / missed-topic / risk / commitment)
2. De-duplication + relevance filtering so the feed stays high-signal (max ~1 card per 30–60 s, no repeats)
3. Suggestion cards UI: animated arrival, "used / dismiss" actions (feeds back into prompting)
4. Two-way chat: chat panel calls the LLM with full meeting context + KB retrieval; streaming responses
5. Live checklist: prep questions auto-tick when the LLM detects they've been answered
6. Latency + cost tuning: window sizes, model choice per task, request coalescing

**Milestone:** in a live test call, the AI suggests a relevant question you actually forgot to ask, and answers "what did the client say about the deadline?" correctly in chat.

### Phase 6 — Post-Meeting Package (Week 8–9)
1. On meeting end, pipeline generates: executive summary → action items (owner-tagged) → structured requirement document → follow-up email draft (one LLM pass each, from full transcript + prep goals)
2. Meeting detail page: tabbed view (Summary / Action Items / Requirement Doc / Email / Transcript), all editable
3. Export: copy-to-clipboard, PDF, Word
4. History page: searchable list, filter by client; client profile now shows all outputs
5. Action items rollup on dashboard

**Milestone:** finish a call → within 2 minutes, open a ready follow-up email and requirement doc.

### Phase 7 — Polish, Hardening & Launch (Week 9–11)
1. Animation & UX pass on every screen: transitions, hover states, empty states, error states, loading skeletons
2. Responsive pass: copilot screen usable on a tablet/second monitor/phone
3. Failure drills: bot API down, LLM timeout, Graph token expiry, websocket drop — every failure has a visible, recoverable state
4. Security review: token encryption at rest, role checks on every endpoint, signed webhook verification
5. Cost dashboard/logging: per-meeting spend tracking so you stay in budget
6. Deploy production to the Hetzner server (Docker Compose, auto-restart, backups of the Supabase DB), set up error monitoring (Sentry), onboard your team
7. Run 3–5 real client calls; collect friction notes; one iteration sprint

**Milestone:** the product is your daily driver for client calls.

---

## PART 5 — RISKS & MITIGATIONS

| Risk | Mitigation |
|---|---|
| Bot API vendor limits/changes | `MeetingBotProvider` abstraction; Option B (native .NET bot) documented as future path |
| Suggestion feed too noisy → you ignore it | Strict rate limit + relevance scoring + "dismiss" feedback loop (Phase 5.2) |
| Client uncomfortable with a bot participant | Named politely ("Meeting Assistant"), verbal disclosure habit, easy per-meeting "join without bot" option |
| Live LLM costs creep | Small/fast model for live suggestions, bigger model only for post-meeting docs; per-meeting cost log |
| Graph admin consent misconfigured | Phase 0 step 1 done first, verified with a test calendar pull before building on it |
| Latency on copilot screen | Virtualized transcript, websocket (no polling), streaming LLM responses |

---

## PART 6 — FUTURE ROADMAP (v2 ideas, not now)

- Zoom + Google Meet support (bot API already supports them → small lift)
- Urdu/mixed-language transcription
- CRM integration (auto-log meetings to HubSpot/etc.)
- Voice answers: ask the copilot by speaking on a second device
- Analytics: talk-time ratio, questions asked vs. planned, deal-signal detection
- Turn into multi-tenant SaaS if it proves valuable internally
