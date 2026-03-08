export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const body = req.body || {};

      return res.status(200).json({
        success: true,
        message: "Deck created",
        data: body
      });

    } catch (error) {
      return res.status(500).json({
        error: "Server error"
      });
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}
