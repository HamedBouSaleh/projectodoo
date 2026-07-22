export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { customerName } = req.body;
  if (!customerName) {
    return res.status(400).json({ error: 'customerName is required' });
  }

  const ODOO_URL = process.env.ODOO_URL;
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

    const call = (model, method, args, kwargs = {}) =>
      fetch(`${ODOO_URL}/web/dataset/call_kw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: { model, method, args, kwargs },
          id: 1
        })
      }).then(r => r.json());

    const partnerRes = await call('res.partner', 'search_read', [
      [['name', 'ilike', customerName]]
    ], {
      fields: ['id', 'name', 'email', 'phone', 'mobile', 'street', 'street2', 'city', 'country_id', 'vat'],
      limit: 1
    });

    const partner = partnerRes.result?.[0];
    if (!partner) return res.status(200).json({ found: false });

    return res.status(200).json({
      found: true,
      account: {
        id: partner.id,
        name: partner.name,
        email: partner.email || '',
        phone: partner.phone || '',
        mobile: partner.mobile || '',
        street: partner.street || '',
        street2: partner.street2 || '',
        city: partner.city || '',
        country: partner.country_id ? partner.country_id[1] : '',
        vat: partner.vat || ''
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
