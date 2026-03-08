import postgres from 'postgres';
import bcrypt from 'bcryptjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing');
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
});

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
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await initDatabase();

    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '이름, 이메일, 비밀번호를 입력해주세요.'
      });
    }

    const trimmedName = String(name).trim();
    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedPassword = String(password).trim();

    if (!trimmedName || !trimmedEmail || !trimmedPassword) {
      return res.status(400).json({
        success: false,
        message: '이름, 이메일, 비밀번호를 입력해주세요.'
      });
    }

    const existing = await sql`
      SELECT id FROM users
      WHERE email = ${trimmedEmail}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 가입된 이메일입니다. 로그인해주세요.'
      });
    }

    const password_hash = await bcrypt.hash(trimmedPassword, 10);
    const id = Date.now().toString();

    await sql`
      INSERT INTO users (id, email, password_hash, name)
      VALUES (${id}, ${trimmedEmail}, ${password_hash}, ${trimmedName})
    `;

    return res.status(200).json({
      success: true,
      message: '회원가입이 완료되었습니다.'
    });
  } catch (error: any) {
    console.error('signup detailed error:', error);

    return res.status(500).json({
      success: false,
      message: '회원가입 중 오류가 발생했습니다.',
      detail: error?.message || String(error)
    });
  }
}
