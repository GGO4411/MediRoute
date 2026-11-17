USE mediroute;

-- Safe to re-run: permission rows and the audit table are idempotent.
INSERT IGNORE INTO permissions(permission_code,description)
VALUES ('APPOINTMENT_RESCHEDULE_OWN','Reschedule the current patient active appointment');
INSERT IGNORE INTO role_permissions(role_code,permission_code)
VALUES ('PATIENT','APPOINTMENT_RESCHEDULE_OWN');

CREATE TABLE IF NOT EXISTS appointment_reschedule_audit (
 reschedule_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 appointment_id BIGINT UNSIGNED NOT NULL,
 old_slot_id BIGINT UNSIGNED NOT NULL,
 new_slot_id BIGINT UNSIGNED NOT NULL,
 changed_by BIGINT UNSIGNED NOT NULL,
 changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_reschedule_appointment FOREIGN KEY(appointment_id) REFERENCES appointments(appointment_id),
 CONSTRAINT fk_reschedule_old_slot FOREIGN KEY(old_slot_id) REFERENCES appointment_slots(slot_id),
 CONSTRAINT fk_reschedule_new_slot FOREIGN KEY(new_slot_id) REFERENCES appointment_slots(slot_id),
 CONSTRAINT fk_reschedule_user FOREIGN KEY(changed_by) REFERENCES users(user_id),
 INDEX idx_reschedule_appointment(appointment_id,changed_at)
) ENGINE=InnoDB;
