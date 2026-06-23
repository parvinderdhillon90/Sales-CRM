import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { runMigrations } from './migrate';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'crm.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');

    // Run any pending migrations before anything else touches the schema
    runMigrations(_db);

    // Seed demo data on first run (no users present yet)
    const empty = (_db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c === 0;
    if (empty) seedData(_db);
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function d(offset: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Seed data — only runs once on a fresh database
// ---------------------------------------------------------------------------

function seedData(db: Database.Database) {
  const insertUser = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, zone) VALUES (?, ?, ?, ?, ?)`
  );
  const insertClient = db.prepare(
    `INSERT INTO clients (name, company, phone, email, address, zone, assigned_to, created_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertDeal = db.prepare(
    `INSERT INTO deals (title, client_id, assigned_to, created_by, value, stage, temperature,
       expected_close_date, last_contact_date, last_contact_summary, close_date_change_count, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertActivity = db.prepare(
    `INSERT INTO deal_activities (deal_id, user_id, activity_type, description, old_value, new_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertTask = db.prepare(
    `INSERT INTO tasks (title, description, created_by, assigned_to, deal_id, due_date, priority, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertMsg = db.prepare(
    `INSERT INTO messages (sender_id, recipient_id, subject, content, deal_id) VALUES (?, ?, ?, ?, ?)`
  );
  const insertTarget = db.prepare(
    `INSERT INTO targets (user_id, month, year, revenue_target, deal_count_target, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const seed = db.transaction(() => {
    // --- USERS ---
    const rajesh = insertUser.run('Rajesh', 'rajesh@salescrm.com', bcrypt.hashSync('Director@123', 10), 'director', null);
    const sunil  = insertUser.run('Sunil Balan', 'sunil@salescrm.com', bcrypt.hashSync('Sunil@123', 10), 'manager', 'south_west');
    const sid    = insertUser.run('Siddharth Asija', 'siddharth@salescrm.com', bcrypt.hashSync('Siddharth@123', 10), 'manager', 'north');
    const R  = rajesh.lastInsertRowid as number;
    const S  = sunil.lastInsertRowid  as number;
    const SI = sid.lastInsertRowid    as number;

    // --- SOUTH & WEST CLIENTS (Sunil) ---
    const c1 = insertClient.run('Amit Sharma',   'TechCorp Mumbai',          '9876543210', 'amit@techcorp.com',    'Mumbai, Maharashtra',    'south_west', S,  R,  'Key decision maker. Referred by industry contact. Very serious buyer.');
    const c2 = insertClient.run('Priya Mehta',   'Fashion Hub Pune',         '9876543211', 'priya@fashionhub.com', 'Pune, Maharashtra',      'south_west', S,  S,  'Mid-size retailer. Budget under pressure but expanding.');
    const c3 = insertClient.run('Vikram Nair',   'Kerala Spices Export Ltd', '9876543212', 'vikram@keralaspices.com', 'Kochi, Kerala',        'south_west', S,  R,  'Export business. Needs supply chain visibility. Multiple stakeholders.');
    const c4 = insertClient.run('Deepa Iyer',    'Bangalore IT Solutions',   '9876543213', 'deepa@bangaloreit.com','Bangalore, Karnataka',   'south_west', S,  S,  'IT services company. Long sales cycle expected.');
    const c5 = insertClient.run('Mohan Rao',     'Hyderabad Pharma Ltd',     '9876543219', 'mohan@hydpharma.com',  'Hyderabad, Telangana',   'south_west', S,  R,  'Pharma compliance & reporting needs. Urgent requirement.');
    const C1 = c1.lastInsertRowid as number; const C2 = c2.lastInsertRowid as number;
    const C3 = c3.lastInsertRowid as number; const C4 = c4.lastInsertRowid as number;
    const C5 = c5.lastInsertRowid as number;

    // --- NORTH CLIENTS (Siddharth) ---
    const c6  = insertClient.run('Ravi Kumar',      'Delhi Enterprises Pvt Ltd',  '9876543214', 'ravi@delhient.com',     'New Delhi',             'north', SI, R,  'Large enterprise. CFO and CEO both involved in decision. High value deal.');
    const c7  = insertClient.run('Sunita Verma',    'Punjab Foods & Beverages',   '9876543215', 'sunita@punjabfoods.com','Chandigarh, Punjab',    'north', SI, SI, 'Family-run business. 3 family members must approve. Very slow decision making.');
    const c8  = insertClient.run('Arun Gupta',      'UP Textile Mills',           '9876543216', 'arun@uptextile.com',    'Lucknow, UP',           'north', SI, SI, 'Very price sensitive. Comparing with 4 competitors. Negotiate carefully.');
    const c9  = insertClient.run('Neha Srivastava', 'HR Solutions Delhi',         '9876543217', 'neha@hrsolutions.com',  'Noida, UP',             'north', SI, R,  'High-growth startup. Expanding rapidly. Very hot lead. Rajesh referred.');
    const c10 = insertClient.run('Manish Tiwari',   'Rajasthan Minerals Corp',    '9876543218', 'manish@rajminerals.com','Jaipur, Rajasthan',     'north', SI, SI, 'Mining company. Initial contact only. Very early stage.');
    const C6  = c6.lastInsertRowid  as number; const C7  = c7.lastInsertRowid  as number;
    const C8  = c8.lastInsertRowid  as number; const C9  = c9.lastInsertRowid  as number;
    const C10 = c10.lastInsertRowid as number;

    // =====================================================================
    // SUNIL'S DEALS
    // =====================================================================

    const d1 = insertDeal.run('Enterprise Software License - TechCorp', C1, S, R, 250000, 'negotiation', 'hot', d(12), d(-2), 'Discussed pricing. They want 15% discount. Sent counter at 12%. Decision expected next week.', 1, 'Deal initiated by Rajesh. Key enterprise account.');
    const D1 = d1.lastInsertRowid as number;
    insertActivity.run(D1, R,  'created',           'Deal created and assigned to Sunil',                                                                          null,    'Enterprise Software License - TechCorp', d(-45));
    insertActivity.run(D1, S,  'call',              'Initial discovery call with Amit Sharma. Client very interested in enterprise package. 250+ users.',           null,    null,       d(-40));
    insertActivity.run(D1, S,  'stage_change',      'Qualified after thorough discovery call. Budget confirmed at ₹2.5L+',                                          'lead',  'qualified', d(-35));
    insertActivity.run(D1, S,  'meeting',           'Full product demo at client office. Entire IT team present. Very positive response. Amit loved the reporting module.', null, null, d(-28));
    insertActivity.run(D1, S,  'stage_change',      'Proposal submitted with detailed pricing and 3-year roadmap.',                                                  'qualified', 'proposal',     d(-20));
    insertActivity.run(D1, S,  'stage_change',      'Moved to negotiation. Client wants 15% discount on license fee.',                                               'proposal',  'negotiation',  d(-10));
    insertActivity.run(D1, S,  'close_date_change', 'Original close date was 15 days ago. Pushed due to client internal approvals.',                                 d(-15),  d(12),      d(-8));
    insertActivity.run(D1, S,  'call',              'Negotiation call. Offered 12% discount + free first year support. They will revert in 2 days.',                null,    null,       d(-2));

    const d2 = insertDeal.run('Retail Management System - Fashion Hub', C2, S, S, 85000, 'proposal', 'warm', d(28), d(-6), 'Sent detailed proposal. Priya is reviewing with her CA. Should respond by end of week.', 0, null);
    const D2 = d2.lastInsertRowid as number;
    insertActivity.run(D2, S, 'created',       'New deal created - Fashion Hub retail management requirement',                            null,         'Retail Management System - Fashion Hub', d(-30));
    insertActivity.run(D2, S, 'email',         'Sent product overview brochure and case studies for retail clients.',                     null,         null,       d(-25));
    insertActivity.run(D2, S, 'meeting',       'On-site visit to Fashion Hub Pune. Priya showed us their current manual process. Clear fit.', null,     null,       d(-18));
    insertActivity.run(D2, S, 'stage_change',  'Qualified after site visit. Perfect use case.',                                           'lead',       'qualified', d(-18));
    insertActivity.run(D2, S, 'stage_change',  'Proposal sent via email - detailed scope and pricing document.',                          'qualified',  'proposal',  d(-6));

    const d3 = insertDeal.run('Supply Chain Visibility Platform - Kerala Spices', C3, S, R, 175000, 'qualified', 'warm', d(40), d(-17), 'Had intro meeting 17 days ago. Need to follow up on technical requirements doc they were supposed to send.', 0, null);
    const D3 = d3.lastInsertRowid as number;
    insertActivity.run(D3, R, 'created',      'Deal created - Kerala Spices export compliance need',                              null, 'Supply Chain Visibility Platform - Kerala Spices', d(-45));
    insertActivity.run(D3, S, 'call',         'Introduction call with Vikram. He liked our product but needs to discuss with his COO.', null, null, d(-40));
    insertActivity.run(D3, S, 'meeting',      'Introduction meeting at client office. Presented supply chain module. 3 people attended.', null, null, d(-17));
    insertActivity.run(D3, S, 'stage_change', 'Qualified after meeting. They confirmed budget exists.',                           'lead', 'qualified', d(-17));

    const d4 = insertDeal.run('IT Infrastructure Upgrade - Bangalore IT', C4, S, S, 320000, 'lead', 'cold', d(75), d(-32), 'Cold call - client not urgent. Exploring for next FY budget. Follow up in 6 weeks.', 0, null);
    const D4 = d4.lastInsertRowid as number;
    insertActivity.run(D4, S, 'created', 'Lead added from industry conference networking',                                               null, 'IT Infrastructure Upgrade - Bangalore IT', d(-45));
    insertActivity.run(D4, S, 'call',    'Initial cold call. Deepa is interested but budget only from April next year. Long-term pipeline.', null, null, d(-32));

    const d5 = insertDeal.run('Pharma Compliance Suite - Hyderabad Pharma', C5, S, R, 195000, 'closed_won', 'hot', d(-5), d(-5), 'CONTRACT SIGNED! Full implementation begins next month.', 0, 'Successfully closed. Reference client for pharma vertical.');
    const D5 = d5.lastInsertRowid as number;
    insertActivity.run(D5, R, 'created',             'Strategic deal created by Rajesh - pharma vertical expansion',                       null,          'Pharma Compliance Suite - Hyderabad Pharma', d(-60));
    insertActivity.run(D5, S, 'call',                'Discovery call. Urgent compliance deadline driving the need.',                        null,          null,          d(-55));
    insertActivity.run(D5, S, 'stage_change',        'Qualified - budget confirmed ₹2L+',                                                  'lead',        'qualified',   d(-50));
    insertActivity.run(D5, S, 'meeting',             'Technical walkthrough + compliance module demo. Client loved the audit trail feature.', null,         null,          d(-40));
    insertActivity.run(D5, S, 'stage_change',        'Proposal accepted - value ₹1.95L',                                                   'qualified',   'proposal',    d(-30));
    insertActivity.run(D5, S, 'temperature_change',  'Marking HOT - client wants to close before quarter end.',                            'warm',        'hot',         d(-20));
    insertActivity.run(D5, S, 'stage_change',        'Negotiation - minor contract adjustments',                                           'proposal',    'negotiation', d(-15));
    insertActivity.run(D5, S, 'stage_change',        'DEAL WON! Contract signed. ₹1,95,000 deal closed.',                                 'negotiation', 'closed_won',  d(-5));

    // =====================================================================
    // SIDDHARTH'S DEALS — showing real problems
    // =====================================================================

    const d6 = insertDeal.run('ERP Full Implementation - Delhi Enterprises', C6, SI, R, 580000, 'proposal', 'hot', d(-8), d(-22), 'Client asked for revised proposal 22 days ago. No follow up done. CRITICAL DEAL AT RISK.', 2, "Biggest deal in pipeline. Rajesh's account. Must close this quarter.");
    const D6 = d6.lastInsertRowid as number;
    insertActivity.run(D6, R,  'created',           'Strategic deal created by Rajesh. Delhi Enterprises full ERP.',                       null,    'ERP Full Implementation - Delhi Enterprises', d(-90));
    insertActivity.run(D6, SI, 'call',              'Initial discovery call with Ravi Kumar. Very positive. Large team of 300+ users.',    null,    null,       d(-85));
    insertActivity.run(D6, SI, 'meeting',           'Full-day workshop with client team. 8 people attended. Requirements documented.',     null,    null,       d(-70));
    insertActivity.run(D6, SI, 'stage_change',      'Qualified - budget ₹6L+ confirmed by CFO in meeting.',                               'lead',  'qualified', d(-70));
    insertActivity.run(D6, SI, 'temperature_change','Marking HOT - client ready to move fast before financial year end.',                  'warm',  'hot',       d(-65));
    insertActivity.run(D6, SI, 'stage_change',      'Initial proposal submitted ₹5.8L for full ERP implementation.',                      'qualified', 'proposal', d(-55));
    insertActivity.run(D6, SI, 'close_date_change', 'First close date was 55 days ago. Client asked for revised proposal. Pushed date.',  d(-55),  d(-20),     d(-50));
    insertActivity.run(D6, SI, 'note',              'Client requested detailed phased implementation plan and revised pricing.',           null,    null,       d(-50));
    insertActivity.run(D6, SI, 'close_date_change', 'Pushed date again - client management meeting delayed.',                             d(-20),  d(-8),      d(-30));
    insertActivity.run(D6, SI, 'email',             'Sent revised proposal with phased implementation plan. Awaiting response.',          null,    null,       d(-22));

    const d7 = insertDeal.run('Food Processing ERP - Punjab Foods', C7, SI, SI, 145000, 'qualified', 'warm', d(18), d(-28), 'Met with Sunita 28 days ago. Need to get all 3 family members together for next meeting. No response to 2 follow-up emails.', 1, null);
    const D7 = d7.lastInsertRowid as number;
    insertActivity.run(D7, SI, 'created',          'New lead from Punjab Foods referral',                                                  null,        'Food Processing ERP - Punjab Foods', d(-50));
    insertActivity.run(D7, SI, 'email',            'Sent product brochure and case studies for food industry clients.',                    null,        null,       d(-45));
    insertActivity.run(D7, SI, 'meeting',          'Met Sunita at her office. She liked the product but says 2 brothers also need to be convinced.', null, null, d(-40));
    insertActivity.run(D7, SI, 'stage_change',     'Qualified after meeting. Budget ₹1.5L confirmed.',                                    'lead',      'qualified', d(-40));
    insertActivity.run(D7, SI, 'close_date_change','Original close pushed - waiting for family meeting to be arranged.',                   d(-10),      d(18),      d(-35));
    insertActivity.run(D7, SI, 'email',            'Followed up on email. Requested a call to schedule family meeting.',                   null,        null,       d(-28));

    const d8 = insertDeal.run('Textile ERP - UP Textile Mills', C8, SI, SI, 95000, 'lead', 'cold', d(85), d(-48), 'Very price sensitive. Currently evaluating 4 other vendors. Long sales cycle.', 0, null);
    const D8 = d8.lastInsertRowid as number;
    insertActivity.run(D8, SI, 'created', 'Lead from trade exhibition in Lucknow',                                                        null, 'Textile ERP - UP Textile Mills', d(-55));
    insertActivity.run(D8, SI, 'call',    'Discovery call. Arun mentioned they are comparing with SAP, Oracle, and 2 others. Budget is ₹80-100K.', null, null, d(-48));

    const d9 = insertDeal.run('HR Analytics Suite - HR Solutions Delhi', C9, SI, R, 210000, 'negotiation', 'hot', d(6), d(-3), 'Final terms discussion ongoing. Neha wants 10% discount on implementation. Very close to signing.', 0, 'Rajesh referred. Fast-growing HR tech company. Strong reference case if won.');
    const D9 = d9.lastInsertRowid as number;
    insertActivity.run(D9, R,  'created',           'Strategic deal - Rajesh referred HR Solutions Delhi to Siddharth.',                   null,          'HR Analytics Suite - HR Solutions Delhi', d(-35));
    insertActivity.run(D9, SI, 'call',              'Initial call with Neha. Company growing 3x YoY. Urgent HR analytics need.',          null,          null,          d(-30));
    insertActivity.run(D9, SI, 'stage_change',      'Qualified quickly - budget confirmed ₹2L+, decision in 30 days.',                   'lead',        'qualified',   d(-28));
    insertActivity.run(D9, SI, 'meeting',           'Full demo with leadership team. CEO, HR Head, CTO all attended. Unanimous positive response.', null, null,         d(-20));
    insertActivity.run(D9, SI, 'temperature_change','HOT - They want to go live before their next headcount addition.',                    'warm',        'hot',         d(-18));
    insertActivity.run(D9, SI, 'stage_change',      'Proposal presented in meeting itself and accepted on the spot.',                      'qualified',   'proposal',    d(-15));
    insertActivity.run(D9, SI, 'stage_change',      'Moved to negotiation - price and implementation timeline being finalized.',           'proposal',    'negotiation', d(-10));
    insertActivity.run(D9, SI, 'call',              'Negotiation call. Asking for 10% discount on ₹45K implementation fee. Awaiting Rajesh approval.', null, null, d(-3));

    const d10 = insertDeal.run('Mineral Export Solution - Rajasthan Minerals', C10, SI, SI, 67000, 'lead', 'cold', null, d(-65), 'First contact only. No follow up done. Expected close date never set.', 0, null);
    const D10 = d10.lastInsertRowid as number;
    insertActivity.run(D10, SI, 'created', 'Added from contact at Jaipur business summit.',                                               null, 'Mineral Export Solution - Rajasthan Minerals', d(-68));
    insertActivity.run(D10, SI, 'call',    'Brief call at summit. Manish said will connect properly after Diwali.',                       null, null, d(-65));

    // =====================================================================
    // TASKS
    // =====================================================================

    insertTask.run('Call Ravi Kumar — ERP deal OVERDUE close date',   'Ravi Kumar (Delhi Enterprises) has not been contacted in 22 days. Expected close date was ' + d(-8) + '. Call immediately and update status.', R,    SI, D6,  d(-3), 'urgent', 'overdue');
    insertTask.run('Send revised proposal to Ravi Kumar',              'Include phased 18-month implementation roadmap and revised pricing. Director approval obtained for up to 8% discount.',                         R,    SI, D6,  d(1),  'urgent', 'pending');
    insertTask.run('Arrange Punjab Foods family meeting',              'Get all 3 family members (Sunita + 2 brothers) on a call. Try video conference. Cannot keep delaying this.',                                   R,    SI, D7,  d(2),  'high',   'pending');
    insertTask.run('Follow up UP Textile Mills',                       'Arun Gupta has not been contacted in 48 days. Either qualify or mark cold. Get a clear answer on their vendor selection timeline.',            null, SI, D8,  d(3),  'medium', 'pending');
    insertTask.run('Set expected close date for Rajasthan Minerals',   'Mineral Export deal has NO expected close date set. This is mandatory. Either get commitment or remove from pipeline.',                         R,    SI, D10, d(1),  'high',   'pending');
    insertTask.run('Get final answer on TechCorp negotiation',         'Amit Sharma promised to revert in 2 days on 12% discount counter-offer. Follow up now.',                                                       R,    S,  D1,  d(1),  'high',   'pending');
    insertTask.run('Follow up Priya Mehta — proposal review',         'Fashion Hub proposal sent 6 days ago. Priya was reviewing with CA. Time to follow up and address any concerns.',                               null, S,  D2,  d(2),  'medium', 'pending');
    insertTask.run('Contact Kerala Spices for requirements doc',       'Vikram Nair was supposed to send technical requirements doc 2 weeks ago. Follow up urgently. Deal is going stale.',                            null, S,  D3,  d(1),  'high',   'pending');
    insertTask.run('Q3 target review call with Rajesh',               'Monthly performance review. Prepare pipeline summary and deal status update.',                                                                   R,    S,  null, d(5),  'medium', 'pending');

    // =====================================================================
    // MESSAGES
    // =====================================================================

    insertMsg.run(R,  SI, '🚨 URGENT: Delhi Enterprises ERP — 22 days no contact',
      'Siddharth,\n\nThis is our biggest deal — ₹5.8L ERP with Delhi Enterprises. The expected close date was ' + d(-8) + ' and has ALREADY PASSED. You have not contacted Ravi Kumar in 22 days.\n\nThis is not acceptable. I need:\n1. A call with Ravi Kumar TODAY\n2. Full status update by tomorrow EOD\n3. Revised close date with commitment\n\nIf we lose this deal due to no follow-up, I will need to reassign all Ravi Kumar accounts.\n\n- Rajesh', D6);
    insertMsg.run(R,  S,  'TechCorp negotiation — your call on discount',
      'Sunil,\n\nGood progress on TechCorp. On the discount question — we can go up to 12% but NOT 15%. I already approved this verbally. Go ahead and close it.\n\nTarget close date: ' + d(12) + '. Do not push further.\n\n- Rajesh', D1);
    insertMsg.run(SI, R,  'HR Analytics — discount approval needed',
      'Rajesh sir,\n\nNeha from HR Solutions Delhi is READY TO SIGN. She is only asking for 10% discount on the implementation fee (₹45K → ₹40.5K). Total deal value remains ₹2.1L.\n\nCan you approve this? She wants to sign before month end. We should not lose this one.\n\n- Siddharth', D9);
    insertMsg.run(S,  R,  'TechCorp Update — Counter accepted!',
      'Rajesh sir,\n\nJust got off the call with Amit. He has AGREED to 12% discount. I am preparing the final agreement. Will send for signature by tomorrow.\n\nExpect to close by ' + d(5) + '.\n\n- Sunil', D1);
    insertMsg.run(R,  SI, 'Punjab Foods — this cannot wait any longer',
      'Siddharth,\n\nPunjab Foods deal has been stale for 28 days. You cannot keep waiting for Sunita to "arrange a meeting". Take initiative:\n1. Call Sunita directly\n2. Offer to come to Chandigarh for an in-person meeting with the whole family\n3. Give them a 7-day deadline — either they are serious or we move on\n\n- Rajesh', D7);

    // =====================================================================
    // TARGETS (current month)
    // =====================================================================

    const now = new Date();
    insertTarget.run(S,  now.getMonth() + 1, now.getFullYear(), 600000, 3, R);
    insertTarget.run(SI, now.getMonth() + 1, now.getFullYear(), 900000, 4, R);
  });

  seed();
}
