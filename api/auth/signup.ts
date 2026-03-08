import postgres from 'postgres';
import bcrypt from 'bcryptjs';

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '이름, 이메일, 비밀번호를 입력해주세요.'
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    await sql`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email}, ${password_hash}, ${name})
    `;

    return res.status(200).json({
      success: true,
      message: '회원가입이 완료되었습니다.'
    });
  } catch (error: any) {
    console.error('signup error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        success: false,
        message: '이미 가입된 이메일입니다. 로그인해주세요.'
      });
    }
    return res.status(500).json({
      success: false,
      message: '회원가입 중 오류가 발생했습니다.'
    });
  }
}
