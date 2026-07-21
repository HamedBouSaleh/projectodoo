export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { customerName, description, orderNumber, issueType, priority } = req.body;
  if (!customerName || !description) {
    return res.status(400).json({ error: 'customerName and description are required' });
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

    // Resolve the actual partner record so the ticket links to the real
    // customer, not just a free-text name. Falls back to partner_name
    // alone if no match is found — the ticket still gets created either way.
    const partnerLookup = await call('res.partner', 'search_read', [
      [['name', 'ilike', customerName]]
    ], { fields: ['id', 'name'], limit: 1 });

    const partnerId = partnerLookup.result?.[0]?.id || false;

    const createData = await call('helpdesk.ticket', 'create', [{
      name: `Order ${orderNumber} : ${issueType}`,
      description: `Customer: ${customerName}\nOrder: ${orderNumber}\nIssue: ${description}`,
      team_id: 1,
      partner_name: customerName,
      priority: String(priority ?? '0'),
      ...(partnerId ? { partner_id: partnerId } : {})
    }]);

    const ticketId = createData.result;
    if (!ticketId) return res.status(500).json({ error: 'Ticket creation failed', details: createData });

    return res.status(200).json({
      success: true,
      ticketId,
      message: `Your complaint has been registered. Ticket ID: ${ticketId}`
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
