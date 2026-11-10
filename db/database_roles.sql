-- Optional native MySQL roles for a DBA-led demonstration.
-- These DB-login roles are separate from application end-user roles.
-- The Next.js service account does not switch among them per HTTP request.
-- Execute as a MySQL administrator only in a disposable/demo environment.
CREATE ROLE IF NOT EXISTS 'mediroute_readonly';
CREATE ROLE IF NOT EXISTS 'mediroute_clinician';
CREATE ROLE IF NOT EXISTS 'mediroute_administrator';

GRANT SELECT ON mediroute.v_doctor_directory TO 'mediroute_readonly';
GRANT SELECT ON mediroute.appointment_slots TO 'mediroute_readonly';
GRANT SELECT ON mediroute.v_appointment_details TO 'mediroute_clinician';
GRANT SELECT ON mediroute.appointment_slots TO 'mediroute_clinician';
GRANT SELECT,INSERT ON mediroute.prescriptions TO 'mediroute_clinician';
GRANT UPDATE(status) ON mediroute.appointments TO 'mediroute_clinician';
GRANT ALL PRIVILEGES ON mediroute.* TO 'mediroute_administrator';

-- Assign roles only to dedicated database accounts created securely by a DBA.
-- GRANT 'mediroute_readonly' TO 'reporting_user'@'localhost';
-- SET DEFAULT ROLE 'mediroute_readonly' TO 'reporting_user'@'localhost';
