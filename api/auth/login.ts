import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

let sql: any = null;
if (process.env.DATABASE_URL) {
  sql = postgres(process.env.DATABASE_URL, {
    ssl: 'require',
  });
} else {
  console.error('DATABASE_URL is missing');
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export default async function handler(req: any, res: any) {
  if (!sql) {
    console.error("Database connection not initialized");
    return res.status(500).json({ success: false, message: 'Database configuration error' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "이메일과 비밀번호를 입력해주세요."
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const users = await sql`
      SELECT id, email, password_hash, name
      FROM users
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `.catch(err => {
      console.error("Database query error:", err);
      throw new Error("데이터베이스 연결 오류: " + err.message);
    });

    const user = users[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "이메일 또는 비밀번호가 올바르지 않습니다."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "이메일 또는 비밀번호가 올바르지 않습니다."
      });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    return res.status(200).json({
      success: true,
      message: "로그인되었습니다.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error: any) {
    console.error("login error:", error);
    return res.status(500).json({
      success: false,
      message: "로그인 중 오류가 발생했습니다.",
      detail: error?.message || String(error)
    });
  }
}
