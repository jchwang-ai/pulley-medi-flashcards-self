import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require",
});

function normalizeStatus(status: any) {
  if (status === "easy" || status === "medium" || status === "hard") {
    return status;
  }
  return "hard";
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const progress = await sql`
      SELECT DISTINCT ON (deck_id, term)
        deck_id,
        term,
        status,
        updated_at
      FROM card_progress
      WHERE user_id = ${userId}
      ORDER BY deck_id, term, updated_at DESC
    `;

    const normalizedProgress = progress.map((row: any) => ({
      ...row,
      status: normalizeStatus(row.status),
    }));

    const summary = {
      easy: 0,
      medium: 0,
      hard: 0,
      totalStudied: 0,
      reviewNeeded: 0,
      mastered: 0,
    };

    normalizedProgress.forEach((row: any) => {
      if (row.status === "easy") summary.easy++;
      else if (row.status === "medium") summary.medium++;
      else summary.hard++;
    });

    summary.totalStudied = summary.easy + summary.medium + summary.hard;
    summary.reviewNeeded = summary.medium + summary.hard;
    summary.mastered = summary.easy;

    const recommendedReview = normalizedProgress
      .filter((row: any) => row.status === "medium" || row.status === "hard")
      .sort((a: any, b: any) => {
        if (a.status === "hard" && b.status === "medium") return -1;
        if (a.status === "medium" && b.status === "hard") return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      })
      .slice(0, 5)
      .map((row: any) => ({
        deckId: row.deck_id,
        term: row.term,
        status: row.status,
      }));

    return res.status(200).json({
      progress: normalizedProgress,
      summary,
      recommendedReview,
    });
  } catch (error) {
    console.error("progress error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}