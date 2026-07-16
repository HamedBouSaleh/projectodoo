export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { orderNumber } = req.body;

  const ODOO_URL = 'https://transmed-cx-staging-h-34608506.dev.odoo.com';
  const DB = 'transmed-cx-staging-h-34608506';
  const LOGIN = 'hamed.bousaleh@transmed.com';
  const PASSWORD = 'YOUR_ACTUAL_PASSWORD';

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

    const invoiceRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'account.move',
          method: 'search_read',
          args: [[['invoice_origin', '=', orderNumber], ['move_type', '=', 'out_invoice']]],
          kwargs: {
            fields: ['name', 'state', 'amount_total', 'invoice_date', 'payment_state'],
            limit: 1
          }
        },
        id: 1
      })
    });

    const invoiceData = await invoiceRes.json();
    const invoices = invoiceData.result;

    if (!invoices || invoices.length === 0) {
      return res.status(200).json({
        found: false,
        message: `No invoice found for order ${orderNumber}`
      });
    }

    const invoice = invoices[0];
    return res.status(200).json({
      found: true,
      invoiceNumber: invoice.name,
      status: invoice.state,
      paymentStatus: invoice.payment_state,
      amount: invoice.amount_total,
      invoiceDate: invoice.invoice_date
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
