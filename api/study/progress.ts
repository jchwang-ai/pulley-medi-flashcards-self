import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
});

export default async function handler(req: any, res: any) {

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {

    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const progress = await sql`
      SELECT deck_id, term, status
      FROM card_progress
      WHERE user_id = ${userId}
    `;

    const summary = {
      easy: 0,
      medium: 0,
      hard: 0
    };

    progress.forEach((row: any) => {
      if (row.status === 'easy') summary.easy++;
      if (row.status === 'medium') summary.medium++;
      if (row.status === 'hard') summary.hard++;
    });

    return res.status(200).json({
      progress,
      summary
    });

  } catch (error) {

    console.error('progress error:', error);

    return res.status(500).json({
      error: 'Internal server error'
    });

  }

}
