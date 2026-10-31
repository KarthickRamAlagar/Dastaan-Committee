-- Each committee shows an icon (a key from COMMITTEE_ICONS in packages/shared) instead of its first letter.
ALTER TABLE committees ADD COLUMN icon TEXT;
