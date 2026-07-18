module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password required' });
  }

  const ODOO_URL = 'https://transmed-cx-staging-h-34608506.dev.odoo.com';
  const DB = 'transmed-cx-staging-h-34608506';

  try {
    const loginRes = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { db: DB, login: email, password: password }
      })
    });

    const loginData = await loginRes.json();
    const result = loginData.result;

    if (!result || !result.uid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    return res.status(200).json({
      success: true,
      user: {
        uid: result.uid,
        name: result.name,
        email: email,
        sessionId: result.session_id,
        partnerId: result.partner_id
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
