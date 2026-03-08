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

  await connectRedis();

  if (req.method === "GET") {

    const data = await client.get("decks");

    const decks = data ? JSON.parse(data) : [];

    return res.status(200).json(decks);
  }

  if (req.method === "POST") {

    const body = req.body;

    const data = await client.get("decks");

    const decks = data ? JSON.parse(data) : [];

    const newDeck = {
      id: Date.now().toString(),
      ...body
    };

    decks.push(newDeck);

    await client.set("decks", JSON.stringify(decks));

    return res.status(200).json(newDeck);
  }

  if (req.method === "DELETE") {

    const { id } = req.query;

    const data = await client.get("decks");

    const decks = data ? JSON.parse(data) : [];

    const newDecks = decks.filter(d => d.id !== id);

    await client.set("decks", JSON.stringify(newDecks));

    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
