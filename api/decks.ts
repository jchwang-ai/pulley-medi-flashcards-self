import postgres from "postgres";
import { initDatabase } from "./db-init.ts";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require",
});

let initialized = false;

async function ensureDecksTable() {
  if (initialized) return;
  await initDatabase();
  
  // Check if user_id column exists
  const columns = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'decks' AND column_name = 'user_id'
  `;
  
  if (columns.length === 0) {
    await sql`ALTER TABLE decks ADD COLUMN user_id TEXT NOT NULL DEFAULT 'unknown'`;
  }
  
  initialized = true;
}

export default async function handler(req: any, res: any) {
  try {
    await ensureDecksTable();
    
    if (req.method === "GET") {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      
      const decks = await sql`
        SELECT id, name, category, words, created_at as "createdAt"
        FROM decks
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
      return res.status(200).json(decks);
    }

    if (req.method === "POST") {
      const { userId, name, category, words } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      
      const id = Date.now().toString();
      
      await sql`
        INSERT INTO decks (id, user_id, name, category, words)
        VALUES (${id}, ${userId}, ${name || "새 단어장"}, ${category || "General"}, ${JSON.stringify(words || [])})
      `;

      const decks = await sql`
        SELECT id, name, category, words, created_at as "createdAt"
        FROM decks
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
      return res.status(200).json(decks);
    }

    if (req.method === "DELETE") {
      const { id, userId } = req.query;
      if (!id || !userId) {
        return res.status(400).json({ error: "ID and userId are required" });
      }
      await sql`DELETE FROM decks WHERE id = ${id} AND user_id = ${userId}`;
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
