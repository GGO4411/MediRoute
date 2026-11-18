USE mediroute;

-- Add nullable reason fields so existing appointment and audit rows are preserved.
DROP PROCEDURE IF EXISTS sp_add_cancellation_reason_columns;
DELIMITER $$
CREATE PROCEDURE sp_add_cancellation_reason_columns()
BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='appointments' AND COLUMN_NAME='cancellation_reason') THEN
  SET @ddl='ALTER TABLE appointments ADD COLUMN cancellation_reason VARCHAR(500) NULL';
  PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='appointment_audit' AND COLUMN_NAME='cancellation_reason') THEN
  SET @ddl='ALTER TABLE appointment_audit ADD COLUMN cancellation_reason VARCHAR(500) NULL';
  PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
 END IF;
END$$
DELIMITER ;
CALL sp_add_cancellation_reason_columns();
DROP PROCEDURE sp_add_cancellation_reason_columns;

DROP TRIGGER IF EXISTS trg_appointment_after_update;
DELIMITER $$
CREATE TRIGGER trg_appointment_after_update
AFTER UPDATE ON appointments FOR EACH ROW
BEGIN
 IF OLD.status<>NEW.status THEN
  INSERT INTO appointment_audit(appointment_id,action,old_status,new_status,cancellation_reason)
   VALUES(NEW.appointment_id,'STATUS_CHANGED',OLD.status,NEW.status,NEW.cancellation_reason);
  IF NEW.status='CANCELLED' AND OLD.status<>'CANCELLED' THEN
   UPDATE appointment_slots SET status='AVAILABLE' WHERE slot_id=NEW.slot_id;
  END IF;
 END IF;
END$$
DELIMITER ;

CREATE OR REPLACE VIEW v_appointment_details AS
SELECT a.appointment_id,a.patient_id,p.full_name AS patient_name,a.doctor_id,du.full_name AS doctor_name,
 s.name AS specialty,sl.starts_at,sl.ends_at,a.status,a.urgency,a.booked_at,a.cancellation_reason
FROM appointments a JOIN users p ON p.user_id=a.patient_id
JOIN doctors d ON d.doctor_id=a.doctor_id JOIN users du ON du.user_id=d.user_id
JOIN specialties s ON s.specialty_id=d.specialty_id JOIN appointment_slots sl ON sl.slot_id=a.slot_id;
