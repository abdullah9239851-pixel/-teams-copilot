import { chromium, type Browser, type Page } from 'playwright';
import { type MeetingBotProvider, type BotSession, type BotStatus, type TranscriptEvent } from './types';

interface ActiveSession extends BotSession {
  browser?: Browser;
  page?: Page;
  transcriptCallback?: (event: TranscriptEvent) => void;
  statusCallback?: (status: BotStatus) => void;
}

export class PlaywrightTeamsBot implements MeetingBotProvider {
  private sessions = new Map<string, ActiveSession>();
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  async joinMeeting(
    meetingUrl: string,
    meetingId: string,
    botName: string = 'Meeting Assistant',
    callbacks?: {
      onTranscript?: (event: TranscriptEvent) => void;
      onStatus?: (status: BotStatus) => void;
    }
  ): Promise<BotSession> {
    const sessionId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const browser = await this.getBrowser();

    const session: ActiveSession = {
      sessionId,
      meetingId,
      meetingUrl,
      botName,
      startedAt: new Date(),
      status: 'joining',
      browser,
      transcriptCallback: callbacks?.onTranscript,
      statusCallback: callbacks?.onStatus,
    };

    this.sessions.set(sessionId, session);
    this.emitStatus(session);

    // Launch bot in background (don't await — runs until meeting ends)
    this.runBotSession(session).catch((err) => {
      console.error(`Bot session ${sessionId} failed:`, err.message);
      session.status = 'error';
      this.emitStatus(session);
    });

    return {
      sessionId,
      meetingId,
      meetingUrl,
      botName,
      startedAt: session.startedAt,
      status: 'joining',
    };
  }

  private async runBotSession(session: ActiveSession) {
    const page = await session.browser!.newPage();
    session.page = page;

    try {
      // 1. Navigate to Teams meeting
      console.log(`[Bot ${session.sessionId}] Navigating to meeting...`);
      await page.goto(session.meetingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // 2. Handle Teams login prompt — click "Join as guest" or enter name
      // Teams sometimes prompts: enter your name
      session.status = 'in_lobby';
      this.emitStatus(session);

      const nameInput = page.locator('input[placeholder*="name" i], input[data-tid*="name" i]');
      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameInput.fill(session.botName);
        await page.keyboard.press('Enter');
      }

      // 3. Click "Join now" button
      const joinBtn = page.locator('button:has-text("Join now"), button:has-text("Join"), [data-tid="join"]');
      if (await joinBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
        await joinBtn.click();
      }

      // 4. Wait until admitted (lobby -> in meeting)
      console.log(`[Bot ${session.sessionId}] Waiting in lobby...`);
      session.status = 'live';
      this.emitStatus(session);

      // 5. Wait for meeting to load — look for participant pane or captions button
      await page.waitForTimeout(5000);

      // 6. Enable live captions
      await this.enableCaptions(page);

      // 7. Start capturing captions
      session.status = 'transcribing';
      this.emitStatus(session);
      await this.captureCaptions(page, session);

    } catch (err: any) {
      console.error(`[Bot ${session.sessionId}] Error:`, err.message);
      session.status = 'error';
      this.emitStatus(session);
    }
  }

  private async enableCaptions(page: Page) {
    try {
      // Click "More actions" (...) button
      const moreBtn = page.locator('button[data-tid="toolbar-more"], button:has([data-icon-name="More"])');
      if (await moreBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await moreBtn.click();
        await page.waitForTimeout(1000);
      }

      // Look for "Turn on live captions" option
      const captionsBtn = page.locator('button:has-text("captions" i), button:has-text("Live Captions" i), [data-tid="captions"]');
      if (await captionsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await captionsBtn.click();
        console.log(`[Bot] Live captions enabled`);
        await page.waitForTimeout(2000);
      }
    } catch (err) {
      console.log(`[Bot] Could not enable captions (non-critical): ${err}`);
    }
  }

  private async captureCaptions(page: Page, session: ActiveSession) {
    let lastText = '';

    while (session.status === 'transcribing' || session.status === 'live') {
      try {
        // Teams captions appear in specific DOM elements
        // Try multiple possible selectors
        const captionSelectors = [
          '[data-tid="captions-container"] span',
          '.ts-captions-container span',
          'div[class*="caption"] span',
          '#captions-container span',
        ];

        let captionText = '';
        for (const selector of captionSelectors) {
          const elements = await page.locator(selector).all();
          if (elements.length > 0) {
            const texts = await Promise.all(elements.map((el) => el.textContent()));
            captionText = texts.filter(Boolean).join(' ');
            break;
          }
        }

        if (captionText && captionText !== lastText) {
          // New caption detected
          lastText = captionText;
          const event: TranscriptEvent = {
            speaker: 'Speaker',
            text: captionText,
            timestamp: Date.now(),
          };
          session.transcriptCallback?.(event);
        }

        // Poll every 1s
        await page.waitForTimeout(1000);
      } catch (err) {
        console.log(`[Bot] Caption capture error: ${err}`);
        break;
      }
    }
  }

  async leaveMeeting(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'left';
    this.emitStatus(session);

    try {
      await session.page?.close();
    } catch {}
    this.sessions.delete(sessionId);
  }

  getStatus(sessionId: string): BotStatus {
    return this.sessions.get(sessionId)?.status || 'left';
  }

  private emitStatus(session: ActiveSession) {
    session.statusCallback?.(session.status);
  }

  async cleanup() {
    for (const [id] of this.sessions) {
      await this.leaveMeeting(id);
    }
    await this.browser?.close();
    this.browser = null;
  }
}
