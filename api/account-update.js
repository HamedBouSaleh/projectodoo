export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { partnerId, phone, mobile, street, street2, city } = req.body;
  if (!partnerId) {
    return res.status(400).json({ error: 'partnerId is required' });
  }

  const ODOO_URL = process.env.URL;
  const DB = process.env.DB;
  const LOGIN = process.env.LOGIN;
  const PASSWORD = process.env.PASSWORD;

  try {
    const loginRes = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { db: DB, login: LOGIN, password: PASSWORD }
      })
    });
    const loginData = await loginRes.json();
    const sessionId = loginData.result?.session_id;
    if (!sessionId) return res.status(401).json({ error: 'Login failed' });

    // Only contact-detail fields are writable from the portal. Name, email,
    // VAT etc. stay read-only — those are identity/billing fields, changing
    // them here would silently diverge from JDE/Odoo's source of truth.
    const writeRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'write',
          args: [[partnerId], { phone, mobile, street, street2, city }],
          kwargs: {}
        },
        id: 1
      })
    });
    const writeData = await writeRes.json();

    if (!writeData.result) {
      return res.status(500).json({ error: 'Update failed', details: writeData });
    }

    return res.status(200).json({ success: true, message: 'Account details updated.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
