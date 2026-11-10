# MediRoute ER diagram

This diagram matches the current MySQL implementation in db/schema.sql.
The supplied conceptual diagram maps PATIENT, DOCTOR and ADMIN to roles in the
shared users table; SYMPTOM_REPORT maps to triage_sessions. The implemented
schema also separates appointment availability into appointment_slots.

~~~mermaid
erDiagram
    USERS {
        BIGINT user_id PK
        VARCHAR full_name
        VARCHAR email UK
        VARCHAR password_hash
        ENUM role
        VARCHAR phone
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
    }
    APPOINTMENT_SLOTS {
        BIGINT slot_id PK
        BIGINT doctor_id FK
        DATETIME starts_at
        DATETIME ends_at
        ENUM status
    }
    TRIAGE_SESSIONS {
        BIGINT triage_id PK
        BIGINT patient_id FK
        TEXT symptom_text
        ENUM urgency
        TINYINT urgency_score
        JSON safety_flags
        JSON top_matches
    }
    APPOINTMENTS {
        BIGINT appointment_id PK
        BIGINT patient_id FK
        BIGINT doctor_id FK
        BIGINT slot_id FK
        BIGINT triage_id FK
        ENUM status
        ENUM urgency
        TEXT reason
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
    }
    APPOINTMENT_AUDIT {
        BIGINT audit_id PK
        BIGINT appointment_id
        VARCHAR action
        VARCHAR old_status
        VARCHAR new_status
    }

    PERMISSIONS ||--o{ ROLE_PERMISSIONS : grants
    USERS ||--o| DOCTORS : "doctor profile"
    SPECIALTIES ||--o{ DOCTORS : classifies
    USERS ||--o{ TRIAGE_SESSIONS : submits
    USERS ||--o{ APPOINTMENTS : books
    DOCTORS ||--o{ APPOINTMENT_SLOTS : publishes
    DOCTORS ||--o{ APPOINTMENTS : attends
    APPOINTMENT_SLOTS ||--o{ APPOINTMENTS : reserves
    TRIAGE_SESSIONS o|--o{ APPOINTMENTS : informs
    APPOINTMENTS ||--o{ PRESCRIPTIONS : produces
    USERS ||--o{ PRESCRIPTIONS : receives
    DOCTORS ||--o{ PRESCRIPTIONS : issues
    APPOINTMENTS ||--o{ APPOINTMENT_AUDIT : records
~~~

## Key and relationship notes

- Every table's *_id (or permission_code) is its primary key; users.email and
  specialties.name are unique. doctors.user_id is also unique.
- A doctor belongs to one specialty; a specialty can classify many doctors.
- Each appointment references one patient, one doctor and one slot; triage_id
  is optional. A slot can have multiple historical appointment rows over time
  because cancellation can release it for rebooking.
- Each prescription belongs to one appointment, one doctor and one patient.
- appointment_audit.appointment_id is an audit reference; the current schema
  does not declare it as a foreign key.
- Patient, doctor and administrator identities share users and differ by role.
  permissions and role_permissions provide the MySQL authorization matrix.

## Differences from the supplied conceptual diagram

The supplied diagram is a useful domain-level view. This implementation
normalizes account identity into users, stores specialist details in doctors,
records submitted symptoms in triage_sessions and separates appointment slots
from bookings. Date of birth and gender are not currently persisted.
