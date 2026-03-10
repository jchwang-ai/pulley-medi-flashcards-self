import postgres from 'postgres';

// Initialize connection
const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
});

// Initialize table
async function initTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS card_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      deck_id TEXT NOT NULL,
      term TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await initTable();

    const { userId, deckId, term, status } = req.body;

    if (!userId || !deckId || !term || !status) {
      return res.status(400).json({
        error: 'Missing required parameters: userId, deckId, term, status'
      });
    }

    if (!['easy', 'medium', 'hard'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const normalizedUserId = String(userId);
    const normalizedDeckId = String(deckId);
    const normalizedTerm = String(term).trim();

    const existing = await sql`
      SELECT id
      FROM card_progress
      WHERE user_id = ${normalizedUserId}
        AND deck_id = ${normalizedDeckId}
        AND term = ${normalizedTerm}
      LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE card_progress
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
    } else {
      const id = `${normalizedUserId}_${normalizedDeckId}_${normalizedTerm}_${Date.now()}`;

      await sql`
        INSERT INTO card_progress (id, user_id, deck_id, term, status)
        VALUES (${id}, ${normalizedUserId}, ${normalizedDeckId}, ${normalizedTerm}, ${status})
      `;
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('api/study/feedback error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      detail: error?.message || String(error)
    });
  }
}