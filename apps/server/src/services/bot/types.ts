export interface MeetingBotProvider {
  joinMeeting(meetingUrl: string, meetingId: string, botName?: string): Promise<BotSession>;
  leaveMeeting(sessionId: string): Promise<void>;
  getStatus(sessionId: string): BotStatus;
}

export interface BotSession {
  sessionId: string;
  meetingId: string;
  meetingUrl: string;
  botName: string;
  startedAt: Date;
  status: BotStatus;
}

export type BotStatus = 'joining' | 'in_lobby' | 'live' | 'transcribing' | 'left' | 'error';

export interface TranscriptEvent {
  speaker: string;
  text: string;
  timestamp: number;
}
