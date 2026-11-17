# MediRoute Relational Schema

**Source of truth:** `db/schema.sql` (current MySQL 8.4 implementation).

## Visual relational-schema diagram

The companion diagram follows the relation-box layout: each relation is a horizontal row of attribute cells; primary-key attributes are underlined and labelled; foreign-key attributes are highlighted; red dependency arrows show primary key → non-key attributes. The FK reference map below the boxes identifies each child-column → parent-key relationship.

The downloadable high-resolution diagram is supplied separately as `MediRoute_Relational_Schema.svg` / `.png`.

## 1. Notation

- **PK** — primary key
- **FK** — foreign key
- **UK** — unique candidate key / unique constraint
- **NN** — NOT NULL
- **NULL** — nullable
- `A → R(B)` — attribute A references attribute B in relation R
- A pair of attributes marked **PK (composite)** forms one combined primary key.

## 2. Relational schema notation

The bold attribute(s) are the primary key. Foreign-key references are written after the relation.

```text
USERS(
  user_id PK,
  full_name,
  email UK,
  password_hash,
  role,
  phone,
  created_at,
  updated_at
)

PERMISSIONS(
  permission_code PK,
  description
)

ROLE_PERMISSIONS(
  role_code PK-part,
  permission_code PK-part, FK -> PERMISSIONS(permission_code)
)
PK = (role_code, permission_code)

SPECIALTIES(
  specialty_id PK,
  name UK,
  description,
  is_active
)

DOCTORS(
  doctor_id PK,
  user_id FK -> USERS(user_id), UK,
  specialty_id FK -> SPECIALTIES(specialty_id),
  qualification,
  years_experience,
  consultation_fee,
  bio,
  is_accepting_patients,
  created_at
)

APPOINTMENT_SLOTS(
  slot_id PK,
  doctor_id FK -> DOCTORS(doctor_id),
  starts_at,
  ends_at,
  status,
  created_at
)
UK = (doctor_id, starts_at)

TRIAGE_SESSIONS(
  triage_id PK,
  patient_id FK -> USERS(user_id),
  symptom_text,
  urgency,
  urgency_score,
  safety_flags,
  top_matches,
  created_at
)

APPOINTMENTS(
  appointment_id PK,
  patient_id FK -> USERS(user_id),
  doctor_id FK -> DOCTORS(doctor_id),
  slot_id FK -> APPOINTMENT_SLOTS(slot_id),
  triage_id FK -> TRIAGE_SESSIONS(triage_id), NULL,
  status,
  urgency,
  reason,
  booked_at
)

PRESCRIPTIONS(
  prescription_id PK,
  appointment_id FK -> APPOINTMENTS(appointment_id),
  doctor_id FK -> DOCTORS(doctor_id),
  patient_id FK -> USERS(user_id),
  diagnosis_notes,
  medication_name,
  dosage,
  instructions,
  prescribed_at
)

APPOINTMENT_AUDIT(
  audit_id PK,
  appointment_id FK -> APPOINTMENTS(appointment_id),
  action,
  old_status,
  new_status,
  changed_at
)

APPOINTMENT_RESCHEDULE_AUDIT(
  reschedule_id PK,
  appointment_id FK -> APPOINTMENTS(appointment_id),
  old_slot_id FK -> APPOINTMENT_SLOTS(slot_id),
  new_slot_id FK -> APPOINTMENT_SLOTS(slot_id),
  changed_by FK -> USERS(user_id),
  changed_at
)
```

## 3. Physical attributes and constraints

### 3.1 USERS

| Attribute | MySQL type | Key / constraint |
|---|---|---|
| `user_id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| `full_name` | VARCHAR(120) | NN |
| `email` | VARCHAR(190) | NN, UK |
| `password_hash` | VARCHAR(255) | NN |
| `role` | ENUM('PATIENT','DOCTOR','ADMIN') | NN, DEFAULT 'PATIENT' |
| `phone` | VARCHAR(20) | NULL |
| `created_at` | TIMESTAMP | NN, DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | NN, auto-updated |

### 3.2 PERMISSIONS

| Attribute | MySQL type | Key / constraint |
|---|---|---|
| `permission_code` | VARCHAR(60) | PK |
| `description` | VARCHAR(255) | NN |

### 3.3 ROLE_PERMISSIONS

| Attribute | MySQL type | Key / constraint |
|---|---|---|
| `role_code` | VARCHAR(20) | PK part 1; NN |
| `permission_code` | VARCHAR(60) | PK part 2; FK → `PERMISSIONS.permission_code`; NN |

**Composite primary key:** `(role_code, permission_code)`.

**Important:** `role_code` has no FK constraint to `USERS.role`. The application uses a logical equality between these values when resolving permissions. `permission_code` is the only FK in this table.

### 3.4 SPECIALTIES

| Attribute | MySQL type | Key / constraint |
|---|---|---|
| `specialty_id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| `name` | VARCHAR(100) | NN, UK |
| `description` | VARCHAR(500) | NULL |
| `is_active` | BOOLEAN | NN, DEFAULT TRUE |

