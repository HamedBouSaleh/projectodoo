import { odooAuth, odooCall } from '../odoo.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if ((req.body||{}).action === 'create') return await createFeedback(req, res);
    return await listFeedback(req, res); 
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function createFeedback(req, res) {
  const { customerName, rating, category, comments, orderReference } = req.body;
  if (!customerName || !rating || !comments) {
    return res.status(400).json({ error: 'customerName, rating and comments are required' });
  }

  const { ODOO_URL, sessionId } = await odooAuth();


  const partnerLookup = await odooCall(ODOO_URL, sessionId, 'res.partner', 'search_read',
    [[['name', 'ilike', customerName]]], { fields: ['id', 'name'], limit: 1 });
  const partnerId = partnerLookup.result?.[0]?.id || false;
  const stars = '★'.repeat(Number(rating)) + '☆'.repeat(5 - Number(rating));

  const createData = await odooCall(ODOO_URL, sessionId, 'helpdesk.ticket', 'create', [{
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
}

async function listFeedback(req, res) {
  const { customerName } = req.body;
  if (!customerName) return res.status(400).json({ error: 'customerName is required' });

  const { ODOO_URL, sessionId } = await odooAuth();

  const domain = [
    '&',
    ['name', 'like', '[Feedback]'],
    '|', ['partner_name', 'ilike', customerName], ['partner_id.name', 'ilike', customerName]
  ];

  const feedbackData = await odooCall(ODOO_URL, sessionId, 'helpdesk.ticket', 'search_read', [domain], {
    fields: ['name', 'description', 'create_date'],
    order: 'create_date desc',
    limit: 20
  });
  const items = feedbackData.result;

  if (!items || items.length === 0) return res.status(200).json({ found: false });

  return res.status(200).json({
    found: true,
    feedback: items.map(f => ({
      ticketId: f.id,
      category: (f.name || '').replace('[Feedback] ', ''),
      comments: f.description,
      createdDate: f.create_date
    }))
  });
}
