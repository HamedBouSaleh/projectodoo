import { odooAuth, odooCall } from '../odoo.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.body || {};

  try {
    if (body.action === 'create') return await createOpportunity(body, res);
    return await listOpportunities(body, res); // default
  } catch (error) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}

async function createOpportunity(body, res) {
  const { customerName, description, productHint } = body;
  if (!customerName || !description) {
    return res.status(400).json({ error: 'customerName and description are required' });
  }

  const { ODOO_URL, sessionId } = await odooAuth();
  const partnerLookup = await odooCall(ODOO_URL, sessionId, 'res.partner', 'search_read',
    [[['name', 'ilike', customerName]]], { fields: ['id', 'name'], limit: 1 });
  const partnerId = partnerLookup.result?.[0]?.id || false;
  const createData = await odooCall(ODOO_URL, sessionId, 'crm.lead', 'create', [{
    name: `Order request — ${customerName}${productHint ? ` (${productHint})` : ''}`,
    description: description,
    type: 'opportunity',
    contact_name: customerName,
    ...(partnerId ? { partner_id: partnerId } : {})
  }]);

  const leadId = createData.result;
  if (!leadId) return res.status(500).json({ error: 'Request creation failed', details: createData });

  return res.status(200).json({
    success: true,
    leadId,
    message: 'Your request has been sent to our sales team.'
  });
}

async function listOpportunities(body, res) {
  const { customerName } = body;
  if (!customerName) return res.status(400).json({ error: 'customerName is required' });

  const { ODOO_URL, sessionId } = await odooAuth();

  const domain = [
    '|', ['contact_name', 'ilike', customerName], ['partner_id.name', 'ilike', customerName]
  ];

  const leadsData = await odooCall(ODOO_URL, sessionId, 'crm.lead', 'search_read', [domain], {
    fields: ['name', 'description', 'stage_id', 'create_date'],
    order: 'create_date desc',
    limit: 20
  });
  const leads = leadsData.result;

  if (!leads || leads.length === 0) return res.status(200).json({ found: false });

  return res.status(200).json({
    found: true,
    requests: leads.map(l => ({
      leadId: l.id,
      title: l.name,
      description: l.description,
      stage: l.stage_id ? l.stage_id[1] : 'New',
      createdDate: l.create_date
    }))
  });
}
