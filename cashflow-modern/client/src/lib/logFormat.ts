import { money } from './format';
import type { SfxName } from './sfx';

export interface LogEntry {
  ts: number;
  player: string;
  color: string;
  code: string;
  params: Record<string, unknown>;
}

/**
 * Centralised bilingual log formatter. The server emits structured
 * `{ code, params }` entries (no English text); the client renders them in the
 * active language. Adding a new log line means adding a key here in both langs.
 */
const MESSAGES: Record<string, { th: (p: any) => string; en: (p: any) => string }> = {
  started: {
    th: () => 'เริ่มเกม',
    en: () => 'started the game'
  },
  skippedTurn: {
    th: () => 'ถูกข้ามเทิร์น',
    en: () => 'skipped a turn'
  },
  rolled: {
    th: (p: any) => `ทอยได้ ${p.dice.join(' + ')} = ${p.total}`,
    en: (p: any) => `rolled ${p.dice.join(' + ')} = ${p.total}`
  },
  payday: {
    th: (p: any) => `ได้รับเงินเดือน ${money(p.amount)}`,
    en: (p: any) => `received payday ${money(p.amount)}`
  },
  dealLanded: {
    th: () => 'ตกช่องดีล — เลือก Small หรือ Big',
    en: () => 'landed on a Deal — choose Small or Big'
  },
  market: {
    th: (p: any) => `ตลาด: ${p.heading ?? ''}`,
    en: (p: any) => `Market: ${p.heading ?? ''}`
  },
  doodadDodged: {
    th: (p: any) => `หลบรายจ่าย: ${p.heading}`,
    en: (p: any) => `dodged a Doodad: ${p.heading}`
  },
  doodadPaid: {
    th: (p: any) => `จ่ายรายจ่าย ${money(p.cost)}: ${p.heading}`,
    en: (p: any) => `paid Doodad ${money(p.cost)}: ${p.heading}`
  },
  doodadCapped: {
    th: (p: any) => `รายจ่ายโหมดง่าย — จ่าย ${money(p.paid)} จาก ${money(p.cost)}: ${p.heading}`,
    en: (p: any) => `Doodad capped on Easy — paid ${money(p.paid)} of ${money(p.cost)}: ${p.heading}`
  },
  charityLanded: {
    th: () => 'ตกช่องการกุศล',
    en: () => 'landed on Charity'
  },
  downsized: {
    th: (p: any) => `ตกงาน! จ่าย ${money(p.amount)} และเสียเทิร์น ${p.turns} ครั้ง`,
    en: (p: any) => `Downsized! paid ${money(p.amount)} and lose ${p.turns} turn${p.turns > 1 ? 's' : ''}`
  },
  baby: {
    th: (p: any) => (p.added ? 'มีลูกใหม่ 👶' : 'มีลูกครบ 3 คนแล้ว'),
    en: (p: any) => (p.added ? 'had a new baby 👶' : 'already has 3 babies')
  },
  damageIgnored: {
    th: () => 'ไม่มีอสังหาริมทรัพย์ — ความเสียหายถูกข้าม',
    en: () => 'has no real estate — damage ignored'
  },
  damagePaid: {
    th: (p: any) => `จ่ายความเสียหาย ${money(p.cost)}`,
    en: (p: any) => `paid damages ${money(p.cost)}`
  },
  damageExceeds: {
    th: (p: any) => `ความเสียหาย ${money(p.cost)} เกินเงินสด — ต้องไปจัดการหนี้`,
    en: (p: any) => `damages ${money(p.cost)} exceed cash — must resolve debt`
  },
  drewDeal: {
    th: (p: any) => `จั่วดีล${p.size === 'small' ? 'เล็ก' : 'ใหญ่'}: ${p.heading ?? ''}`,
    en: (p: any) => `drew a ${p.size === 'small' ? 'Small' : 'Big'} Deal: ${p.heading ?? ''}`
  },
  soldStock: {
    th: (p: any) => `ขายหุ้น ${p.symbol} ${p.count} หุ้น @ ${money(p.price)}`,
    en: (p: any) => `sold ${p.count} ${p.symbol} @ ${money(p.price)}`
  },
  passed: {
    th: (p: any) => `ผ่าน: ${p.heading}`,
    en: (p: any) => `passed on ${p.heading}`
  },
  donated: {
    th: () => 'บริจาคการกุศล — ทอยได้ 1 หรือ 2 ลูก 3 เทิร์น',
    en: () => 'donated to charity — may roll 1 or 2 dice for 3 turns'
  },
  boughtRE: {
    th: (p: any) => `ซื้อ ${p.symbol} (+${money(p.cashFlow)}/เดือน)`,
    en: (p: any) => `bought ${p.symbol} (+${money(p.cashFlow)}/mo)`
  },
  boughtBiz: {
    th: (p: any) => `ซื้อธุรกิจ ${p.symbol} (+${money(p.cashFlow)}/เดือน)`,
    en: (p: any) => `bought business ${p.symbol} (+${money(p.cashFlow)}/mo)`
  },
  boughtStock: {
    th: (p: any) => `ซื้อหุ้น ${p.symbol} ${p.count} หุ้น @ ${money(p.price)}`,
    en: (p: any) => `bought ${p.count} ${p.symbol} @ ${money(p.price)}`
  },
  boughtGold: {
    th: (p: any) => `ซื้อทอง ${p.count} เหรียญ`,
    en: (p: any) => `bought ${p.count} gold coins`
  },
  soldGold: {
    th: (p: any) => `ขายทอง ${p.count} เหรียญ`,
    en: (p: any) => `sold ${p.count} gold coins`
  },
  soldRE: {
    th: () => 'ขายอสังหาฯ ตามราคาตลาด',
    en: () => 'sold real estate at market'
  },
  joinedMlm: {
    th: (p: any) => `เข้าร่วม ${p.symbol}`,
    en: (p: any) => `joined ${p.symbol}`
  },
  lotteryMoney: {
    th: (p: any) => `ทอยหวย ${p.die} — ${p.win ? `ถูก ${money(p.payout)}` : 'ไม่ถูก'}`,
    en: (p: any) => `rolled ${p.die} on lottery — ${p.win ? `won ${money(p.payout)}` : 'lost'}`
  },
  lotterySplit: {
    th: (p: any) => `หุ้น ${p.symbol} ${p.up ? 'แยกหุ้น (×2)' : 'รวมหุ้น (÷2)'} ทอยได้ ${p.die}`,
    en: (p: any) => `${p.symbol} ${p.up ? 'split (×2)' : 'reverse split (÷2)'} on roll ${p.die}`
  },
  loanTaken: {
    th: (p: any) => `กู้เงินธนาคาร ${money(p.amount)}`,
    en: (p: any) => `took a bank loan of ${money(p.amount)}`
  },
  loanPaid: {
    th: (p: any) => `จ่ายหนี้ ${p.type} ${money(p.amount)}`,
    en: (p: any) => `paid down ${p.type} by ${money(p.amount)}`
  },
  bankrupt: {
    th: () => 'ล้มละลาย 💀',
    en: () => 'went bankrupt 💀'
  },
  liquidated: {
    th: () => 'ขายสินทรัพย์เพื่อใช้หนี้',
    en: () => 'liquidated assets to cover debt'
  },
  enteredFT: {
    th: () => '🎉 เลือกหนีออกจากวงจรหนูถีบจักร และขึ้นเส้นทางด่วน!',
    en: () => '🎉 chose to escape the Rat Race and enter the Fast Track!'
  },
  choseDream: {
    th: (p: any) => `เลือกความฝัน: ${p.name}`,
    en: (p: any) => `chose the dream: ${p.name}`
  },
  ftPayday: {
    th: (p: any) => `วันกระแสเงินสดเส้นทางด่วน: +${money(p.amount)}`,
    en: (p: any) => `Fast Track cashflow day: +${money(p.amount)}`
  },
  ftCharity: {
    th: () => 'บริจาคการกุศล — ตอนนี้ทอยได้ 1, 2 หรือ 3 ลูกบนเส้นทางด่วน',
    en: () => 'donated to charity — may now roll 1, 2, or 3 dice on the Fast Track'
  },
  ftLoss: {
    th: (p: any) => `${p.name} — จ่าย ${money(p.paid)}`,
    en: (p: any) => `${p.name} — paid ${money(p.paid)}`
  },
  ftInvestment: {
    th: (p: any) => `การลงทุน: ${p.name} — ${money(p.cost)} สำหรับ +${money(p.cashFlow)}/เดือน`,
    en: (p: any) => `Investment: ${p.name} — ${money(p.cost)} for +${money(p.cashFlow)}/mo`
  },
  ftDreamMarker: {
    th: () => `ตกช่องความฝันผู้เล่นอื่น — ราคาของฝันนั้นเพิ่มขึ้น`,
    en: () => `landed on another player's dream — its price rises`
  },
  ftPassed: {
    th: (p: any) => `ผ่าน: ${p.name}`,
    en: (p: any) => `passed on ${p.name}`
  },
  ftInvested: {
    th: (p: any) => `ลงทุนใน ${p.name} (+${money(p.cashFlow)}/เดือน)`,
    en: (p: any) => `invested in ${p.name} (+${money(p.cashFlow)}/mo cashflow)`
  },
  won: {
    th: (p: any) => `🏆 ชนะเกม — ${p.reason}`,
    en: (p: any) => `🏆 WON the game — ${p.reason}`
  }
};

export function formatLog(entry: LogEntry, lng: 'th' | 'en'): string {
  const m = MESSAGES[entry.code];
  if (!m) return entry.code;
  return m[lng](entry.params || {});
}

const SOUND_MAP: Record<string, SfxName> = {
  rolled: 'roll',
  payday: 'payday',
  ftPayday: 'payday',
  won: 'win',
  enteredFT: 'fastTrack',
  downsized: 'downsized',
  baby: 'baby',
  donated: 'charity',
  ftCharity: 'charity',
  charityLanded: 'charity',
  market: 'market',
  doodadPaid: 'doodad',
  doodadCapped: 'doodad',
  doodadDodged: 'doodad',
  dealLanded: 'deal',
  drewDeal: 'card',
  boughtRE: 'buy',
  boughtBiz: 'buy',
  boughtStock: 'buy',
  boughtGold: 'buy',
  joinedMlm: 'buy',
  ftInvested: 'buy'
};

export function soundForLog(entry: LogEntry): SfxName | null {
  return SOUND_MAP[entry.code] ?? null;
}
