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
    // Track the last emitted text per speaker so we only push finalized lines
    // and never duplicate a caption that is still being updated in place.
    const lastBySpeaker = new Map<string, string>();
    let consecutiveErrors = 0;
    let lastCaptionAt = Date.now();
    let captionRetries = 0;
    let tick = 0;

    while (session.status === 'transcribing' || session.status === 'live') {
      if (page.isClosed()) {
        session.status = 'left';
        this.emitStatus(session);
        return;
      }
      try {
        tick++;

        // Every ~6 s, check whether Teams ended the call (post-call screen).
        if (tick % 5 === 0) {
          const ended = await page.evaluate(() => {
            const text = (document.body?.innerText || '').slice(0, 8000);
            return /you left the meeting|meeting has ended|call ended|you've been removed/i.test(text);
          });
          if (ended) {
            console.log(`[Bot ${session.sessionId}] Meeting ended — leaving`);
            session.status = 'left';
            this.emitStatus(session);
            return;
          }
        }
        // Extract speaker-labeled caption items from the Teams DOM. Teams renders
        // each caption as a row containing an author element and a text element;
        // selectors vary across Teams builds, so we try several in the page.
        const items = await page.evaluate(() => {
          const rowSelectors = [
            '[data-tid="closed-caption-renderer-wrapper"] [data-tid="closed-caption-message-content"]',
            '[data-tid="closed-caption-renderer-wrapper"] li',
            '[data-tid="captions-container"] li',
            '.ts-captions-container .ui-chat__item',
            'div[class*="caption"] li',
          ];
          const authorSelectors = ['[data-tid="author"]', '[class*="author"]', '.ui-chat__message__author'];
          const textSelectors = ['[data-tid="caption-text"]', '[class*="caption-text"]', '[data-tid="closed-caption-text"]'];

          const pick = (root: Element, sels: string[]): string => {
            for (const s of sels) {
              const el = root.querySelector(s);
              if (el?.textContent?.trim()) return el.textContent.trim();
            }
            return '';
          };

          for (const rowSel of rowSelectors) {
            const rows = Array.from(document.querySelectorAll(rowSel));
            if (rows.length === 0) continue;
            return rows
              .map((row) => {
                const speaker = pick(row, authorSelectors) || 'Speaker';
                const text = pick(row, textSelectors) || (row.textContent?.trim() ?? '');
                return { speaker, text };
              })
              .filter((r) => r.text);
          }
          return [] as Array<{ speaker: string; text: string }>;
        });

        consecutiveErrors = 0;

        for (const item of items) {
          const prev = lastBySpeaker.get(item.speaker);
          if (item.text && item.text !== prev) {
            lastBySpeaker.set(item.speaker, item.text);
            lastCaptionAt = Date.now();
            session.transcriptCallback?.({
              speaker: item.speaker,
              text: item.text,
              timestamp: Date.now(),
            });
          }
        }

        // If no caption text has arrived for 45 s, captions may never have been
        // enabled (menu timing) — retry enabling them a few times.
        if (Date.now() - lastCaptionAt > 45_000 && captionRetries < 3) {
          captionRetries++;
          console.log(`[Bot ${session.sessionId}] No captions for 45s — retrying enable (${captionRetries}/3)`);
          await this.enableCaptions(page);
          lastCaptionAt = Date.now();
        }

        await page.waitForTimeout(1200);
      } catch (err) {
        consecutiveErrors++;
        console.log(`[Bot] Caption capture error (${consecutiveErrors}): ${err}`);
        if (page.isClosed()) {
          session.status = 'left';
          this.emitStatus(session);
          return;
        }
        if (consecutiveErrors >= 10) {
          session.status = 'error';
          this.emitStatus(session);
          return;
        }
        await page.waitForTimeout(2000);
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
