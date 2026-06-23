/**
 * mongo.ts — memoized MongoClient + collection helpers for the cashflow app.
 *
 * Connection: process.env.MONGO_URL (set in .env.local for dev, container env for prod).
 * DB: cashflow
 * User: cashflow_app (readWrite on cashflow only)
 *
 * Collections:
 *   users   — one doc per uid; profile + aggregate stats
 *   matches — one doc per finished game
 */

import { MongoClient, type Db, type Collection, type Document } from 'mongodb';

let client: MongoClient | null = null;

function getClient(): MongoClient {
  if (!client) {
    const url = process.env.MONGO_URL;
    if (!url) throw new Error('MONGO_URL environment variable is not set');
    client = new MongoClient(url);
  }
  return client;
}

export async function getDb(): Promise<Db> {
  const c = getClient();
  // connect() is idempotent — safe to call multiple times
  await c.connect();
  return c.db('cashflow');
}

export async function users(): Promise<Collection<Document>> {
  const db = await getDb();
  return db.collection('users');
}

export async function matches(): Promise<Collection<Document>> {
  const db = await getDb();
  return db.collection('matches');
}

/**
 * ensureIndexes — call once at server startup (idempotent).
 * Indexes:
 *   matches: { 'players.uid': 1, endedAt: -1 }  — efficient per-uid match history
 *   matches: { roomCode: 1 }                     — dedup / room lookup
 *   users:   { _id: 1 }                           — _id is already the uid; no extra index needed
 */
export async function ensureIndexes(): Promise<void> {
  const db = await getDb();
  const matchesCol = db.collection('matches');
  await matchesCol.createIndex({ 'players.uid': 1, endedAt: -1 }, { background: true });
  await matchesCol.createIndex({ roomCode: 1 }, { background: true });
}
