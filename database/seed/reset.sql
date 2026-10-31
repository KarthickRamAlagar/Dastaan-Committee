-- LOCAL TESTING ONLY: empties every table (keeps the schema), children first.
DELETE FROM dev_outbox; DELETE FROM audit_log; DELETE FROM support_requests; DELETE FROM committee_grants;
DELETE FROM mail_log; DELETE FROM notifications; DELETE FROM ticket_events; DELETE FROM ticket_comments;
DELETE FROM attachments; DELETE FROM ticket_hops; DELETE FROM tickets; DELETE FROM otps; DELETE FROM sessions;
DELETE FROM rate_limits; DELETE FROM users; DELETE FROM sub_committees; DELETE FROM committees;
