import Database from "better-sqlite3";

const db = new Database("/tmp/decks.db");

// 기존 테이블이 있어도 category를 추가
db.prepare(`
  CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    words TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`).run();

// 예전 테이블에 category가 없을 수 있어서 안전하게 추가 시도
try {
  db.prepare(`ALTER TABLE decks ADD COLUMN category TEXT NOT NULL DEFAULT 'General'`).run();
} catch (e) {
  // 이미 있으면 무시
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "GET") {
      const rows = db.prepare(`
        SELECT id, name, category, words, createdAt
        FROM decks
        ORDER BY createdAt DESC
      `).all();

      const decks = rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        category: row.category || "General",
        words: (() => {
          try {
            return JSON.parse(row.words || "[]");
          } catch {
            return [];
          }
        })(),
        createdAt: row.createdAt,
      }));

      return res.status(200).json(decks);
    }

    if (req.method === "POST") {
      const body = req.body || {};

      const newDeck = {
        id: Date.now().toString(),
        name: body.name || "새 단어장",
        category: body.category || "General",
        words: Array.isArray(body.words) ? body.words : [],
        createdAt: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO decks (id, name, category, words, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        newDeck.id,
        newDeck.name,
        newDeck.category,
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