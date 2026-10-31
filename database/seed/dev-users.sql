-- LOCAL TESTING ONLY. Never run this against a real database.
-- Sign in with the email; the one-time code is written to the dev outbox (GET /dev/outbox).
INSERT OR IGNORE INTO users (id, name, email, phone, role, committee_id, created_at) VALUES
 ('u-convenor',  'Anika Rao',      'convenor@dastaan.test',  '+91 90000 00001', 'convenor', NULL,            strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-convenor2', 'Rohan Iyer',     'convenor2@dastaan.test', '+91 90000 00002', 'convenor', NULL,            strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-lead-ev',   'Meera Nair',     'events.lead@dastaan.test',  '+91 90000 00011', 'lead',  'cmt-events',    strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-lead-md',   'Karan Shah',     'media.lead@dastaan.test',   '+91 90000 00012', 'lead',  'cmt-media',     strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-lead-mk',   'Divya Menon',    'marketing.lead@dastaan.test','+91 90000 00013','lead',  'cmt-marketing', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-mem-ev1',   'Arjun Pillai',   'events.m1@dastaan.test',    '+91 90000 00021', 'member','cmt-events',    strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-mem-ev2',   'Sana Khan',      'events.m2@dastaan.test',    '+91 90000 00022', 'member','cmt-events',    strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-mem-md1',   'Vikram Das',     'media.m1@dastaan.test',     '+91 90000 00023', 'member','cmt-media',     strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-mem-md2',   'Isha Gupta',     'media.m2@dastaan.test',     '+91 90000 00024', 'member','cmt-media',     strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-mem-mk1',   'Neel Joshi',     'marketing.m1@dastaan.test', '+91 90000 00025', 'member','cmt-marketing', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-lead-sp',   'Priya Nambiar',  'sponsorship.lead@dastaan.test',    '+91 90000 00014', 'lead',  'cmt-sponsorship',    strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-lead-op',   'Rahul Verma',    'operations.lead@dastaan.test',     '+91 90000 00015', 'lead',  'cmt-operations',     strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-lead-ad',   'Fatima Sheikh',  'administration.lead@dastaan.test', '+91 90000 00016', 'lead',  'cmt-administration', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-mem-sp1',   'Dev Malhotra',   'sponsorship.m1@dastaan.test',      '+91 90000 00026', 'member','cmt-sponsorship',    strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-mem-op1',   'Lakshmi Rao',    'operations.m1@dastaan.test',       '+91 90000 00027', 'member','cmt-operations',     strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('u-mem-ad1',   'Samir Qureshi',  'administration.m1@dastaan.test',   '+91 90000 00028', 'member','cmt-administration', strftime('%Y-%m-%dT%H:%M:%fZ','now'));

UPDATE users SET sub_committee = CASE id
  WHEN 'u-mem-ev1' THEN 'Technical Events' WHEN 'u-mem-ev2' THEN 'Pro-show'
  WHEN 'u-mem-md1' THEN 'Photography' WHEN 'u-mem-md2' THEN 'Videography'
  WHEN 'u-mem-mk1' THEN 'PR' WHEN 'u-mem-sp1' THEN 'Food and Beverages'
  WHEN 'u-mem-op1' THEN 'Logistics' WHEN 'u-mem-ad1' THEN 'Documentation' END
 WHERE role = 'member';
