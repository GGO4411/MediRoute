USE mediroute;

-- DDL examples for the database lab demonstration.
-- Run the ALTER statement once, then use the commented DROP statements
-- only when you want to reverse the demonstration in a disposable database.
ALTER TABLE users ADD COLUMN preferred_language VARCHAR(10) NOT NULL DEFAULT 'en';
-- ALTER TABLE users DROP COLUMN preferred_language;
-- DROP VIEW IF EXISTS v_appointment_details;
