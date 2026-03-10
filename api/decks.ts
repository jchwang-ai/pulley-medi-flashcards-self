import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
});

let initialized = false;

type RawWord = {
  term?: string;
  word?: string;
  text?: string;
  vocab?: string;
  meaning?: string;
  definition?: string;
  example?: string;
  category?: string;
  difficulty?: string;
  source?: string;
  status?: string;
};

function normalizeStatus(status: any) {
  if (status === "easy" || status === "medium" || status === "hard") {
    return status;
  }
  return "hard";
}

function normalizeWord(word: RawWord) {
  const term =
    word?.term ??
    word?.word ??
    word?.text ??
    word?.vocab ??
    "";

  const meaning =
    word?.meaning ??
    word?.definition ??
    "";

  return {
    term: String(term).trim(),
    meaning: String(meaning).trim(),
    example: String(word?.example ?? "").trim(),
    category: String(word?.category ?? "").trim(),
    difficulty: String(word?.difficulty ?? "medium").trim(),
    source: String(word?.source ?? "").trim(),
    status: normalizeStatus(word?.status),
  };
}

async function initDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      words JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

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

  await sql`
    CREATE TABLE IF NOT EXISTS study_dates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      study_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      daily_goal INTEGER NOT NULL DEFAULT 10,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function ensureDecksTable() {
  if (initialized) return;

  await initDatabase();

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
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const decks = await sql`
        SELECT id, name, category, words, created_at as "createdAt"
        FROM decks
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;

      const progress = await sql`
        SELECT DISTINCT ON (deck_id, term)
          deck_id,
          term,
          status
        FROM card_progress
        WHERE user_id = ${userId}
        ORDER BY deck_id, term, updated_at DESC
      `;

      const progressMap = new Map(
        progress.map((p: any) => [`${p.deck_id}::${p.term}`, normalizeStatus(p.status)])
      );

      const decksWithProgress = decks.map((deck: any) => {
        const rawWords = Array.isArray(deck.words)
          ? deck.words
          : typeof deck.words === "string"
            ? JSON.parse(deck.words)
            : [];

        const words = rawWords
          .map(normalizeWord)
          .filter((word: any) => word.term && word.meaning)
          .map((word: any) => ({
            ...word,
            status: progressMap.get(`${deck.id}::${word.term}`) || "hard",
          }));

        return {
          ...deck,
          words,
        };
      });

      return res.status(200).json(decksWithProgress);
    }

    if (req.method === "POST") {
      const { userId, name, category, words } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const id = Date.now().toString();

      const normalizedWords = (Array.isArray(words) ? words : [])
        .map(normalizeWord)
        .filter((word: any) => word.term && word.meaning)
        .map((word: any) => ({
          ...word,
          status: "hard",
        }));

      await sql`
        INSERT INTO decks (id, user_id, name, category, words)
        VALUES (
          ${id},
          ${userId},
          ${name || "새 단어장"},
          ${category || "General"},
          ${JSON.stringify(normalizedWords)}
        )
      `;

      return res.status(200).json({
        success: true,
        id,
      });
    }

    if (req.method === "DELETE") {
      const { id, userId } = req.query;

      if (!id || !userId) {
        return res.status(400).json({ error: "ID and userId are required" });
      }

      await sql`DELETE FROM card_progress WHERE deck_id = ${id} AND user_id = ${userId}`;
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