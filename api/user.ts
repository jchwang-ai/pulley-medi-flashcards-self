export default async function handler(req: any, res: any) {
  return res.status(200).json({
    id: 1,
    name: "Nursing Student",
    xp: 0,
    streak: 0,
  });
}
