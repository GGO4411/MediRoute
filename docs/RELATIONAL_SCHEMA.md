# MediRoute Relational Schema

Derived from the implemented MySQL definitions in `db/schema.sql`.

**Notation:** PK = Primary Key · FK = Foreign Key · UQ = Unique constraint · NULL = nullable.

## 1. USERS

| Attribute | Key / Constraint |
|---|---|
| `user_id` | PK |
| `full_name` | NOT NULL |
| `email` | NOT NULL, UQ |
| `password_hash` | NOT NULL |
| `role` | ENUM: `PATIENT`, `DOCTOR`, `ADMIN` |
| `phone` | Optional |
| `created_at` | NOT NULL, default current timestamp |
| `updated_at` | NOT NULL, auto-updated timestamp |

## 2. PERMISSIONS

| Attribute | Key / Constraint |
|---|---|
| `permission_code` | PK |
| `description` | NOT NULL |

## 3. ROLE_PERMISSIONS

| Attribute | Key / Constraint |
|---|---|
| `role_code` | Part of composite PK |
| `permission_code` | Part of composite PK, FK → `PERMISSIONS(permission_code)` |

**Primary key:** (`role_code`, `permission_code`)

## 4. SPECIALTIES

| Attribute | Key / Constraint |
|---|---|
| `specialty_id` | PK |
| `name` | NOT NULL, UQ |
| `description` | Optional |
| `is_active` | NOT NULL, default TRUE |

## 5. DOCTORS

| Attribute | Key / Constraint |
|---|---|
| `doctor_id` | PK |
| `user_id` | FK → `USERS(user_id)`, NOT NULL, UQ |
| `specialty_id` | FK → `SPECIALTIES(specialty_id)`, NOT NULL |
| `qualification` | Optional |
| `years_experience` | NOT NULL, default 0 |
| `consultation_fee` | NOT NULL, default 0, CHECK ≥ 0 |
| `bio` | Optional |
| `is_accepting_patients` | NOT NULL, default TRUE |
| `created_at` | NOT NULL, default current timestamp |

## 6. APPOINTMENT_SLOTS

| Attribute | Key / Constraint |
|---|---|
| `slot_id` | PK |
| `doctor_id` | FK → `DOCTORS(doctor_id)`, NOT NULL |
| `starts_at` | NOT NULL |
| `ends_at` | NOT NULL, CHECK `ends_at > starts_at` |
| `status` | ENUM: `AVAILABLE`, `BOOKED`, `BLOCKED` |
| `created_at` | NOT NULL, default current timestamp |
| (`doctor_id`, `starts_at`) | Composite UQ |

## 7. TRIAGE_SESSIONS

| Attribute | Key / Constraint |
|---|---|
| `triage_id` | PK |
| `patient_id` | FK → `USERS(user_id)`, NOT NULL |
| `symptom_text` | NOT NULL |
| `urgency` | ENUM: `ROUTINE`, `SOON`, `URGENT`, `EMERGENCY` |
| `urgency_score` | NOT NULL, default 0 |
| `safety_flags` | JSON, optional |
| `top_matches` | JSON, optional |
| `created_at` | NOT NULL, default current timestamp |

## 8. APPOINTMENTS

| Attribute | Key / Constraint |
|---|---|
| `appointment_id` | PK |
| `patient_id` | FK → `USERS(user_id)`, NOT NULL |
| `doctor_id` | FK → `DOCTORS(doctor_id)`, NOT NULL |
| `slot_id` | FK → `APPOINTMENT_SLOTS(slot_id)`, NOT NULL |
| `triage_id` | FK → `TRIAGE_SESSIONS(triage_id)`, NULL; ON DELETE SET NULL |
| `status` | ENUM: `BOOKED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW` |
| `urgency` | ENUM: `ROUTINE`, `SOON`, `URGENT`, `EMERGENCY` |
| `reason` | Optional |
| `booked_at` | NOT NULL, default current timestamp |

## 9. PRESCRIPTIONS

