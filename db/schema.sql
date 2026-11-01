CREATE DATABASE IF NOT EXISTS mediroute CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE mediroute;

CREATE TABLE IF NOT EXISTS users (
 user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(120) NOT NULL,
 email VARCHAR(190) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
 role ENUM('PATIENT','DOCTOR','ADMIN') NOT NULL DEFAULT 'PATIENT', phone VARCHAR(20),
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_users_role(role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS specialties (
 specialty_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE,
 description VARCHAR(500), is_active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS doctors (
 doctor_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL UNIQUE,
 specialty_id BIGINT UNSIGNED NOT NULL, qualification VARCHAR(180), years_experience TINYINT UNSIGNED NOT NULL DEFAULT 0,
 consultation_fee DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK(consultation_fee>=0), bio TEXT,
 is_accepting_patients BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_doctor_user FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
 CONSTRAINT fk_doctor_specialty FOREIGN KEY(specialty_id) REFERENCES specialties(specialty_id),
 INDEX idx_doctor_specialty_active(specialty_id,is_accepting_patients)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointment_slots (
 slot_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, doctor_id BIGINT UNSIGNED NOT NULL,
 starts_at DATETIME NOT NULL, ends_at DATETIME NOT NULL, status ENUM('AVAILABLE','BOOKED','BLOCKED') NOT NULL DEFAULT 'AVAILABLE',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_slot_doctor FOREIGN KEY(doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
 CONSTRAINT chk_slot_time CHECK(ends_at>starts_at),
 UNIQUE KEY uq_doctor_start(doctor_id,starts_at), INDEX idx_slot_search(status,starts_at,doctor_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS triage_sessions (
 triage_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, patient_id BIGINT UNSIGNED NOT NULL, symptom_text TEXT NOT NULL,
 urgency ENUM('ROUTINE','SOON','URGENT','EMERGENCY') NOT NULL DEFAULT 'ROUTINE', urgency_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
 safety_flags JSON, top_matches JSON, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_triage_patient FOREIGN KEY(patient_id) REFERENCES users(user_id) ON DELETE CASCADE,
 INDEX idx_triage_patient_date(patient_id,created_at), INDEX idx_triage_urgency(urgency,created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointments (
 appointment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, patient_id BIGINT UNSIGNED NOT NULL,
 doctor_id BIGINT UNSIGNED NOT NULL, slot_id BIGINT UNSIGNED NOT NULL, triage_id BIGINT UNSIGNED NULL,
 status ENUM('BOOKED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW') NOT NULL DEFAULT 'BOOKED',
 urgency ENUM('ROUTINE','SOON','URGENT','EMERGENCY') NOT NULL DEFAULT 'ROUTINE', reason TEXT,
 booked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_appointment_patient FOREIGN KEY(patient_id) REFERENCES users(user_id),
 CONSTRAINT fk_appointment_doctor FOREIGN KEY(doctor_id) REFERENCES doctors(doctor_id),
 CONSTRAINT fk_appointment_slot FOREIGN KEY(slot_id) REFERENCES appointment_slots(slot_id),
 CONSTRAINT fk_appointment_triage FOREIGN KEY(triage_id) REFERENCES triage_sessions(triage_id) ON DELETE SET NULL,
 INDEX idx_appointment_slot(slot_id), INDEX idx_appointment_doctor_status(doctor_id,status),
 INDEX idx_appointment_patient_date(patient_id,booked_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescriptions (
 prescription_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, appointment_id BIGINT UNSIGNED NOT NULL,
 doctor_id BIGINT UNSIGNED NOT NULL, patient_id BIGINT UNSIGNED NOT NULL, diagnosis_notes TEXT,
 medication_name VARCHAR(180) NOT NULL, dosage VARCHAR(120), instructions TEXT,
 prescribed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_prescription_appointment FOREIGN KEY(appointment_id) REFERENCES appointments(appointment_id),
 CONSTRAINT fk_prescription_doctor FOREIGN KEY(doctor_id) REFERENCES doctors(doctor_id),
 CONSTRAINT fk_prescription_patient FOREIGN KEY(patient_id) REFERENCES users(user_id),
 INDEX idx_prescription_patient_date(patient_id,prescribed_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointment_audit (
 audit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, appointment_id BIGINT UNSIGNED NOT NULL,
 action VARCHAR(30) NOT NULL, old_status VARCHAR(20), new_status VARCHAR(20),
 changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_audit_appointment(appointment_id,changed_at)
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER IF NOT EXISTS trg_appointment_before_insert
BEFORE INSERT ON appointments FOR EACH ROW
BEGIN
 DECLARE slot_state VARCHAR(20); DECLARE slot_doctor BIGINT UNSIGNED;
 SET slot_state=NULL;
 SELECT status,doctor_id INTO slot_state,slot_doctor FROM appointment_slots WHERE slot_id=NEW.slot_id;
 IF slot_state IS NULL OR slot_state<>'AVAILABLE' OR slot_doctor<>NEW.doctor_id THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Selected slot is not available for this doctor';
 END IF;
END$$

CREATE TRIGGER IF NOT EXISTS trg_appointment_after_insert
AFTER INSERT ON appointments FOR EACH ROW
BEGIN
 UPDATE appointment_slots SET status='BOOKED' WHERE slot_id=NEW.slot_id;
 INSERT INTO appointment_audit(appointment_id,action,new_status) VALUES(NEW.appointment_id,'CREATED',NEW.status);
END$$

CREATE TRIGGER IF NOT EXISTS trg_appointment_after_update
AFTER UPDATE ON appointments FOR EACH ROW
BEGIN
 IF OLD.status<>NEW.status THEN
  INSERT INTO appointment_audit(appointment_id,action,old_status,new_status)
   VALUES(NEW.appointment_id,'STATUS_CHANGED',OLD.status,NEW.status);
  IF NEW.status='CANCELLED' AND OLD.status<>'CANCELLED' THEN
   UPDATE appointment_slots SET status='AVAILABLE' WHERE slot_id=NEW.slot_id;
  END IF;
 END IF;
END$$

CREATE PROCEDURE IF NOT EXISTS sp_calculate_urgency(IN p_symptoms TEXT,OUT p_score TINYINT UNSIGNED,OUT p_level VARCHAR(20))
BEGIN
 DECLARE s TEXT; SET s=LOWER(COALESCE(p_symptoms,'')); SET p_score=0;
 IF s REGEXP 'chest pain|pressure in (my )?chest|cannot breathe|can.t breathe|severe shortness of breath|unconscious|not waking|face droop|sudden weakness|seizure|heavy bleeding|suicid' THEN
  SET p_score=100;
 ELSEIF s REGEXP 'difficulty breathing|shortness of breath|faint|fainted|severe pain|high fever|vomit(ing)? blood|black stool|sudden vision loss' THEN
  SET p_score=75;
 ELSEIF s REGEXP 'persistent pain|worsening pain|fever|infection|swelling|dizziness|blurred vision' THEN
  SET p_score=45;
 ELSEIF s<>'' THEN SET p_score=15;
 END IF;
 SET p_level=CASE WHEN p_score>=100 THEN 'EMERGENCY' WHEN p_score>=75 THEN 'URGENT' WHEN p_score>=45 THEN 'SOON' ELSE 'ROUTINE' END;
END$$
DELIMITER ;

CREATE OR REPLACE VIEW v_doctor_directory AS
SELECT d.doctor_id,u.full_name AS doctor_name,u.email,s.name AS specialty,d.qualification,d.years_experience,
 d.consultation_fee,d.bio,d.is_accepting_patients
FROM doctors d JOIN users u ON u.user_id=d.user_id JOIN specialties s ON s.specialty_id=d.specialty_id;

CREATE OR REPLACE VIEW v_appointment_details AS
SELECT a.appointment_id,a.patient_id,p.full_name AS patient_name,a.doctor_id,du.full_name AS doctor_name,
 s.name AS specialty,sl.starts_at,sl.ends_at,a.status,a.urgency,a.booked_at
FROM appointments a JOIN users p ON p.user_id=a.patient_id
JOIN doctors d ON d.doctor_id=a.doctor_id JOIN users du ON du.user_id=d.user_id
JOIN specialties s ON s.specialty_id=d.specialty_id JOIN appointment_slots sl ON sl.slot_id=a.slot_id;
