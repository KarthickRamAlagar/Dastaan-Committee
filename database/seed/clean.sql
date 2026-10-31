-- CLEAN START (local testing only): removes every person, request, file record, email, notification and log,
-- then puts back just the six committees and their sub-committees (the final Dastaan 2027 list). The Admin account is created again automatically when the Admin signs in.
-- Never run this against the real (remote) database.
DELETE FROM dev_outbox; DELETE FROM audit_log; DELETE FROM support_requests; DELETE FROM committee_grants;
DELETE FROM mail_log; DELETE FROM notifications; DELETE FROM ticket_events; DELETE FROM ticket_comments;
DELETE FROM file_chunks; DELETE FROM attachments; DELETE FROM ticket_hops; DELETE FROM tickets; DELETE FROM otps; DELETE FROM sessions;
DELETE FROM rate_limits; DELETE FROM users; DELETE FROM sub_committees; DELETE FROM committees;

INSERT INTO committees (id, name, description, color, icon, sort_order, created_at) VALUES
 ('cmt-events',         'Events',         'Plans and runs every event on the programme',    '#f59e0b', 'events',         1, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('cmt-media',          'Media',          'Photography, video and social media coverage',   '#ec4899', 'media',          2, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('cmt-marketing',      'Marketing',      'Posters, promotion and outreach',                '#8b5cf6', 'marketing',      3, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('cmt-sponsorship',    'Sponsorship',    'Sponsors, partners and finance liaison',         '#84cc16', 'sponsorship',    4, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('cmt-operations',     'Operations',     'Venues, setup and on-ground coordination',       '#10b981', 'operations',     5, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('cmt-administration', 'Administration', 'Permissions, records and official coordination', '#3b82f6', 'administration', 6, strftime('%Y-%m-%dT%H:%M:%fZ','now'));

-- Sub-committees from the final Dastaan 2027 list. Members and assigned work always belong to one of these.
INSERT INTO sub_committees (id, committee_id, name, sort_order) VALUES
 ('sub-events-1', 'cmt-events', 'Technical Events', 1),
 ('sub-events-2', 'cmt-events', 'Non-Technical Events', 2),
 ('sub-events-3', 'cmt-events', 'Management', 3),
 ('sub-events-4', 'cmt-events', 'Pro-show', 4),
 ('sub-events-5', 'cmt-events', 'Sports', 5),
 ('sub-events-6', 'cmt-events', 'Pre-events', 6),
 ('sub-media-1', 'cmt-media', 'Videography', 1),
 ('sub-media-2', 'cmt-media', 'Photography', 2),
 ('sub-media-3', 'cmt-media', 'Certificates', 3),
 ('sub-media-4', 'cmt-media', 'Social media Content', 4),
 ('sub-media-5', 'cmt-media', 'Editing', 5),
 ('sub-media-6', 'cmt-media', 'Website', 6),
 ('sub-marketing-1', 'cmt-marketing', 'PR', 1),
 ('sub-marketing-2', 'cmt-marketing', 'Marketing', 2),
 ('sub-marketing-3', 'cmt-marketing', 'Social Forum', 3),
 ('sub-marketing-4', 'cmt-marketing', 'Help desk', 4),
 ('sub-marketing-5', 'cmt-marketing', 'Registrations', 5),
 ('sub-sponsorship-1', 'cmt-sponsorship', 'Sponsorship', 1),
 ('sub-sponsorship-2', 'cmt-sponsorship', 'Food and Beverages', 2),
 ('sub-sponsorship-3', 'cmt-sponsorship', 'Alumni Relations', 3),
 ('sub-operations-1', 'cmt-operations', 'Logistics', 1),
 ('sub-operations-2', 'cmt-operations', 'Technical Requirement/ICTS', 2),
 ('sub-operations-3', 'cmt-operations', 'Venue', 3),
 ('sub-operations-4', 'cmt-operations', 'Security', 4),
 ('sub-operations-5', 'cmt-operations', 'Decor', 5),
 ('sub-administration-1', 'cmt-administration', 'Finance', 1),
 ('sub-administration-2', 'cmt-administration', 'Legal', 2),
 ('sub-administration-3', 'cmt-administration', 'Guest Relations', 3),
 ('sub-administration-4', 'cmt-administration', 'Documentation', 4),
 ('sub-administration-5', 'cmt-administration', 'Accommodation', 5);
