import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require",
});

// Initialize table
sql`
  CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    words JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`.catch(console.error);

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "GET") {
      const decks = await sql`
        SELECT id, name, category, words, created_at as "createdAt"
        FROM decks
        ORDER BY created_at DESC
      `;
      return res.status(200).json(decks);
    }

    if (req.method === "POST") {
      const { name, category, words } = req.body;
      const id = Date.now().toString();
      
      await sql`
        INSERT INTO decks (id, name, category, words)
        VALUES (${id}, ${name || "새 단어장"}, ${category || "General"}, ${JSON.stringify(words || [])})
      `;

      const decks = await sql`
        SELECT id, name, category, words, created_at as "createdAt"
        FROM decks
        ORDER BY created_at DESC
      `;
      return res.status(200).json(decks);
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: "ID is required" });
      }
      await sql`DELETE FROM decks WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("api/decks error:", error);
    return res.status(500).json({
      error: "Internal server error",
      detail: error?.message || String(error),
    });
  }
}
