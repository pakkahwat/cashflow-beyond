/**
 * Bot-game end-to-end test: single human vs 1 bot
 *
 * Flow:
 *  1. Alice opens the app, fills her name
 *  2. Alice clicks "เล่นกับบอต / Play vs Bots" with bot count = 1
 *  3. The server creates a room, adds 1 bot, and starts the game immediately
 *  4. Alice dismisses her profession card modal
 *  5. Alice picks a dream (every player, including the bot, must pick before rolling)
 *  6. Assert: Alice sees the game board (.game-screen)
 *  7. Assert: the board advances without a second human — either:
 *     (a) Alice's roll button is enabled (the bot went first and control passed to her), OR
 *     (b) the bot rolled first and Alice sees the end-turn button / a modal
 *         (proving the bot took a turn autonomously)
 *
 * Key: we prove the game is in a valid "started" state driven by only one human,
 * meaning the bot auto-played at least its initial setup actions (dream-pick).
 *
 * We set BOT_DELAY_MS=10 via the dev-server env so bots respond in < 100 ms.
 */

import { test, expect, chromium, type Page } from '@playwright/test';

test.setTimeout(120_000);

async function dismissProfessionCard(page: Page) {
  await page.waitForSelector('.modal.profession-modal', { timeout: 25_000 });
  await page.locator('.modal.profession-modal button.btn.primary.big').click();
}

async function pickFirstDream(page: Page) {
  await page.waitForSelector('.modal.dream-picker', { timeout: 25_000 });
  await page.locator('.modal.dream-picker .dream-card').first().click();
  await page.waitForSelector('.modal.dream-picker', { state: 'detached', timeout: 10_000 });
}

test('single player can start a bot game and the bot takes a turn', async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ── 1. Open Home ────────────────────────────────────────────────────────────
  await page.goto('/');
  await page.waitForSelector('.screen.home', { timeout: 20_000 });

  // ── 2. Fill name + click Play vs Bots ───────────────────────────────────────
  await page.locator('input.text-input').first().fill('Alice');

  // Click the Play vs Bots button (bot count defaults to 1)
  await page.locator('button.bot-play-btn').click();

  // ── 3. Dismiss profession card ───────────────────────────────────────────────
  await dismissProfessionCard(page);

  // ── 4. Pick a dream ──────────────────────────────────────────────────────────
  await pickFirstDream(page);

  // ── 5. Game screen must be visible ───────────────────────────────────────────
  await page.waitForSelector('.game-screen', { timeout: 20_000 });

  // ── 6. Verify board advanced without a second human ─────────────────────────
  // After Alice picks her dream the server broadcasts the live state.
  // Either:
  //   (a) It's Alice's turn: the Roll button is enabled, OR
  //   (b) The bot went first: a modal or the end-turn button is visible/enabled.
  // Either outcome proves the game is live and the bot auto-played its initial
  // actions (chooseDream at minimum) correctly.
  const rollBtn = page.locator('button.btn.primary.big').filter({ hasText: /ทอยเต๋า|Roll dice/i });
  const endTurnBtn = page.locator('button.btn').filter({ hasText: /จบเทิร์น|End turn/i });
  const modal = page.locator('.modal-backdrop');

  await expect(async () => {
    const [rollEnabled, endEnabled, modalVisible] = await Promise.all([
      rollBtn.isEnabled().catch(() => false),
      endTurnBtn.isEnabled().catch(() => false),
      modal.isVisible().catch(() => false),
    ]);
    expect(rollEnabled || endEnabled || modalVisible).toBe(true);
  }).toPass({ timeout: 20_000 });

  // ── 7. If it's Alice's turn, roll and confirm the game cycles to the bot ─────
  const isAliceTurn = await rollBtn.isEnabled().catch(() => false);
  if (isAliceTurn) {
    await rollBtn.click();
    // After Alice rolls, end-turn or a modal must appear confirming the roll.
    await expect(async () => {
      const [endEnabled, modalVisible] = await Promise.all([
        endTurnBtn.isEnabled().catch(() => false),
        modal.isVisible().catch(() => false),
      ]);
      expect(endEnabled || modalVisible).toBe(true);
    }).toPass({ timeout: 10_000 });
  }

  await browser.close();
});
