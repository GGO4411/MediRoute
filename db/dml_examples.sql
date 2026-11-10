USE mediroute;
START TRANSACTION;
SET @demo_specialty_name=CONCAT('DBMS Demo Specialty ',CONNECTION_ID());
INSERT INTO specialties(name,description)
VALUES(@demo_specialty_name,'Temporary row used to demonstrate DML operations.');
SET @demo_specialty_id=LAST_INSERT_ID();

-- READ
SELECT specialty_id,name,description FROM specialties WHERE specialty_id=@demo_specialty_id;
-- UPDATE
UPDATE specialties SET description='Updated temporary DML demonstration row.'
WHERE specialty_id=@demo_specialty_id;
SELECT specialty_id,name,description FROM specialties WHERE specialty_id=@demo_specialty_id;
-- DELETE only the row inserted by this script
DELETE FROM specialties WHERE specialty_id=@demo_specialty_id;
SELECT COUNT(*) AS remaining_demo_rows FROM specialties WHERE specialty_id=@demo_specialty_id;

-- Do not leave the demonstration row behind.
ROLLBACK;
