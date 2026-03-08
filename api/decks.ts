export default async function handler(req, res) {
  if (req.method === "POST") {
    return res.status(200).json([
      {
        id: "1",
        name: "테스트 단어장"
      }
    ]);
  }

  return res.status(405).json([]);
}
