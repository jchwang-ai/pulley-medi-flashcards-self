import postgres from 'postgres';
import { initDatabase } from '../db-init.ts';

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    await initDatabase();
    const { userId, deckId, cardId, feedback } = req.body;
    if (!userId || !deckId || !cardId || !feedback) return res.status(400).json({ error: 'Missing parameters' });
    
    await sql`
      INSERT INTO card_progress (id, user_id, deck_id, term, status)
      VALUES (${Date.now().toString()}, ${userId}, ${deckId}, ${cardId}, ${feedback})
      ON CONFLICT (id) DO UPDATE SET status = ${feedback}, updated_at = NOW()
    `;
    
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('api/study/feedback error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
