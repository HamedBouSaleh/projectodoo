export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { customerName, orderNumber } = req.body;
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

    // Match on either the free-text partner_name (set by our own create
    // endpoint) or the linked partner_id's name (set when a ticket was
    // created directly in Odoo, e.g. by the bot or an agent).
    const customerClause = ['|', ['partner_name', 'ilike', customerName], ['partner_id.name', 'ilike', customerName]];
    const domain = orderNumber
      ? ['&', ...customerClause, ['name', 'ilike', orderNumber]]
      : customerClause;

    const ticketsRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
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
            fields: ['name', 'stage_id', 'description', 'create_date', 'partner_name', 'priority'],
            order: 'create_date desc',
            limit: 50
          }
        },
        id: 1
      })
    });
    const ticketsData = await ticketsRes.json();
    const tickets = ticketsData.result;

    if (!tickets || tickets.length === 0) {
      return res.status(200).json({
        found: false,
        message: `No tickets found for ${customerName}`
      });
    }

    return res.status(200).json({
      found: true,
      tickets: tickets.map(t => ({
        ticketId: t.id,
        title: t.name,
        status: t.stage_id ? t.stage_id[1] : 'New',
        createdDate: t.create_date,
        priority: t.priority || '0'
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
