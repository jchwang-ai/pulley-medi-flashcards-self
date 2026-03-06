import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("vocab.db");

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    name TEXT,
    xp INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    last_study_date TEXT
  );

  CREATE TABLE IF NOT EXISTS decks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    description TEXT,
    category TEXT,
    is_public INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deck_id INTEGER,
    term TEXT,
    meaning TEXT,
    example TEXT,
    category TEXT,
    difficulty TEXT,
    source TEXT,
    FOREIGN KEY(deck_id) REFERENCES decks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    card_id INTEGER,
    status TEXT, -- 'easy', 'medium', 'hard'
    next_review_date TEXT,
    interval INTEGER DEFAULT 1,
    ease_factor REAL DEFAULT 2.5,
    last_reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    code TEXT UNIQUE,
    created_by INTEGER
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER,
    user_id INTEGER,
    role TEXT DEFAULT 'member',
    PRIMARY KEY(group_id, user_id)
  );
`);

// Seed a default user if none exists
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO users (email, name, streak, xp) VALUES (?, ?, ?, ?)").run("student@nursing.edu", "Nursing Student", 3, 450);
  
  // Seed a sample deck
  const deckResult = db.prepare("INSERT INTO decks (user_id, title, description, category) VALUES (?, ?, ?, ?)").run(
    1, 
    "Vital Signs & Assessment", 
    "Essential terminology for patient assessment and monitoring.", 
    "Vital Signs"
  );
  const deckId = deckResult.lastInsertRowid;

  const sampleCards = [
    { term: "Auscultation", meaning: "청진 (몸 안의 소리를 듣는 것)", example: "Auscultation of the heart is part of the physical exam.", category: "Assessment", difficulty: "medium", source: "NCLEX" },
    { term: "Bradycardia", meaning: "서맥 (심박수가 분당 60회 미만)", example: "The patient developed bradycardia after the medication.", category: "Cardiac", difficulty: "easy", source: "NCLEX" },
    { term: "Tachycardia", meaning: "빈맥 (심박수가 분당 100회 초과)", example: "Fever can cause tachycardia.", category: "Cardiac", difficulty: "easy", source: "NCLEX" },
    { term: "Hypoxia", meaning: "저산소증", example: "Cyanosis is a late sign of hypoxia.", category: "Respiratory", difficulty: "hard", source: "NCLEX" },
    { term: "Palpation", meaning: "촉진 (손으로 만져서 진찰하는 것)", example: "Palpation of the abdomen revealed tenderness.", category: "Assessment", difficulty: "medium", source: "NCLEX" },
    { term: "Cyanosis", meaning: "청색증", example: "The patient's lips showed signs of cyanosis.", category: "Respiratory", difficulty: "medium", source: "NCLEX" },
    { term: "Dyspnea", meaning: "호흡곤란", example: "The patient complained of severe dyspnea.", category: "Respiratory", difficulty: "medium", source: "NCLEX" },
  ];

  const insertCard = db.prepare("INSERT INTO cards (deck_id, term, meaning, example, category, difficulty, source) VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (const card of sampleCards) {
    insertCard.run(deckId, card.term, card.meaning, card.example, card.category, card.difficulty, card.source);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/user", (req, res) => {
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    res.json(user);
  });

  app.get("/api/decks", (req, res) => {
    const decks = db.prepare(`
      SELECT d.*, 
             COUNT(c.id) as cardCount,
             COUNT(CASE WHEN s.status = 'easy' THEN 1 END) as easyCount,
             COUNT(CASE WHEN s.status = 'medium' THEN 1 END) as mediumCount,
             COUNT(CASE WHEN s.status = 'hard' THEN 1 END) as hardCount
      FROM decks d 
      LEFT JOIN cards c ON d.id = c.deck_id 
      LEFT JOIN study_sessions s ON c.id = s.card_id
      GROUP BY d.id
    `).all() as any[];

    // Fetch preview cards for each deck
    for (const deck of decks) {
      deck.previewCards = db.prepare("SELECT term FROM cards WHERE deck_id = ? LIMIT 3").all(deck.id);
    }

    res.json(decks);
  });

  app.put("/api/decks/:id", (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;
    db.prepare("UPDATE decks SET title = ?, description = ? WHERE id = ?").run(title, description, id);
    res.json({ success: true });
  });

  app.post("/api/decks", (req, res) => {
    const { title, description, category, cards } = req.body;
    const user = db.prepare("SELECT id FROM users LIMIT 1").get() as { id: number };
    
    const deckResult = db.prepare("INSERT INTO decks (user_id, title, description, category) VALUES (?, ?, ?, ?)").run(
      user.id, title, description, category
    );
    const deckId = deckResult.lastInsertRowid;
    
    const insertCard = db.prepare("INSERT INTO cards (deck_id, term, meaning, example, category, difficulty, source) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const card of cards) {
      insertCard.run(deckId, card.term, card.meaning, card.example, card.category, card.difficulty || 'medium', card.source || '');
    }
    
    res.json({ success: true, deckId });
  });

  app.post("/api/decks/generate", async (req, res) => {
    const { cards } = req.body;
    const prompt = `Based on these cards, generate a concise title and a short description for a vocabulary deck.
    Cards: ${JSON.stringify(cards.slice(0, 5))}
    Return JSON format: { "title": "...", "description": "..." }`;
    
    // Using Gemini to generate title and description
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    res.json(JSON.parse(response.text || '{}'));
  });

  app.get("/api/decks/:id/cards", (req, res) => {
    const { id } = req.params;
    const cards = db.prepare("SELECT * FROM cards WHERE deck_id = ?").all(id);
    res.json(cards);
  });

  app.get("/api/study/today", (req, res) => {
    const user = db.prepare("SELECT id FROM users LIMIT 1").get() as { id: number };
    const today = new Date().toISOString().split('T')[0];
    
    // Simple logic: cards that haven't been studied yet OR are due today
    const cards = db.prepare(`
      SELECT c.*, s.status, s.next_review_date 
      FROM cards c
      LEFT JOIN study_sessions s ON c.id = s.card_id AND s.user_id = ?
      WHERE s.next_review_date IS NULL OR s.next_review_date <= ?
      LIMIT 50
    `).all(user.id, today);
    
    res.json(cards);
  });

  app.post("/api/study/feedback", (req, res) => {
    const { cardId, feedback } = req.body; // feedback: 'easy', 'medium', 'hard'
    const user = db.prepare("SELECT id FROM users LIMIT 1").get() as { id: number };
    
    const existing = db.prepare("SELECT * FROM study_sessions WHERE user_id = ? AND card_id = ?").get(user.id, cardId) as any;
    
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
      db.prepare(`
        UPDATE study_sessions 
        SET status = ?, next_review_date = ?, interval = ?, ease_factor = ?, last_reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(feedback, nextReviewStr, interval, easeFactor, existing.id);
    } else {
      db.prepare(`
        INSERT INTO study_sessions (user_id, card_id, status, next_review_date, interval, ease_factor)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(user.id, cardId, feedback, nextReviewStr, interval, easeFactor);
    }

    // Update user XP
    db.prepare("UPDATE users SET xp = xp + 10 WHERE id = ?").run(user.id);

    res.json({ success: true, nextReview: nextReviewStr });
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