### 3.5 DOCTORS

| Attribute | MySQL type | Key / constraint |
|---|---|---|
| `doctor_id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| `user_id` | BIGINT UNSIGNED | NN, FK → `USERS.user_id`, UK |
| `specialty_id` | BIGINT UNSIGNED | NN, FK → `SPECIALTIES.specialty_id` |
| `qualification` | VARCHAR(180) | NULL |
| `years_experience` | TINYINT UNSIGNED | NN, DEFAULT 0 |
| `consultation_fee` | DECIMAL(10,2) | NN, DEFAULT 0, CHECK >= 0 |
| `bio` | TEXT | NULL |
| `is_accepting_patients` | BOOLEAN | NN, DEFAULT TRUE |
| `created_at` | TIMESTAMP | NN, DEFAULT CURRENT_TIMESTAMP |

The unique constraint on `user_id` limits a user to at most one doctor profile.

### 3.6 APPOINTMENT_SLOTS

| Attribute | MySQL type | Key / constraint |
|---|---|---|
| `slot_id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| `doctor_id` | BIGINT UNSIGNED | NN, FK → `DOCTORS.doctor_id` |
| `starts_at` | DATETIME | NN |
| `ends_at` | DATETIME | NN |
| `status` | ENUM('AVAILABLE','BOOKED','BLOCKED') | NN, DEFAULT 'AVAILABLE' |
| `created_at` | TIMESTAMP | NN, DEFAULT CURRENT_TIMESTAMP |

**Composite unique key:** `(doctor_id, starts_at)`.

**CHECK constraint:** `ends_at > starts_at`.

### 3.7 TRIAGE_SESSIONS

| Attribute | MySQL type | Key / constraint |
|---|---|---|
| `triage_id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| `patient_id` | BIGINT UNSIGNED | NN, FK → `USERS.user_id` |
| `symptom_text` | TEXT | NN |
| `urgency` | ENUM('ROUTINE','SOON','URGENT','EMERGENCY') | NN, DEFAULT 'ROUTINE' |
| `urgency_score` | TINYINT UNSIGNED | NN, DEFAULT 0 |
| `safety_flags` | JSON | NULL |
| `top_matches` | JSON | NULL |
| `created_at` | TIMESTAMP | NN, DEFAULT CURRENT_TIMESTAMP |

### 3.8 APPOINTMENTS

| Attribute | MySQL type | Key / constraint |
|---|---|---|
| `appointment_id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| `patient_id` | BIGINT UNSIGNED | NN, FK → `USERS.user_id` |
| `doctor_id` | BIGINT UNSIGNED | NN, FK → `DOCTORS.doctor_id` |
| `slot_id` | BIGINT UNSIGNED | NN, FK → `APPOINTMENT_SLOTS.slot_id` |
| `triage_id` | BIGINT UNSIGNED | NULL, FK → `TRIAGE_SESSIONS.triage_id`, ON DELETE SET NULL |
| `status` | ENUM('BOOKED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW') | NN, DEFAULT 'BOOKED' |
| `urgency` | ENUM('ROUTINE','SOON','URGENT','EMERGENCY') | NN, DEFAULT 'ROUTINE' |
| `reason` | TEXT | NULL |
| `booked_at` | TIMESTAMP | NN, DEFAULT CURRENT_TIMESTAMP |

There is deliberately no unique constraint on `appointments.slot_id`: historical appointment rows can remain after cancellation and the released slot can be booked again. Booking logic, row locks and triggers protect current slot availability.

### 3.9 PRESCRIPTIONS

| Attribute | MySQL type | Key / constraint |
|---|---|---|
| `prescription_id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| `appointment_id` | BIGINT UNSIGNED | NN, FK → `APPOINTMENTS.appointment_id` |
| `doctor_id` | BIGINT UNSIGNED | NN, FK → `DOCTORS.doctor_id` |
| `patient_id` | BIGINT UNSIGNED | NN, FK → `USERS.user_id` |
| `diagnosis_notes` | TEXT | NULL |
| `medication_name` | VARCHAR(180) | NN |
| `dosage` | VARCHAR(120) | NULL |
| `instructions` | TEXT | NULL |
| `prescribed_at` | TIMESTAMP | NN, DEFAULT CURRENT_TIMESTAMP |

Database triggers verify that the prescription's appointment, patient and doctor references agree.

### 3.10 APPOINTMENT_AUDIT

| Attribute | MySQL type | Key / constraint |
|---|---|---|
| `audit_id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| `appointment_id` | BIGINT UNSIGNED | NN, FK → `APPOINTMENTS.appointment_id` |
| `action` | VARCHAR(30) | NN |
| `old_status` | VARCHAR(20) | NULL |
| `new_status` | VARCHAR(20) | NULL |
| `changed_at` | TIMESTAMP | NN, DEFAULT CURRENT_TIMESTAMP |

The appointment reference is enforced by a foreign key in the current schema.

