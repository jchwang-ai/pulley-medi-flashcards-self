import Database from "better-sqlite3";

const db = new Database("/tmp/decks.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    words TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`).run();

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "GET") {
      const rows = db.prepare(`
        SELECT id, name, words, createdAt
        FROM decks
        ORDER BY createdAt DESC
      `).all();

      const decks = rows.map((row: any) => ({
        ...row,
        words: JSON.parse(row.words),
      }));

      return res.status(200).json(decks);
    }

    if (req.method === "POST") {
      const body = req.body || {};

      const newDeck = {
        id: Date.now().toString(),
        name: body.name || "새 단어장",
        words: Array.isArray(body.words) ? body.words : [],
        createdAt: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO decks (id, name, words, createdAt)
        VALUES (?, ?, ?, ?)
      `).run(
        newDeck.id,
        newDeck.name,
        JSON.stringify(newDeck.words),
        newDeck.createdAt
      );

      return res.status(200).json(newDeck);
    }

    if (req.method === "DELETE") {
      const { id } = req.query || {};

      db.prepare(`DELETE FROM decks WHERE id = ?`).run(id);

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