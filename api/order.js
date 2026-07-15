export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { orderNumber } = req.body;
  if (!orderNumber) {
    return res.status(400).json({ error: 'orderNumber is required' });
  }

  const ODOO_URL = 'https://transmed-cx-staging-h-34608506.dev.odoo.com';
  const DB = 'transmed-cx-staging-h-34608506';
  const LOGIN = 'hamed.bousaleh@transmed.com';
  const PASSWORD = 'Hamed@2026';

  try {
    // Step 1 - Login to get session
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

    if (!sessionId) {
      return res.status(401).json({ error: 'Login failed' });
    }

    // Step 2 - Query order using session
    const orderRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'sale.order',
          method: 'search_read',
          args: [[['name', '=', orderNumber]]],
          kwargs: {
            fields: ['name', 'state', 'amount_total', 'date_order', 'partner_id'],
            limit: 1
          }
        },
        id: 1
      })
    });

    const orderData = await orderRes.json();
    const orders = orderData.result;

    if (!orders || orders.length === 0) {
      return res.status(200).json({
        found: false,
        message: `No order found with number ${orderNumber}`
      });
    }

    const order = orders[0];
    return res.status(200).json({
      found: true,
      orderName: order.name,
      status: order.state,
      totalAmount: order.amount_total,
      orderDate: order.date_order,
      customerName: order.partner_id[1]
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