### 3.11 APPOINTMENT_RESCHEDULE_AUDIT

| Attribute | MySQL type | Key / constraint |
|---|---|---|
| `reschedule_id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| `appointment_id` | BIGINT UNSIGNED | NN, FK → `APPOINTMENTS.appointment_id` |
| `old_slot_id` | BIGINT UNSIGNED | NN, FK → `APPOINTMENT_SLOTS.slot_id` |
| `new_slot_id` | BIGINT UNSIGNED | NN, FK → `APPOINTMENT_SLOTS.slot_id` |
| `changed_by` | BIGINT UNSIGNED | NN, FK → `USERS.user_id` |
| `changed_at` | TIMESTAMP | NN, DEFAULT CURRENT_TIMESTAMP |

The two slot foreign keys refer to different roles of the same parent table: the previous slot and the replacement slot.

## 4. Foreign-key relationship and cardinality matrix

| Parent relation | Child relation | FK in child | Cardinality | Meaning |
|---|---|---|---|---|
| USERS | DOCTORS | `user_id` | 1 : 0..1 | A user has at most one doctor profile |
| SPECIALTIES | DOCTORS | `specialty_id` | 1 : N | One specialty classifies many doctors |
| DOCTORS | APPOINTMENT_SLOTS | `doctor_id` | 1 : N | One doctor offers many slots |
| USERS | TRIAGE_SESSIONS | `patient_id` | 1 : N | One patient submits many triage sessions |
| USERS | APPOINTMENTS | `patient_id` | 1 : N | One patient books many appointments |
| DOCTORS | APPOINTMENTS | `doctor_id` | 1 : N | One doctor is assigned many appointments |
| APPOINTMENT_SLOTS | APPOINTMENTS | `slot_id` | 1 : N over history | One slot may be referenced by historical appointment rows over time |
| TRIAGE_SESSIONS | APPOINTMENTS | `triage_id` | 1 : 0..N; optional on appointment | An appointment can have no triage link or one triage link |
| APPOINTMENTS | PRESCRIPTIONS | `appointment_id` | 1 : N | An appointment can have multiple prescription rows |
| DOCTORS | PRESCRIPTIONS | `doctor_id` | 1 : N | A doctor can issue multiple prescriptions |
| USERS | PRESCRIPTIONS | `patient_id` | 1 : N | A patient can receive multiple prescriptions |
| APPOINTMENTS | APPOINTMENT_AUDIT | `appointment_id` | 1 : N | An appointment can have multiple status audit events |
| APPOINTMENTS | APPOINTMENT_RESCHEDULE_AUDIT | `appointment_id` | 1 : N | An appointment can have multiple reschedule events |
| USERS | APPOINTMENT_RESCHEDULE_AUDIT | `changed_by` | 1 : N | A user can perform multiple reschedules |
| APPOINTMENT_SLOTS | APPOINTMENT_RESCHEDULE_AUDIT | `old_slot_id` | 1 : N | Slot used as the old slot in history rows |
| APPOINTMENT_SLOTS | APPOINTMENT_RESCHEDULE_AUDIT | `new_slot_id` | 1 : N | Slot used as the new slot in history rows |
| PERMISSIONS | ROLE_PERMISSIONS | `permission_code` | 1 : N | A permission can be mapped to multiple roles |

## 5. Unique, check and index constraints

### Unique constraints

- `USERS.email`
- `SPECIALTIES.name`
- `DOCTORS.user_id`
- `APPOINTMENT_SLOTS(doctor_id, starts_at)`
- `ROLE_PERMISSIONS(role_code, permission_code)` is the composite primary key.

### Check constraints

- `DOCTORS.consultation_fee >= 0`
- `APPOINTMENT_SLOTS.ends_at > starts_at`

### Important indexes

- `USERS(role)`
- `ROLE_PERMISSIONS(permission_code)`
- `DOCTORS(specialty_id, is_accepting_patients)`
- `APPOINTMENT_SLOTS(status, starts_at, doctor_id)`
- `TRIAGE_SESSIONS(patient_id, created_at)`
- `TRIAGE_SESSIONS(urgency, created_at)`
- `APPOINTMENTS(slot_id)`
- `APPOINTMENTS(doctor_id, status)`
- `APPOINTMENTS(patient_id, booked_at)`
- `PRESCRIPTIONS(patient_id, prescribed_at)`
- `APPOINTMENT_AUDIT(appointment_id, changed_at)`
- `APPOINTMENT_RESCHEDULE_AUDIT(appointment_id, changed_at)`

## 6. Views and database objects

The two views are not base relations:

- `v_doctor_directory` — joins doctors, users and specialties.
- `v_appointment_details` — joins appointments, patient users, doctors, doctor users, specialties and appointment slots.

Stored function, procedure and triggers are defined in `db/schema.sql`; they enforce business rules and are not additional relations.

## 7. Vector-store boundary

Qdrant collection `medical_routing_v1` is separate from this relational schema. Its vectors and payloads are not MySQL tables and therefore do not appear as PK/FK relations here.
