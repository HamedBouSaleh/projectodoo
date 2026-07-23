import { odooAuth, odooCall } from '../odoo.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.body || {};

  try {
    if (body.action === 'company') return await topItems(null, res, body.limit);
    if (!body.customerName) return res.status(400).json({ error: 'customerName is required' });
    return await topItems(body.customerName, res, body.limit);
  } catch (error) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}

async function topItems(customerName, res, limit) {
  const { ODOO_URL, sessionId } = await odooAuth();

  const domain = [
    ['order_id.state', '!=', 'cancel'],
    ['product_id', '!=', false]
  ];
  if (customerName) domain.push(['order_id.partner_id.name', 'ilike', customerName]);

  const groupData = await odooCall(ODOO_URL, sessionId, 'sale.order.line', 'read_group',
    [domain, ['product_uom_qty:sum'], ['product_id']],
    { orderby: 'product_uom_qty desc', limit: limit || 5 });

  const groups = groupData.result;
  if (!groups) return res.status(200).json({ found: false, debug: groupData });
  if (groups.length === 0) return res.status(200).json({ found: false, debug: { note: 'zero matching rows' } });

  return res.status(200).json({
    found: true,
    items: groups.map(g => ({ productName: g.product_id ? g.product_id[1] : 'Unknown item', quantity: g.product_uom_qty }))
  });
}
