import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
});

async function initTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS study_dates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      study_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export default async function handler(req: any, res: any) {
  try {
    await initTable();

    if (req.method === 'GET') {
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }

      const rows = await sql`
        SELECT study_date
        FROM study_dates
        WHERE user_id = ${String(userId)}
        ORDER BY study_date ASC
      `;

      return res.status(200).json({
        dates: rows.map((row: any) => row.study_date)
      });
    }

    if (req.method === 'POST') {
      const { userId, studyDate } = req.body;

      if (!userId || !studyDate) {
        return res.status(400).json({ error: 'Missing userId or studyDate' });
      }

      const normalizedUserId = String(userId);
      const normalizedStudyDate = String(studyDate);

      const existing = await sql`
        SELECT id
        FROM study_dates
        WHERE user_id = ${normalizedUserId}
          AND study_date = ${normalizedStudyDate}
        LIMIT 1
      `;

      if (existing.length === 0) {
        const id = `${normalizedUserId}_${normalizedStudyDate}`;
        await sql`
          INSERT INTO study_dates (id, user_id, study_date)
          VALUES (${id}, ${normalizedUserId}, ${normalizedStudyDate})
        `;
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('api/study/activity error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      detail: error?.message || String(error),
    });
  }
}
