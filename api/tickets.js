import { odooAuth, odooCall } from '../odoo.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.body.action === 'create') return await createTicket(req, res);
    return await listTickets(req, res); // default — matches existing list callers
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function createTicket(req, res) {
  const { customerName, description, orderNumber, issueType, priority } = req.body;
  if (!customerName || !description) {
    return res.status(400).json({ error: 'customerName and description are required' });
  }

  const { ODOO_URL, sessionId } = await odooAuth();

  const partnerLookup = await odooCall(ODOO_URL, sessionId, 'res.partner', 'search_read',
    [[['name', 'ilike', customerName]]], { fields: ['id', 'name'], limit: 1 });
  const partnerId = partnerLookup.result?.[0]?.id || false;

  const createData = await odooCall(ODOO_URL, sessionId, 'helpdesk.ticket', 'create', [{
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
}

async function listTickets(req, res) {
  const { customerName, orderNumber } = req.body;
  if (!customerName) return res.status(400).json({ error: 'customerName is required' });

  const { ODOO_URL, sessionId } = await odooAuth();

  const customerClause = ['|', ['partner_name', 'ilike', customerName], ['partner_id.name', 'ilike', customerName]];
  const domain = orderNumber
    ? ['&', ...customerClause, ['name', 'ilike', orderNumber]]
    : customerClause;

  const ticketsData = await odooCall(ODOO_URL, sessionId, 'helpdesk.ticket', 'search_read', [domain], {
    fields: ['name', 'stage_id', 'description', 'create_date', 'partner_name', 'priority'],
    order: 'create_date desc',
    limit: 50
  });
  const tickets = ticketsData.result;

  if (!tickets || tickets.length === 0) {
    return res.status(200).json({ found: false, message: `No tickets found for ${customerName}` });
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
}
