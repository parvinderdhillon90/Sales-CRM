import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

function d(offset: number): Date {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  dt.setHours(12, 0, 0, 0);
  return dt;
}

export async function seedIfEmpty() {
  const count = await prisma.users.count();
  if (count > 0) return;

  console.log('[seed] Seeding database...');

  const [R, S, SI] = await Promise.all([
    prisma.users.create({ data: { name: 'Rajesh',          email: 'rajesh@salescrm.com',       password_hash: bcrypt.hashSync('Director@123', 10), role: 'director', zone: null } }),
    prisma.users.create({ data: { name: 'Sunil Balan',     email: 'sunil@salescrm.com',         password_hash: bcrypt.hashSync('Sunil@123',    10), role: 'manager',  zone: 'south_west' } }),
    prisma.users.create({ data: { name: 'Siddharth Asija', email: 'siddharth@salescrm.com',     password_hash: bcrypt.hashSync('Siddharth@123',10), role: 'manager',  zone: 'north' } }),
  ]);

  // CMD account (Parvinder)
  await prisma.users.upsert({
    where: { email: 'parvinder@cinuniverse.com' },
    update: {},
    create: { name: 'Parvinder Dhillon', email: 'parvinder@cinuniverse.com', password_hash: bcrypt.hashSync('Parvinder@123', 10), role: 'cmd', zone: null },
  });

  // Clients
  const [c1, c2, c3, c4, c5] = await Promise.all([
    prisma.clients.create({ data: { name: 'Amit Sharma',   company: 'TechCorp Mumbai',          phone: '9876543210', email: 'amit@techcorp.com',     address: 'Mumbai, Maharashtra',   zone: 'south_west', assigned_to: S.id,  created_by: R.id,  notes: 'Key decision maker. Referred by industry contact. Very serious buyer.' } }),
    prisma.clients.create({ data: { name: 'Priya Mehta',   company: 'Fashion Hub Pune',         phone: '9876543211', email: 'priya@fashionhub.com',  address: 'Pune, Maharashtra',     zone: 'south_west', assigned_to: S.id,  created_by: S.id,  notes: 'Mid-size retailer. Budget under pressure but expanding.' } }),
    prisma.clients.create({ data: { name: 'Vikram Nair',   company: 'Kerala Spices Export Ltd', phone: '9876543212', email: 'vikram@keralaspices.com',address: 'Kochi, Kerala',         zone: 'south_west', assigned_to: S.id,  created_by: R.id,  notes: 'Export business. Needs supply chain visibility. Multiple stakeholders.' } }),
    prisma.clients.create({ data: { name: 'Deepa Iyer',    company: 'Bangalore IT Solutions',   phone: '9876543213', email: 'deepa@bangaloreit.com', address: 'Bangalore, Karnataka',  zone: 'south_west', assigned_to: S.id,  created_by: S.id,  notes: 'IT services company. Long sales cycle expected.' } }),
    prisma.clients.create({ data: { name: 'Mohan Rao',     company: 'Hyderabad Pharma Ltd',     phone: '9876543219', email: 'mohan@hydpharma.com',   address: 'Hyderabad, Telangana',  zone: 'south_west', assigned_to: S.id,  created_by: R.id,  notes: 'Pharma compliance & reporting needs. Urgent requirement.' } }),
  ]);
  const [c6, c7, c8, c9, c10] = await Promise.all([
    prisma.clients.create({ data: { name: 'Ravi Kumar',      company: 'Delhi Enterprises Pvt Ltd',  phone: '9876543214', email: 'ravi@delhient.com',      address: 'New Delhi',            zone: 'north', assigned_to: SI.id, created_by: R.id,  notes: 'Large enterprise. CFO and CEO both involved in decision. High value deal.' } }),
    prisma.clients.create({ data: { name: 'Sunita Verma',    company: 'Punjab Foods & Beverages',   phone: '9876543215', email: 'sunita@punjabfoods.com', address: 'Chandigarh, Punjab',   zone: 'north', assigned_to: SI.id, created_by: SI.id, notes: 'Family-run business. 3 family members must approve. Very slow decision making.' } }),
    prisma.clients.create({ data: { name: 'Arun Gupta',      company: 'UP Textile Mills',           phone: '9876543216', email: 'arun@uptextile.com',     address: 'Lucknow, UP',          zone: 'north', assigned_to: SI.id, created_by: SI.id, notes: 'Very price sensitive. Comparing with 4 competitors. Negotiate carefully.' } }),
    prisma.clients.create({ data: { name: 'Neha Srivastava', company: 'HR Solutions Delhi',         phone: '9876543217', email: 'neha@hrsolutions.com',   address: 'Noida, UP',            zone: 'north', assigned_to: SI.id, created_by: R.id,  notes: 'High-growth startup. Expanding rapidly. Very hot lead. Rajesh referred.' } }),
    prisma.clients.create({ data: { name: 'Manish Tiwari',   company: 'Rajasthan Minerals Corp',    phone: '9876543218', email: 'manish@rajminerals.com', address: 'Jaipur, Rajasthan',    zone: 'north', assigned_to: SI.id, created_by: SI.id, notes: 'Mining company. Initial contact only. Very early stage.' } }),
  ]);

  async function deal(data: Parameters<typeof prisma.deals.create>[0]['data'], activities: Array<{user_id: number; activity_type: string; description: string; old_value?: string | null; new_value?: string | null; created_at: Date}>) {
    const deal = await prisma.deals.create({ data });
    await prisma.deal_activities.createMany({ data: activities.map(a => ({ ...a, deal_id: deal.id })) });
    return deal;
  }

  // --- SUNIL'S DEALS ---
  const d1 = await deal({
    title: 'Enterprise Software License - TechCorp', client_id: c1.id, assigned_to: S.id, created_by: R.id,
    value: 250000, stage: 'negotiation', temperature: 'hot', probability: 0.75,
    expected_close_date: d(12), last_contact_date: d(-2),
    last_contact_summary: 'Discussed pricing. They want 15% discount. Sent counter at 12%. Decision expected next week.',
    close_date_change_count: 1, notes: 'Deal initiated by Rajesh. Key enterprise account.',
  }, [
    { user_id: R.id,  activity_type: 'created',           description: 'Deal created and assigned to Sunil',                                                                         old_value: null, new_value: 'Enterprise Software License - TechCorp', created_at: d(-45) },
    { user_id: S.id,  activity_type: 'call',              description: 'Initial discovery call with Amit Sharma. Client very interested in enterprise package. 250+ users.',          old_value: null, new_value: null, created_at: d(-40) },
    { user_id: S.id,  activity_type: 'stage_change',      description: 'Qualified after thorough discovery call. Budget confirmed at ₹2.5L+',                                         old_value: 'lead', new_value: 'qualified', created_at: d(-35) },
    { user_id: S.id,  activity_type: 'meeting',           description: 'Full product demo at client office. Entire IT team present. Very positive response.',                         old_value: null, new_value: null, created_at: d(-28) },
    { user_id: S.id,  activity_type: 'stage_change',      description: 'Proposal submitted with detailed pricing and 3-year roadmap.',                                                old_value: 'qualified', new_value: 'proposal', created_at: d(-20) },
    { user_id: S.id,  activity_type: 'stage_change',      description: 'Moved to negotiation. Client wants 15% discount on license fee.',                                             old_value: 'proposal', new_value: 'negotiation', created_at: d(-10) },
    { user_id: S.id,  activity_type: 'close_date_change', description: 'Original close date was 15 days ago. Pushed due to client internal approvals.',                               old_value: d(-15).toISOString(), new_value: d(12).toISOString(), created_at: d(-8) },
    { user_id: S.id,  activity_type: 'call',              description: 'Negotiation call. Offered 12% discount + free first year support. They will revert in 2 days.',               old_value: null, new_value: null, created_at: d(-2) },
  ]);

  const d2 = await deal({
    title: 'Retail Management System - Fashion Hub', client_id: c2.id, assigned_to: S.id, created_by: S.id,
    value: 85000, stage: 'proposal', temperature: 'warm', probability: 0.50,
    expected_close_date: d(28), last_contact_date: d(-6),
    last_contact_summary: 'Sent detailed proposal. Priya is reviewing with her CA. Should respond by end of week.',
    close_date_change_count: 0,
  }, [
    { user_id: S.id, activity_type: 'created',      description: 'New deal created - Fashion Hub retail management requirement', old_value: null, new_value: 'Retail Management System - Fashion Hub', created_at: d(-30) },
    { user_id: S.id, activity_type: 'email',        description: 'Sent product overview brochure and case studies for retail clients.', old_value: null, new_value: null, created_at: d(-25) },
    { user_id: S.id, activity_type: 'meeting',      description: 'On-site visit to Fashion Hub Pune. Priya showed us their current manual process. Clear fit.', old_value: null, new_value: null, created_at: d(-18) },
    { user_id: S.id, activity_type: 'stage_change', description: 'Qualified after site visit. Perfect use case.', old_value: 'lead', new_value: 'qualified', created_at: d(-18) },
    { user_id: S.id, activity_type: 'stage_change', description: 'Proposal sent via email - detailed scope and pricing document.', old_value: 'qualified', new_value: 'proposal', created_at: d(-6) },
  ]);

  const d3 = await deal({
    title: 'Supply Chain Visibility Platform - Kerala Spices', client_id: c3.id, assigned_to: S.id, created_by: R.id,
    value: 175000, stage: 'qualified', temperature: 'warm', probability: 0.25,
    expected_close_date: d(40), last_contact_date: d(-17),
    last_contact_summary: 'Had intro meeting 17 days ago. Need to follow up on technical requirements doc.',
    close_date_change_count: 0,
  }, [
    { user_id: R.id,  activity_type: 'created',      description: 'Deal created - Kerala Spices export compliance need', old_value: null, new_value: 'Supply Chain Visibility Platform - Kerala Spices', created_at: d(-45) },
    { user_id: S.id,  activity_type: 'call',         description: 'Introduction call with Vikram. He liked our product but needs to discuss with his COO.', old_value: null, new_value: null, created_at: d(-40) },
    { user_id: S.id,  activity_type: 'meeting',      description: 'Introduction meeting at client office. Presented supply chain module. 3 people attended.', old_value: null, new_value: null, created_at: d(-17) },
    { user_id: S.id,  activity_type: 'stage_change', description: 'Qualified after meeting. They confirmed budget exists.', old_value: 'lead', new_value: 'qualified', created_at: d(-17) },
  ]);

  await deal({
    title: 'IT Infrastructure Upgrade - Bangalore IT', client_id: c4.id, assigned_to: S.id, created_by: S.id,
    value: 320000, stage: 'lead', temperature: 'cold', probability: 0.10,
    expected_close_date: d(75), last_contact_date: d(-32),
    last_contact_summary: 'Cold call - client not urgent. Exploring for next FY budget. Follow up in 6 weeks.',
    close_date_change_count: 0,
  }, [
    { user_id: S.id, activity_type: 'created', description: 'Lead added from industry conference networking', old_value: null, new_value: 'IT Infrastructure Upgrade - Bangalore IT', created_at: d(-45) },
    { user_id: S.id, activity_type: 'call',    description: 'Initial cold call. Deepa is interested but budget only from April next year. Long-term pipeline.', old_value: null, new_value: null, created_at: d(-32) },
  ]);

  const d5 = await deal({
    title: 'Pharma Compliance Suite - Hyderabad Pharma', client_id: c5.id, assigned_to: S.id, created_by: R.id,
    value: 195000, stage: 'closed_won', temperature: 'hot', probability: 1.0,
    expected_close_date: d(-5), last_contact_date: d(-5),
    last_contact_summary: 'CONTRACT SIGNED! Full implementation begins next month.',
    close_date_change_count: 0, notes: 'Successfully closed. Reference client for pharma vertical.',
  }, [
    { user_id: R.id, activity_type: 'created',            description: 'Strategic deal created by Rajesh - pharma vertical expansion', old_value: null, new_value: 'Pharma Compliance Suite - Hyderabad Pharma', created_at: d(-60) },
    { user_id: S.id, activity_type: 'call',               description: 'Discovery call. Urgent compliance deadline driving the need.', old_value: null, new_value: null, created_at: d(-55) },
    { user_id: S.id, activity_type: 'stage_change',       description: 'Qualified - budget confirmed ₹2L+', old_value: 'lead', new_value: 'qualified', created_at: d(-50) },
    { user_id: S.id, activity_type: 'meeting',            description: 'Technical walkthrough + compliance module demo. Client loved the audit trail feature.', old_value: null, new_value: null, created_at: d(-40) },
    { user_id: S.id, activity_type: 'stage_change',       description: 'Proposal accepted - value ₹1.95L', old_value: 'qualified', new_value: 'proposal', created_at: d(-30) },
    { user_id: S.id, activity_type: 'temperature_change', description: 'Marking HOT - client wants to close before quarter end.', old_value: 'warm', new_value: 'hot', created_at: d(-20) },
    { user_id: S.id, activity_type: 'stage_change',       description: 'Negotiation - minor contract adjustments', old_value: 'proposal', new_value: 'negotiation', created_at: d(-15) },
    { user_id: S.id, activity_type: 'stage_change',       description: 'DEAL WON! Contract signed. ₹1,95,000 deal closed.', old_value: 'negotiation', new_value: 'closed_won', created_at: d(-5) },
  ]);

  // --- SIDDHARTH'S DEALS ---
  const d6 = await deal({
    title: 'ERP Full Implementation - Delhi Enterprises', client_id: c6.id, assigned_to: SI.id, created_by: R.id,
    value: 580000, stage: 'proposal', temperature: 'hot', probability: 0.50,
    expected_close_date: d(-8), last_contact_date: d(-22),
    last_contact_summary: 'Client asked for revised proposal 22 days ago. No follow up done. CRITICAL DEAL AT RISK.',
    close_date_change_count: 2, notes: "Biggest deal in pipeline. Rajesh's account. Must close this quarter.",
  }, [
    { user_id: R.id,  activity_type: 'created',            description: 'Strategic deal created by Rajesh. Delhi Enterprises full ERP.', old_value: null, new_value: 'ERP Full Implementation - Delhi Enterprises', created_at: d(-90) },
    { user_id: SI.id, activity_type: 'call',               description: 'Initial discovery call with Ravi Kumar. Very positive. Large team of 300+ users.', old_value: null, new_value: null, created_at: d(-85) },
    { user_id: SI.id, activity_type: 'meeting',            description: 'Full-day workshop with client team. 8 people attended. Requirements documented.', old_value: null, new_value: null, created_at: d(-70) },
    { user_id: SI.id, activity_type: 'stage_change',       description: 'Qualified - budget ₹6L+ confirmed by CFO in meeting.', old_value: 'lead', new_value: 'qualified', created_at: d(-70) },
    { user_id: SI.id, activity_type: 'temperature_change', description: 'Marking HOT - client ready to move fast before financial year end.', old_value: 'warm', new_value: 'hot', created_at: d(-65) },
    { user_id: SI.id, activity_type: 'stage_change',       description: 'Initial proposal submitted ₹5.8L for full ERP implementation.', old_value: 'qualified', new_value: 'proposal', created_at: d(-55) },
    { user_id: SI.id, activity_type: 'close_date_change',  description: 'First close date was 55 days ago. Client asked for revised proposal. Pushed date.', old_value: d(-55).toISOString(), new_value: d(-20).toISOString(), created_at: d(-50) },
    { user_id: SI.id, activity_type: 'note',               description: 'Client requested detailed phased implementation plan and revised pricing.', old_value: null, new_value: null, created_at: d(-50) },
    { user_id: SI.id, activity_type: 'close_date_change',  description: 'Pushed date again - client management meeting delayed.', old_value: d(-20).toISOString(), new_value: d(-8).toISOString(), created_at: d(-30) },
    { user_id: SI.id, activity_type: 'email',              description: 'Sent revised proposal with phased implementation plan. Awaiting response.', old_value: null, new_value: null, created_at: d(-22) },
  ]);

  const d7 = await deal({
    title: 'Food Processing ERP - Punjab Foods', client_id: c7.id, assigned_to: SI.id, created_by: SI.id,
    value: 145000, stage: 'qualified', temperature: 'warm', probability: 0.25,
    expected_close_date: d(18), last_contact_date: d(-28),
    last_contact_summary: 'Met with Sunita 28 days ago. Need to get all 3 family members together for next meeting.',
    close_date_change_count: 1,
  }, [
    { user_id: SI.id, activity_type: 'created',           description: 'New lead from Punjab Foods referral', old_value: null, new_value: 'Food Processing ERP - Punjab Foods', created_at: d(-50) },
    { user_id: SI.id, activity_type: 'email',             description: 'Sent product brochure and case studies for food industry clients.', old_value: null, new_value: null, created_at: d(-45) },
    { user_id: SI.id, activity_type: 'meeting',           description: 'Met Sunita at her office. She liked the product but says 2 brothers also need to be convinced.', old_value: null, new_value: null, created_at: d(-40) },
    { user_id: SI.id, activity_type: 'stage_change',      description: 'Qualified after meeting. Budget ₹1.5L confirmed.', old_value: 'lead', new_value: 'qualified', created_at: d(-40) },
    { user_id: SI.id, activity_type: 'close_date_change', description: 'Original close pushed - waiting for family meeting to be arranged.', old_value: d(-10).toISOString(), new_value: d(18).toISOString(), created_at: d(-35) },
    { user_id: SI.id, activity_type: 'email',             description: 'Followed up on email. Requested a call to schedule family meeting.', old_value: null, new_value: null, created_at: d(-28) },
  ]);

  const d8 = await deal({
    title: 'Textile ERP - UP Textile Mills', client_id: c8.id, assigned_to: SI.id, created_by: SI.id,
    value: 95000, stage: 'lead', temperature: 'cold', probability: 0.10,
    expected_close_date: d(85), last_contact_date: d(-48),
    last_contact_summary: 'Very price sensitive. Currently evaluating 4 other vendors. Long sales cycle.',
    close_date_change_count: 0,
  }, [
    { user_id: SI.id, activity_type: 'created', description: 'Lead from trade exhibition in Lucknow', old_value: null, new_value: 'Textile ERP - UP Textile Mills', created_at: d(-55) },
    { user_id: SI.id, activity_type: 'call',    description: 'Discovery call. Arun mentioned they are comparing with SAP, Oracle, and 2 others. Budget is ₹80-100K.', old_value: null, new_value: null, created_at: d(-48) },
  ]);

  const d9 = await deal({
    title: 'HR Analytics Suite - HR Solutions Delhi', client_id: c9.id, assigned_to: SI.id, created_by: R.id,
    value: 210000, stage: 'negotiation', temperature: 'hot', probability: 0.75,
    expected_close_date: d(6), last_contact_date: d(-3),
    last_contact_summary: 'Final terms discussion ongoing. Neha wants 10% discount on implementation. Very close to signing.',
    close_date_change_count: 0, notes: 'Rajesh referred. Fast-growing HR tech company. Strong reference case if won.',
  }, [
    { user_id: R.id,  activity_type: 'created',            description: 'Strategic deal - Rajesh referred HR Solutions Delhi to Siddharth.', old_value: null, new_value: 'HR Analytics Suite - HR Solutions Delhi', created_at: d(-35) },
    { user_id: SI.id, activity_type: 'call',               description: 'Initial call with Neha. Company growing 3x YoY. Urgent HR analytics need.', old_value: null, new_value: null, created_at: d(-30) },
    { user_id: SI.id, activity_type: 'stage_change',       description: 'Qualified quickly - budget confirmed ₹2L+, decision in 30 days.', old_value: 'lead', new_value: 'qualified', created_at: d(-28) },
    { user_id: SI.id, activity_type: 'meeting',            description: 'Full demo with leadership team. CEO, HR Head, CTO all attended. Unanimous positive response.', old_value: null, new_value: null, created_at: d(-20) },
    { user_id: SI.id, activity_type: 'temperature_change', description: 'HOT - They want to go live before their next headcount addition.', old_value: 'warm', new_value: 'hot', created_at: d(-18) },
    { user_id: SI.id, activity_type: 'stage_change',       description: 'Proposal presented in meeting itself and accepted on the spot.', old_value: 'qualified', new_value: 'proposal', created_at: d(-15) },
    { user_id: SI.id, activity_type: 'stage_change',       description: 'Moved to negotiation - price and implementation timeline being finalized.', old_value: 'proposal', new_value: 'negotiation', created_at: d(-10) },
    { user_id: SI.id, activity_type: 'call',               description: 'Negotiation call. Asking for 10% discount on ₹45K implementation fee. Awaiting Rajesh approval.', old_value: null, new_value: null, created_at: d(-3) },
  ]);

  await deal({
    title: 'Mineral Export Solution - Rajasthan Minerals', client_id: c10.id, assigned_to: SI.id, created_by: SI.id,
    value: 67000, stage: 'lead', temperature: 'cold', probability: 0.10,
    expected_close_date: null, last_contact_date: d(-65),
    last_contact_summary: 'First contact only. No follow up done. Expected close date never set.',
    close_date_change_count: 0,
  }, [
    { user_id: SI.id, activity_type: 'created', description: 'Added from contact at Jaipur business summit.', old_value: null, new_value: 'Mineral Export Solution - Rajasthan Minerals', created_at: d(-68) },
    { user_id: SI.id, activity_type: 'call',    description: 'Brief call at summit. Manish said will connect properly after Diwali.', old_value: null, new_value: null, created_at: d(-65) },
  ]);

  // Tasks
  await prisma.tasks.createMany({ data: [
    { title: 'Call Ravi Kumar — ERP deal OVERDUE close date',   description: `Ravi Kumar (Delhi Enterprises) has not been contacted in 22 days. Expected close date was ${d(-8).toISOString().split('T')[0]}. Call immediately and update status.`, created_by: R.id, assigned_to: SI.id, deal_id: d6.id, due_date: d(-3), priority: 'urgent', status: 'overdue' },
    { title: 'Send revised proposal to Ravi Kumar',              description: 'Include phased 18-month implementation roadmap and revised pricing. Director approval obtained for up to 8% discount.',                                                  created_by: R.id, assigned_to: SI.id, deal_id: d6.id, due_date: d(1),  priority: 'urgent', status: 'pending' },
    { title: 'Arrange Punjab Foods family meeting',              description: 'Get all 3 family members (Sunita + 2 brothers) on a call. Try video conference. Cannot keep delaying this.',                                                              created_by: R.id, assigned_to: SI.id, deal_id: d7.id, due_date: d(2),  priority: 'high',   status: 'pending' },
    { title: 'Follow up UP Textile Mills',                       description: 'Arun Gupta has not been contacted in 48 days. Either qualify or mark cold. Get a clear answer on their vendor selection timeline.',                                          created_by: R.id, assigned_to: SI.id, deal_id: d8.id, due_date: d(3),  priority: 'medium', status: 'pending' },
    { title: 'Set expected close date for Rajasthan Minerals',   description: 'Mineral Export deal has NO expected close date set. This is mandatory. Either get commitment or remove from pipeline.',                                                      created_by: R.id, assigned_to: SI.id, deal_id: null,  due_date: d(1),  priority: 'high',   status: 'pending' },
    { title: 'Get final answer on TechCorp negotiation',         description: 'Amit Sharma promised to revert in 2 days on 12% discount counter-offer. Follow up now.',                                                                                    created_by: R.id, assigned_to: S.id,  deal_id: d1.id, due_date: d(1),  priority: 'high',   status: 'pending' },
    { title: 'Follow up Priya Mehta — proposal review',         description: 'Fashion Hub proposal sent 6 days ago. Priya was reviewing with CA. Time to follow up and address any concerns.',                                                              created_by: R.id, assigned_to: S.id,  deal_id: d2.id, due_date: d(2),  priority: 'medium', status: 'pending' },
    { title: 'Contact Kerala Spices for requirements doc',       description: 'Vikram Nair was supposed to send technical requirements doc 2 weeks ago. Follow up urgently. Deal is going stale.',                                                          created_by: R.id, assigned_to: S.id,  deal_id: d3.id, due_date: d(1),  priority: 'high',   status: 'pending' },
    { title: 'Q3 target review call with Rajesh',               description: 'Monthly performance review. Prepare pipeline summary and deal status update.',                                                                                                created_by: R.id, assigned_to: S.id,  deal_id: null,  due_date: d(5),  priority: 'medium', status: 'pending' },
  ]});

  // Messages
  await prisma.messages.createMany({ data: [
    { sender_id: R.id, recipient_id: SI.id, subject: '🚨 URGENT: Delhi Enterprises ERP — 22 days no contact',  content: `Siddharth,\n\nThis is our biggest deal — ₹5.8L ERP with Delhi Enterprises. The expected close date was ${d(-8).toISOString().split('T')[0]} and has ALREADY PASSED. You have not contacted Ravi Kumar in 22 days.\n\nThis is not acceptable. I need:\n1. A call with Ravi Kumar TODAY\n2. Full status update by tomorrow EOD\n3. Revised close date with commitment\n\nIf we lose this deal due to no follow-up, I will need to reassign all Ravi Kumar accounts.\n\n- Rajesh`, deal_id: d6.id },
    { sender_id: R.id, recipient_id: S.id,  subject: 'TechCorp negotiation — your call on discount',            content: `Sunil,\n\nGood progress on TechCorp. On the discount question — we can go up to 12% but NOT 15%. I already approved this verbally. Go ahead and close it.\n\nTarget close date: ${d(12).toISOString().split('T')[0]}. Do not push further.\n\n- Rajesh`, deal_id: d1.id },
    { sender_id: SI.id, recipient_id: R.id, subject: 'HR Analytics — discount approval needed',                  content: 'Rajesh sir,\n\nNeha from HR Solutions Delhi is READY TO SIGN. She is only asking for 10% discount on the implementation fee (₹45K → ₹40.5K). Total deal value remains ₹2.1L.\n\nCan you approve this? She wants to sign before month end. We should not lose this one.\n\n- Siddharth', deal_id: d9.id },
    { sender_id: S.id,  recipient_id: R.id, subject: 'TechCorp Update — Counter accepted!',                      content: `Rajesh sir,\n\nJust got off the call with Amit. He has AGREED to 12% discount. I am preparing the final agreement. Will send for signature by tomorrow.\n\nExpect to close by ${d(5).toISOString().split('T')[0]}.\n\n- Sunil`, deal_id: d1.id },
    { sender_id: R.id, recipient_id: SI.id, subject: 'Punjab Foods — this cannot wait any longer',               content: 'Siddharth,\n\nPunjab Foods deal has been stale for 28 days. You cannot keep waiting for Sunita to "arrange a meeting". Take initiative:\n1. Call Sunita directly\n2. Offer to come to Chandigarh for an in-person meeting with the whole family\n3. Give them a 7-day deadline — either they are serious or we move on\n\n- Rajesh', deal_id: d7.id },
  ]});

  // Targets (current month)
  const now = new Date();
  await prisma.targets.createMany({ data: [
    { user_id: S.id,  month: now.getMonth() + 1, year: now.getFullYear(), revenue_target: 600000, deal_count_target: 3, created_by: R.id },
    { user_id: SI.id, month: now.getMonth() + 1, year: now.getFullYear(), revenue_target: 900000, deal_count_target: 4, created_by: R.id },
  ]});

  console.log('[seed] Done.');
}
