-- A committee can have several Committee Leads (the whole core team are Leads; they add their own Members later).
DROP INDEX IF EXISTS uq_one_lead_per_committee;
