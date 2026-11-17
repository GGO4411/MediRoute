USE mediroute;

-- Additive integrity migration. It preserves existing rows and stops before DDL
-- if legacy data cannot satisfy the new constraints. Resolve reported rows and
-- rerun this migration; do not delete history to make it pass. Diagnostic
-- joins below identify orphan audits, mismatched prescription owners, and
-- appointment/slot/triage inconsistencies.
DROP PROCEDURE IF EXISTS sp_preflight_appointment_integrity;
DELIMITER $$
CREATE PROCEDURE sp_preflight_appointment_integrity()
BEGIN
 DECLARE orphan_audits BIGINT DEFAULT 0;
 DECLARE mismatched_prescriptions BIGINT DEFAULT 0;
 DECLARE mismatched_appointments BIGINT DEFAULT 0;
 SELECT COUNT(*) INTO orphan_audits
  FROM appointment_audit aa LEFT JOIN appointments a ON a.appointment_id=aa.appointment_id
  WHERE a.appointment_id IS NULL;
 SELECT COUNT(*) INTO mismatched_prescriptions
  FROM prescriptions p JOIN appointments a ON a.appointment_id=p.appointment_id
  WHERE p.patient_id<>a.patient_id OR p.doctor_id<>a.doctor_id;
 SELECT COUNT(*) INTO mismatched_appointments
  FROM appointments a JOIN appointment_slots s ON s.slot_id=a.slot_id
  LEFT JOIN triage_sessions t ON t.triage_id=a.triage_id
  WHERE a.doctor_id<>s.doctor_id OR (a.triage_id IS NOT NULL AND (t.patient_id IS NULL OR t.patient_id<>a.patient_id OR t.urgency='EMERGENCY'));
 IF orphan_audits>0 OR mismatched_prescriptions>0 OR mismatched_appointments>0 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Integrity migration stopped: inspect orphan audits, mismatched prescriptions, and appointment slot/triage links';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='appointment_audit'
   AND COLUMN_NAME='appointment_id' AND REFERENCED_TABLE_NAME='appointments'
   AND REFERENCED_COLUMN_NAME='appointment_id'
 ) THEN
  ALTER TABLE appointment_audit
   ADD CONSTRAINT fk_appointment_audit_appointment
   FOREIGN KEY(appointment_id) REFERENCES appointments(appointment_id);
 END IF;
END$$
DELIMITER ;
CALL sp_preflight_appointment_integrity();
DROP PROCEDURE sp_preflight_appointment_integrity;

-- A slot move must release the previous slot and reserve a target slot for the
-- same doctor before the appointment's slot_id is changed.
DROP TRIGGER IF EXISTS trg_appointment_before_update;
DELIMITER $$
CREATE TRIGGER trg_appointment_before_update
BEFORE UPDATE ON appointments FOR EACH ROW
BEGIN
 DECLARE triage_patient BIGINT UNSIGNED; DECLARE triage_urgency VARCHAR(20);
 IF NEW.triage_id IS NOT NULL THEN
  SET triage_patient=NULL; SET triage_urgency=NULL;
  SELECT patient_id,urgency INTO triage_patient,triage_urgency FROM triage_sessions WHERE triage_id=NEW.triage_id FOR UPDATE;
  IF triage_patient IS NULL OR triage_patient<>NEW.patient_id THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Triage session does not belong to this patient';
  END IF;
  IF triage_urgency='EMERGENCY' THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Emergency triage sessions cannot be booked online';
  END IF;
 END IF;
 IF OLD.doctor_id<>NEW.doctor_id THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='An appointment cannot be reassigned to a different doctor';
 END IF;
 IF OLD.status IN ('CANCELLED','COMPLETED','NO_SHOW') AND NEW.status<>OLD.status THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Closed appointments cannot be reopened';
 END IF;
 IF OLD.status='BOOKED' AND NEW.status NOT IN ('BOOKED','CONFIRMED','CANCELLED','NO_SHOW') THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid transition from BOOKED';
 END IF;
 IF OLD.status='CONFIRMED' AND NEW.status NOT IN ('CONFIRMED','COMPLETED','CANCELLED','NO_SHOW') THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid transition from CONFIRMED';
 END IF;
END$$

DROP TRIGGER IF EXISTS trg_appointment_slot_before_update;
CREATE TRIGGER trg_appointment_slot_before_update
BEFORE UPDATE ON appointments FOR EACH ROW
BEGIN
 DECLARE target_status VARCHAR(20); DECLARE target_doctor BIGINT UNSIGNED; DECLARE source_status VARCHAR(20);
 IF OLD.slot_id<>NEW.slot_id THEN
  SET target_status=NULL; SET target_doctor=NULL; SET source_status=NULL;
  SELECT status,doctor_id INTO target_status,target_doctor FROM appointment_slots WHERE slot_id=NEW.slot_id FOR UPDATE;
  SELECT status INTO source_status FROM appointment_slots WHERE slot_id=OLD.slot_id FOR UPDATE;
  IF target_status IS NULL OR target_status<>'BOOKED' OR target_doctor<>NEW.doctor_id OR source_status<>'AVAILABLE' THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Appointment slot changes require a booked slot for the same doctor and a released prior slot';
  END IF;
 END IF;
END$$

DROP TRIGGER IF EXISTS trg_prescription_before_insert;
CREATE TRIGGER trg_prescription_before_insert
BEFORE INSERT ON prescriptions FOR EACH ROW
BEGIN
 DECLARE appointment_patient BIGINT UNSIGNED; DECLARE appointment_doctor BIGINT UNSIGNED;
 DECLARE CONTINUE HANDLER FOR NOT FOUND SET appointment_patient=NULL,appointment_doctor=NULL;
 SELECT patient_id,doctor_id INTO appointment_patient,appointment_doctor FROM appointments WHERE appointment_id=NEW.appointment_id;
 IF appointment_patient IS NULL OR appointment_patient<>NEW.patient_id OR appointment_doctor<>NEW.doctor_id THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Prescription patient and doctor must match its appointment';
 END IF;
END$$

DROP TRIGGER IF EXISTS trg_prescription_before_update;
CREATE TRIGGER trg_prescription_before_update
BEFORE UPDATE ON prescriptions FOR EACH ROW
BEGIN
 DECLARE appointment_patient BIGINT UNSIGNED; DECLARE appointment_doctor BIGINT UNSIGNED;
 DECLARE CONTINUE HANDLER FOR NOT FOUND SET appointment_patient=NULL,appointment_doctor=NULL;
 SELECT patient_id,doctor_id INTO appointment_patient,appointment_doctor FROM appointments WHERE appointment_id=NEW.appointment_id;
 IF appointment_patient IS NULL OR appointment_patient<>NEW.patient_id OR appointment_doctor<>NEW.doctor_id THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Prescription patient and doctor must match its appointment';
 END IF;
END$$
DELIMITER ;
