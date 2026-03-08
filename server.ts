import express from "express";
import { createServer as createViteServer } from "vite";
import postgres from "postgres";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require",
});

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Initialize database schema
async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      xp INTEGER DEFAULT 0,
      streak INTEGER DEFAULT 0,
      last_study_date TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS decks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      description TEXT,
      category TEXT,
      is_public INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cards (
      id SERIAL PRIMARY KEY,
      deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
      term TEXT,
      meaning TEXT,
      example TEXT,
      category TEXT,
      difficulty TEXT,
      source TEXT
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
      status TEXT,
      next_review_date TEXT,
      interval INTEGER DEFAULT 1,
      ease_factor REAL DEFAULT 2.5,
      last_reviewed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
}

initDb().catch(console.error);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Auth Middleware
  const authenticate = (req: express.Request & { user: any }, res: express.Response, next: express.NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = decoded;
      next();
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // API Routes
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, name } = req.body;
    const password_hash = await bcrypt.hash(password, 10);
    try {
      const [user] = await sql`
        INSERT INTO users (email, password_hash, name)
        VALUES (${email}, ${password_hash}, ${name})
        RETURNING id, email, name
      `;
      res.json(user);
    } catch (e) {
      res.status(400).json({ error: "User already exists" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  app.get("/api/user", authenticate, async (req: express.Request & { user: any }, res: express.Response) => {
    const [user] = await sql`SELECT id, email, name, xp, streak FROM users WHERE id = ${req.user.id}`;
    res.json(user);
  });

  app.get("/api/user/settings", authenticate, async (req: express.Request & { user: any }, res: express.Response) => {
    const [settings] = await sql`SELECT streak, daily_goal, study_dates FROM users WHERE id = ${req.user.id}`;
    res.json(settings || { streak: 0, daily_goal: 10, study_dates: [] });
  });

  app.post("/api/user/settings", authenticate, async (req: express.Request & { user: any }, res: express.Response) => {
    const { streak, daily_goal, study_dates } = req.body;
    await sql`
      UPDATE users 
      SET streak = ${streak}, daily_goal = ${daily_goal}, study_dates = ${JSON.stringify(study_dates)}
      WHERE id = ${req.user.id}
    `;
    res.json({ success: true });
  });

  // ... (rest of the routes will need to be updated to use authenticate middleware and req.user.id)

  app.get("/api/decks", authenticate, async (req: express.Request & { user: any }, res: express.Response) => {
    const decks = await sql`
      SELECT d.*, 
             COUNT(c.id) as cardCount
      FROM decks d 
      LEFT JOIN cards c ON d.id = c.deck_id 
      WHERE d.user_id = ${req.user.id}
      GROUP BY d.id
    `;

    // Fetch preview cards for each deck
    for (const deck of decks) {
      deck.previewCards = await sql`SELECT term FROM cards WHERE deck_id = ${deck.id} LIMIT 3`;
    }

    res.json(decks);
  });

  app.delete("/api/decks/:id", authenticate, async (req: express.Request & { user: any }, res: express.Response) => {
    const { id } = req.params;
    await sql`DELETE FROM decks WHERE id = ${id} AND user_id = ${req.user.id}`;
    res.json({ success: true });
  });

  app.put("/api/decks/:id", authenticate, async (req: express.Request & { user: any }, res: express.Response) => {
    const { id } = req.params;
    const { title, description } = req.body;
    await sql`UPDATE decks SET title = ${title}, description = ${description} WHERE id = ${id} AND user_id = ${req.user.id}`;
    res.json({ success: true });
  });

  app.post("/api/decks", authenticate, async (req: express.Request & { user: any }, res: express.Response) => {
    const { title, description, category, cards } = req.body;
    
    const [deck] = await sql`
      INSERT INTO decks (user_id, title, description, category) 
      VALUES (${req.user.id}, ${title}, ${description || `${cards.length}개의 단어가 포함된 단어장`}, ${category})
      RETURNING id
    `;
    const deckId = deck.id;
    
    for (const card of cards) {
      await sql`
        INSERT INTO cards (deck_id, term, meaning, example, category, difficulty, source) 
        VALUES (${deckId}, ${card.term}, ${card.meaning}, ${card.example}, ${card.category}, ${card.difficulty || 'medium'}, ${card.source || ''})
      `;
    }
    
    res.json({ success: true, deckId });
  });

  app.post("/api/decks/generate", authenticate, async (req: express.Request & { user: any }, res: express.Response) => {
    const { cards } = req.body;
    const prompt = `Based on these cards, generate a concise title and a short description for a vocabulary deck.
    Cards: ${JSON.stringify(cards.slice(0, 5))}
    Return JSON format: { "title": "...", "description": "..." }`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    res.json(JSON.parse(response.text || '{}'));
  });

  app.get("/api/decks/:id", authenticate, async (req: express.Request & { user: any }, res: express.Response) => {
    const { id } = req.params;
    const [deck] = await sql`SELECT * FROM decks WHERE id = ${id} AND user_id = ${req.user.id}`;
    if (!deck) {
      return res.status(404).json({ error: "Deck not found" });
    }
    const cards = await sql`SELECT * FROM cards WHERE deck_id = ${id}`;
    res.json({ ...deck, words: cards });
  });

  app.get("/api/decks/:id/cards", authenticate, async (req: express.Request & { user: any }, res: express.Response) => {
    const { id } = req.params;
    const cards = await sql`SELECT * FROM cards WHERE deck_id = ${id}`;
    res.json(cards);
  });

  app.get("/api/study/today", authenticate, async (req: express.Request & { user: any }, res: express.Response) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Simple logic: cards that haven't been studied yet OR are due today
    const cards = await sql`
      SELECT c.*, s.status, s.next_review_date 
      FROM cards c
      JOIN decks d ON c.deck_id = d.id
      LEFT JOIN study_sessions s ON c.id = s.card_id AND s.user_id = ${req.user.id}
      WHERE d.user_id = ${req.user.id} AND (s.next_review_date IS NULL OR s.next_review_date <= ${today})
      LIMIT 50
    `;
    
    res.json(cards);
  });

  app.post("/api/study/feedback", authenticate, async (req: express.Request & { user: any }, res: express.Response) => {
    const { cardId, feedback } = req.body; // feedback: 'easy', 'medium', 'hard'
    
    const [existing] = await sql`SELECT * FROM study_sessions WHERE user_id = ${req.user.id} AND card_id = ${cardId}`;
    
    let interval = 1;
    let easeFactor = 2.5;
    
    if (existing) {
      interval = existing.interval;
      easeFactor = existing.ease_factor;
    }

    // Simple SRS logic
    if (feedback === 'easy') {
      interval = Math.ceil(interval * easeFactor * 1.5);
      easeFactor += 0.1;
    } else if (feedback === 'medium') {
      interval = Math.ceil(interval * easeFactor);
    } else {
      interval = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);
    const nextReviewStr = nextReview.toISOString().split('T')[0];

    if (existing) {
      await sql`
        UPDATE study_sessions 
        SET status = ${feedback}, next_review_date = ${nextReviewStr}, interval = ${interval}, ease_factor = ${easeFactor}, last_reviewed_at = NOW()
        WHERE id = ${existing.id}
      `;
    } else {
      await sql`
        INSERT INTO study_sessions (user_id, card_id, status, next_review_date, interval, ease_factor)
        VALUES (${req.user.id}, ${cardId}, ${feedback}, ${nextReviewStr}, ${interval}, ${easeFactor})
      `;
    }

    // Update user XP
    await sql`UPDATE users SET xp = xp + 10 WHERE id = ${req.user.id}`;
    
    res.json({ success: true, nextReview: nextReviewStr });
  });

  app.get("/api/study/status/:status", authenticate, async (req: express.Request & { user: any }, res: express.Response) => {
    const { status } = req.params;
    
    const cards = await sql`
      SELECT c.*, s.status 
      FROM cards c
      JOIN study_sessions s ON c.id = s.card_id
      WHERE s.user_id = ${req.user.id} AND LOWER(s.status) = LOWER(${status})
    `;
    
    res.json(cards);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("[INFO] Running in development mode with Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[INFO] Running in production mode");
    const distPath = path.join(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      console.warn("[WARN] dist folder not found. Falling back to simple message.");
      app.get("*", (req, res) => {
        res.status(404).send("Application is building or dist folder is missing. Please wait or run build.");
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
