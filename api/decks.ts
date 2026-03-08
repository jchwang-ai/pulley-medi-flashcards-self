import { createClient } from "redis";

const client = createClient({
  url: process.env.REDIS_URL
});

let connected = false;

async function connectRedis() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
}

export default async function handler(req, res) {
  try {
    await connectRedis();

    if (req.method === "GET") {
      const data = await client.get("decks");
      const decks = data ? JSON.parse(data) : [];
      return res.status(200).json(decks);
    }

    if (req.method === "POST") {
      const body = req.body || {};

      const data = await client.get("decks");
      const decks = data ? JSON.parse(data) : [];

      const newDeck = {
        id: Date.now().toString(),
        name: body.name || "새 단어장",
        words: Array.isArray(body.words) ? body.words : [],
        createdAt: new Date().toISOString()
      };

      decks.push(newDeck);

      await client.set("decks", JSON.stringify(decks));

      return res.status(200).json(newDeck);
    }

    if (req.method === "DELETE") {
      const { id } = req.query;

      const data = await client.get("decks");
      const decks = data ? JSON.parse(data) : [];

      const newDecks = decks.filter((d) => d.id !== id);

      await client.set("decks", JSON.stringify(newDecks));

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("api/decks error:", error);
    return res.status(500).json({
      error: "Internal server error",
      detail: String(error)
    });
  }
}
