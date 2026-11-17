# MediRoute Entity–Relationship Diagram

This document is the canonical ER diagram for the **current MySQL schema** in `db/schema.sql`.

## Crow's-foot ER diagram

The diagram uses standard logical/physical ERD notation: each entity is a table, attributes are listed inside the entity, PK/FK/UK identify key roles, and connectors show cardinality. It includes all **11 relational tables**.

```mermaid
erDiagram
    USERS {
        BIGINT user_id PK
        VARCHAR full_name
        VARCHAR email UK
        VARCHAR password_hash
        ENUM role
        VARCHAR phone
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    PERMISSIONS {
        VARCHAR permission_code PK
        VARCHAR description
    }

    ROLE_PERMISSIONS {
        VARCHAR role_code PK
        VARCHAR permission_code PK, FK
    }

    SPECIALTIES {
        BIGINT specialty_id PK
        VARCHAR name UK
        VARCHAR description
        BOOLEAN is_active
    }

    DOCTORS {
        BIGINT doctor_id PK
        BIGINT user_id FK, UK
        BIGINT specialty_id FK
        VARCHAR qualification
        TINYINT years_experience
        DECIMAL consultation_fee
        TEXT bio
        BOOLEAN is_accepting_patients
        TIMESTAMP created_at
    }

    APPOINTMENT_SLOTS {
        BIGINT slot_id PK
        BIGINT doctor_id FK
        DATETIME starts_at
        DATETIME ends_at
        ENUM status
        TIMESTAMP created_at
    }

    TRIAGE_SESSIONS {
        BIGINT triage_id PK
        BIGINT patient_id FK
        TEXT symptom_text
        ENUM urgency
        TINYINT urgency_score
        JSON safety_flags
        JSON top_matches
        TIMESTAMP created_at
    }

    APPOINTMENTS {
        BIGINT appointment_id PK
        BIGINT patient_id FK
        BIGINT doctor_id FK
        BIGINT slot_id FK
        BIGINT triage_id FK, "nullable"
        ENUM status
        ENUM urgency
        TEXT reason
        TIMESTAMP booked_at
    }

    PRESCRIPTIONS {
        BIGINT prescription_id PK
        BIGINT appointment_id FK
        BIGINT doctor_id FK
        BIGINT patient_id FK
        TEXT diagnosis_notes
        VARCHAR medication_name
        VARCHAR dosage
        TEXT instructions
        TIMESTAMP prescribed_at
    }

    APPOINTMENT_AUDIT {
        BIGINT audit_id PK
        BIGINT appointment_id FK
        VARCHAR action
        VARCHAR old_status
        VARCHAR new_status
        TIMESTAMP changed_at
    }

    APPOINTMENT_RESCHEDULE_AUDIT {
        BIGINT reschedule_id PK
        BIGINT appointment_id FK
        BIGINT old_slot_id FK
        BIGINT new_slot_id FK
        BIGINT changed_by FK
        TIMESTAMP changed_at
    }

    USERS ||--o| DOCTORS : "has doctor profile"
    SPECIALTIES ||--o{ DOCTORS : "classifies"
    DOCTORS ||--o{ APPOINTMENT_SLOTS : "offers"
    USERS ||--o{ TRIAGE_SESSIONS : "submits as patient"
    USERS ||--o{ APPOINTMENTS : "books as patient"
    DOCTORS ||--o{ APPOINTMENTS : "is assigned"
    APPOINTMENT_SLOTS ||--o{ APPOINTMENTS : "is referenced by"
    TRIAGE_SESSIONS o|--o{ APPOINTMENTS : "optional triage link"
    APPOINTMENTS ||--o{ PRESCRIPTIONS : "has"
    USERS ||--o{ PRESCRIPTIONS : "receives as patient"
    DOCTORS ||--o{ PRESCRIPTIONS : "issues"
    APPOINTMENTS ||--o{ APPOINTMENT_AUDIT : "has status history"
    APPOINTMENTS ||--o{ APPOINTMENT_RESCHEDULE_AUDIT : "has reschedule history"
    USERS ||--o{ APPOINTMENT_RESCHEDULE_AUDIT : "changed by"
    APPOINTMENT_SLOTS ||--o{ APPOINTMENT_RESCHEDULE_AUDIT : "old slot"
    APPOINTMENT_SLOTS ||--o{ APPOINTMENT_RESCHEDULE_AUDIT : "new slot"
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : "is assigned through"
```

## Cardinality and relationship notes

- **USERS–DOCTORS (1 to 0..1):** a doctor profile must reference one user; the unique constraint on `doctors.user_id` means a user can have at most one doctor profile.
- **SPECIALTIES–DOCTORS (1 to many):** every doctor references one specialty; a specialty can have multiple doctors.
- **DOCTORS–APPOINTMENT_SLOTS (1 to many):** each slot belongs to one doctor.
- **USERS–TRIAGE_SESSIONS (1 to many):** `triage_sessions.patient_id` identifies the patient who submitted each session.
- **USERS–APPOINTMENTS (1 to many):** `appointments.patient_id` identifies the patient who books each appointment.
- **DOCTORS–APPOINTMENTS (1 to many):** each appointment is assigned to one doctor.
- **APPOINTMENT_SLOTS–APPOINTMENTS (1 to many historical references):** each appointment references one slot. The same slot can appear in historical appointment rows over time after cancellation and rebooking; the booking transaction and triggers control current availability.
- **TRIAGE_SESSIONS–APPOINTMENTS:** an appointment can have zero or one triage session because `appointments.triage_id` is nullable. At the database level, one triage session can be referenced by multiple appointment rows because this FK is not unique.
- **APPOINTMENTS–PRESCRIPTIONS (1 to many):** each prescription references one appointment. The database triggers additionally check that its patient and doctor agree with the referenced appointment.
- **APPOINTMENTS–APPOINTMENT_AUDIT (1 to many):** audit rows reference their appointment through an enforced FK.
- **APPOINTMENTS–APPOINTMENT_RESCHEDULE_AUDIT (1 to many):** each reschedule history row references the appointment and both the previous and new slot.
- **PERMISSIONS–ROLE_PERMISSIONS (1 to many):** each role-permission mapping references one permission.

## Important RBAC modelling note

`ROLE_PERMISSIONS.permission_code` is an enforced foreign key to `PERMISSIONS.permission_code`. `ROLE_PERMISSIONS.role_code` is part of the composite primary key, but **it is not a foreign key** to `USERS.role`. The application compares `role_permissions.role_code` with `users.role` in its permission lookup. This is a logical role mapping, not an enforced relational FK.

## Scope

Qdrant collection `medical_routing_v1` is a separate vector database. It is deliberately not represented as a MySQL entity or foreign-key relationship in this ER diagram.
