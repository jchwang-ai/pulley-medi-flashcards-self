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

    // Get latest progress for each word
    const progress = await sql`
      SELECT DISTINCT ON (term) term, status
      FROM card_progress
      WHERE user_id = ${userId}
      ORDER BY term, updated_at DESC
    `;

    const summary = {
      easy: 0,
      medium: 0,
      hard: 0,
      totalStudied: 0,
      reviewNeeded: 0,
      mastered: 0
    };

    progress.forEach((row: any) => {
      if (row.status === 'easy') summary.easy++;
      else if (row.status === 'medium') summary.medium++;
      else if (row.status === 'hard') summary.hard++;
    });

    summary.totalStudied = summary.easy + summary.medium + summary.hard;
    summary.reviewNeeded = summary.medium + summary.hard;
    summary.mastered = summary.easy;

    // Recommended review: hard first, then medium
    const recommendedReview = progress
      .filter((row: any) => row.status === 'medium' || row.status === 'hard')
      .sort((a: any, b: any) => {
        if (a.status === 'hard' && b.status === 'medium') return -1;
        if (a.status === 'medium' && b.status === 'hard') return 1;
        return 0;
      })
      .slice(0, 5);

    return res.status(200).json({
      progress,
      summary,
      recommendedReview
    });
  } catch (error) {
    console.error('progress error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