| Attribute | Key / Constraint |
|---|---|
| `prescription_id` | PK |
| `appointment_id` | FK → `APPOINTMENTS(appointment_id)`, NOT NULL |
| `doctor_id` | FK → `DOCTORS(doctor_id)`, NOT NULL |
| `patient_id` | FK → `USERS(user_id)`, NOT NULL |
| `diagnosis_notes` | Optional |
| `medication_name` | NOT NULL |
| `dosage` | Optional |
| `instructions` | Optional |
| `prescribed_at` | NOT NULL, default current timestamp |

## 10. APPOINTMENT_AUDIT

| Attribute | Key / Constraint |
|---|---|
| `audit_id` | PK |
| `appointment_id` | FK → `APPOINTMENTS(appointment_id)`, NOT NULL |
| `action` | NOT NULL |
| `old_status` | Optional |
| `new_status` | Optional |
| `changed_at` | NOT NULL, default current timestamp |

## 11. APPOINTMENT_RESCHEDULE_AUDIT

| Attribute | Key / Constraint |
|---|---|
| `reschedule_id` | PK |
| `appointment_id` | FK → `APPOINTMENTS(appointment_id)`, NOT NULL |
| `old_slot_id` | FK → `APPOINTMENT_SLOTS(slot_id)`, NOT NULL |
| `new_slot_id` | FK → `APPOINTMENT_SLOTS(slot_id)`, NOT NULL |
| `changed_by` | FK → `USERS(user_id)`, NOT NULL |
| `changed_at` | NOT NULL, default current timestamp |

## Foreign-Key Relationships

| Referencing table | Foreign key | Referenced table |
|---|---|---|
| `ROLE_PERMISSIONS` | `permission_code` | `PERMISSIONS(permission_code)` |
| `DOCTORS` | `user_id` | `USERS(user_id)` |
| `DOCTORS` | `specialty_id` | `SPECIALTIES(specialty_id)` |
| `APPOINTMENT_SLOTS` | `doctor_id` | `DOCTORS(doctor_id)` |
| `TRIAGE_SESSIONS` | `patient_id` | `USERS(user_id)` |
| `APPOINTMENTS` | `patient_id` | `USERS(user_id)` |
| `APPOINTMENTS` | `doctor_id` | `DOCTORS(doctor_id)` |
| `APPOINTMENTS` | `slot_id` | `APPOINTMENT_SLOTS(slot_id)` |
| `APPOINTMENTS` | `triage_id` | `TRIAGE_SESSIONS(triage_id)` |
| `PRESCRIPTIONS` | `appointment_id` | `APPOINTMENTS(appointment_id)` |
| `PRESCRIPTIONS` | `doctor_id` | `DOCTORS(doctor_id)` |
| `PRESCRIPTIONS` | `patient_id` | `USERS(user_id)` |
| `APPOINTMENT_AUDIT` | `appointment_id` | `APPOINTMENTS(appointment_id)` |
| `APPOINTMENT_RESCHEDULE_AUDIT` | `appointment_id` | `APPOINTMENTS(appointment_id)` |
| `APPOINTMENT_RESCHEDULE_AUDIT` | `old_slot_id`, `new_slot_id` | `APPOINTMENT_SLOTS(slot_id)` |
| `APPOINTMENT_RESCHEDULE_AUDIT` | `changed_by` | `USERS(user_id)` |

## Design Notes

- `USERS.role` distinguishes patient, doctor and administrator accounts; doctor-specific attributes are stored in `DOCTORS`.
- `DOCTORS.user_id` is unique, so a user can have at most one doctor profile.
- A doctor can have multiple appointment slots. A slot can be referenced by historical appointment records after cancellation and release.
- `APPOINTMENTS.triage_id` is optional.
- Appointment status audit rows are protected by a foreign key, so a parent appointment cannot be deleted while its audit history remains.
- Prescription triggers require the referenced appointment, patient and doctor to agree. Appointment slot-change triggers require the old slot to be released and the target slot to be booked for the same doctor.
- `GET /api/appointments` returns stable descending start-time order, supports server-side status/date filters and `page`/`pageSize` pagination. `PAST` includes all appointments whose slot start is at or before UTC now, including completed visits.
- Existing installations must apply `db/migrations/20261117_appointment_integrity.sql`. It checks for orphan audit rows and mismatched prescriptions before adding the foreign key; it stops without deleting data if either is found.
- Qdrant is a separate vector database used for semantic symptom search; it is not part of this relational schema.
