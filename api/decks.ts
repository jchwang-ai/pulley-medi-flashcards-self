let decks = [];

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json(decks);
  }

  if (req.method === "POST") {
    try {
      const body = req.body || {};

      const newDeck = {
        id: Date.now().toString(),
        ...body,
      };

      decks.push(newDeck);

      return res.status(200).json(newDeck);
    } catch (error) {
      return res.status(500).json({ error: "Server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
