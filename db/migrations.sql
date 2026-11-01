USE mediroute;

-- Optional schema evolution example. Run once on a database that does not
-- already contain this column; this file is not run during normal startup.
ALTER TABLE users ADD COLUMN preferred_language VARCHAR(10) NOT NULL DEFAULT 'en';

-- To reverse this migration in a disposable database, run separately:
-- ALTER TABLE users DROP COLUMN preferred_language;
