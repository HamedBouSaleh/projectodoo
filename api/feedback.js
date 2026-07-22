export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { customerName, rating, category, comments, orderReference } = req.body;
  if (!customerName || !rating || !comments) {
    return res.status(400).json({ error: 'customerName, rating and comments are required' });
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

    // Feedback is a helpdesk.ticket, same as complaints — flagged via a
    // [Feedback] name prefix + category rather than a separate Odoo model.
    // Mirrors ticket.js's partner-resolution pattern exactly.
    const partnerLookup = await call('res.partner', 'search_read', [
      [['name', 'ilike', customerName]]
    ], { fields: ['id', 'name'], limit: 1 });

    const partnerId = partnerLookup.result?.[0]?.id || false;
    const stars = '★'.repeat(Number(rating)) + '☆'.repeat(5 - Number(rating));

    const createData = await call('helpdesk.ticket', 'create', [{
      name: `[Feedback] ${category || 'General'}`,
      description: `Customer: ${customerName}\nCategory: ${category || 'General'}\nRating: ${stars} (${rating}/5)\n${orderReference ? `Order: ${orderReference}\n` : ''}Comments: ${comments}`,
      team_id: 1,
      partner_name: customerName,
      priority: '0',
      ...(partnerId ? { partner_id: partnerId } : {})
    }]);

    const ticketId = createData.result;
    if (!ticketId) return res.status(500).json({ error: 'Feedback creation failed', details: createData });

    return res.status(200).json({
      success: true,
      ticketId,
      message: 'Thanks — your feedback has been recorded.'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
