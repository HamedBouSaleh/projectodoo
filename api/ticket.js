export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { customerName, description, orderNumber, issueType } = req.body;

  const ODOO_URL = process.env.ODOO_URL;
  const DB = process.env.DB ;
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

    const ticketRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'helpdesk.ticket',
          method: 'create',
          args: [{
            name: `Order ${orderNumber} : ${issueType} `,
            description: `Customer: ${customerName}\nOrder: ${orderNumber}\nIssue: ${description}`,
            team_id: 1
          }],
          kwargs: {}
        },
        id: 1
      })
    });

    const ticketData = await ticketRes.json();
    const ticketId = ticketData.result;

    return res.status(200).json({
      success: true,
      ticketId: ticketId,
      message: `Your complaint has been registered. Ticket ID: ${ticketId}`
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
