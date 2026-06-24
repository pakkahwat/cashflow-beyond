/**
 * Two-client end-to-end test: create → join → start → roll
 *
 * Flow:
 *  1. Host (Alice) opens the app, fills name, clicks "สร้างห้องใหม่" (Create room)
 *  2. Host lands in Lobby; reads the 5-char room code from .room-code
 *  3. Guest (Bob) opens the app, fills name, fills room code, clicks "เข้าร่วม" (Join)
 *  4. Both are in Lobby; Host clicks "เริ่มเกม" (Start game)
 *  5. Game starts → profession card modal appears for each player → click "เริ่มเล่น!" (Start playing!)
 *  6. Dream picker appears for each player (all players must pick a dream before rolling)
 *     → click the first dream card
 *  7. The player whose turn it is clicks Roll dice (engine assigns first mover randomly)
 *  8. Assert: both see the game board (.game-screen) and the roller sees endTurn enabled
 *
 * Note:
 * - Engine assigns first mover randomly (Math.random), so we detect which page has the
 *   enabled roll button rather than assuming host always goes first.
 * - awaitingDreamChoice is set to all players without a dream immediately on game start,
 *   so every player must pick a dream (DreamPicker modal) before they can do anything else.
 * - Timing: we wait for the roll button to be enabled (not just visible) using Playwright's
 *   expect(...).toBeEnabled() to ensure server state has fully synced before clicking.
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
  // Wait for dream picker to disappear (confirming the chooseDream ack was received)
  await page.waitForSelector('.modal.dream-picker', { state: 'detached', timeout: 10_000 });
}

test('two players can create, join, start and roll', async () => {
  const browser = await chromium.launch();
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const h = await hostCtx.newPage();
  const g = await guestCtx.newPage();

  // ── 1. Host creates a room ──────────────────────────────────────────────────
  await h.goto('/');
  await h.waitForSelector('.screen.home', { timeout: 20_000 });
  await h.locator('input.text-input').first().fill('Alice');
  await h.locator('button.btn.primary.big').first().click();

  // ── 2. Host lands in Lobby; extract room code ──────────────────────────────
  await h.waitForSelector('.screen.lobby', { timeout: 20_000 });
  const code = (await h.locator('.room-code').innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{5}$/);

  // ── 3. Guest joins with the code ───────────────────────────────────────────
  await g.goto('/');
  await g.waitForSelector('.screen.home', { timeout: 20_000 });
  await g.locator('input.text-input').nth(0).fill('Bob');
  // Home now uses mode tabs; open the Join tab to reveal the room-code field.
  await g.locator('.mode-tabs button').filter({ hasText: /เข้าร่วม|Join/i }).click();
  await g.locator('input.text-input').nth(1).fill(code);
  await g.locator('button.btn').filter({ hasText: /เข้าร่วม|join/i }).click();
  await g.waitForSelector('.screen.lobby', { timeout: 20_000 });

  // ── 4. Host starts the game (wait for Bob to appear first) ────────────────
  await h.waitForFunction(
    () => document.querySelectorAll('.player-row').length >= 2,
    undefined,
    { timeout: 10_000 }
  );
  await h.locator('button.btn.primary.big').filter({ hasText: /เริ่ม|start/i }).click();

  // ── 5. Dismiss profession card for both players (in parallel) ─────────────
  await Promise.all([
    dismissProfessionCard(h),
    dismissProfessionCard(g),
  ]);

  // ── 6. Pick dream for both players ────────────────────────────────────────
  // Every player without a dreamId is in awaitingDreamChoice at game start.
  // DreamPicker appears after the profession card is dismissed.
  // Sequential (not parallel) so that the second chooseDream doesn't race the first.
  await pickFirstDream(h);
  await pickFirstDream(g);

  // ── 7. Find which player goes first and roll ───────────────────────────────
  // Both game screens now visible (no modals blocking)
  await h.waitForSelector('.game-screen', { timeout: 15_000 });
  await g.waitForSelector('.game-screen', { timeout: 15_000 });

  // Wait for exactly one player to have an enabled roll button.
  // The engine's WS broadcast will enable the button only for the current player.
  // Use Playwright's built-in retry: wait until the roll btn on h OR g is enabled.
  const rollLocH = h.locator('button.btn.primary.big').filter({ hasText: /ทอยเต๋า|Roll dice/i });
  const rollLocG = g.locator('button.btn.primary.big').filter({ hasText: /ทอยเต๋า|Roll dice/i });

  // Poll until one is enabled (max 15 s)
  let firstMoverPage: Page | null = null;
  await expect(async () => {
    const [hEnabled, gEnabled] = await Promise.all([
      rollLocH.isEnabled().catch(() => false),
      rollLocG.isEnabled().catch(() => false),
    ]);
    expect(hEnabled || gEnabled).toBe(true);
    firstMoverPage = hEnabled ? h : g;
  }).toPass({ timeout: 15_000 });

  const firstMover = firstMoverPage!;
  const rollBtn = firstMover.locator('button.btn.primary.big').filter({ hasText: /ทอยเต๋า|Roll dice/i });
  // Confirm it's really enabled before clicking (toPass doesn't guarantee it's still enabled)
  await expect(rollBtn).toBeEnabled({ timeout: 5_000 });
  await rollBtn.click();

  // ── 8. Assert board visible for both + post-roll state is valid ───────────
  await expect(h.locator('.game-screen').first()).toBeVisible({ timeout: 15_000 });
  await expect(g.locator('.game-screen').first()).toBeVisible({ timeout: 15_000 });

  // After rolling: end-turn is enabled, OR a card/deal modal appeared (blocking end-turn
  // until resolved). Either case means the roll was processed successfully.
  const endTurnBtn = firstMover.locator('button.btn').filter({ hasText: /จบเทิร์น|End turn/i });
  await expect(async () => {
    const endEnabled = await endTurnBtn.isEnabled().catch(() => false);
    const modalUp = await firstMover.locator('.modal-backdrop').isVisible().catch(() => false);
    expect(endEnabled || modalUp).toBe(true);
  }).toPass({ timeout: 15_000 });

  await browser.close();
});
