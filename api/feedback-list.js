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

    // Same customer-identity domain as tickets.js, narrowed to tickets
    // flagged as feedback via the [Feedback] name prefix.
    const domain = [
      '&',
      ['name', 'like', '[Feedback]'],
      '|', ['partner_name', 'ilike', customerName], ['partner_id.name', 'ilike', customerName]
    ];

    const feedbackRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'helpdesk.ticket',
          method: 'search_read',
          args: [domain],
          kwargs: {
            fields: ['name', 'description', 'create_date'],
            order: 'create_date desc',
            limit: 20
          }
        },
        id: 1
      })
    });
    const feedbackData = await feedbackRes.json();
    const items = feedbackData.result;

    if (!items || items.length === 0) {
      return res.status(200).json({ found: false });
    }

    return res.status(200).json({
      found: true,
      feedback: items.map(f => ({
        ticketId: f.id,
        category: (f.name || '').replace('[Feedback] ', ''),
        comments: f.description,
        createdDate: f.create_date
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
