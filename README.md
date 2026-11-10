# MediRoute — AI-Assisted Symptom Triage & Specialist Routing

MediRoute is a DBMS Level 3 project prototype. Patients describe symptoms in natural language. The application embeds the description and searches a curated condition-to-specialty corpus in Qdrant. MySQL stores structured operational data: user accounts, doctors, slots, appointments, prescriptions, triage history and audit records.

> **Safety and intended use:** This is an educational prototype, not a medical device, diagnostic system or emergency service. Similarity scores are not probabilities. The keyword urgency rules are unvalidated and can miss emergencies or over-flag benign descriptions. Never use MediRoute to rule out a condition or delay medical care. For a suspected emergency, contact local emergency services or go to the nearest emergency department.

## Technology

- Next.js 16 App Router, React 19, TypeScript
- MySQL 8.4 / InnoDB for relational data
- Qdrant for vector storage and similarity search
- Embeddings: `Xenova/all-MiniLM-L6-v2`, 384-dimensional sentence vectors
- Similarity metric: cosine; top-5 nearest neighbours
- Authentication: HTTP-only signed JWT cookie and bcrypt password hashing
- Request validation: Zod; relational integrity: foreign keys, checks, indexes, triggers

## Implemented functionality

- Patient registration and login; role-based accounts for PATIENT, DOCTOR and ADMIN
- Free-text symptom submission and vector search over a curated sample routing corpus
- Rule-based urgency flagging for selected red-flag phrases (not clinical-grade triage)
- Specialist directory and specialty/name filtering
- Available appointment-slot search and transaction-safe booking
- Appointment status management, with an audit trigger, slot release on cancellation and closed-state transition guards
- Doctor availability creation/removal with overlap checks and safe deletion of unbooked future slots
- Patient appointment and prescription history
- Doctor appointment queue and prescription creation (ownership verified in API)
- Admin interface to create and pause doctor profiles, and embed/add curated routing concepts to Qdrant

## Requirements

- Node.js 20.9 or later (Node 22 recommended)
- Docker Desktop / Docker Engine with Compose
- npm

## Run locally

1. Clone the repository:

   ```bash
   git clone https://github.com/GGO4411/MediRoute.git
   cd MediRoute
   ```

2. Create local configuration and set a private signing key:

   ```bash
   cp .env.example .env
   ```

   Set `AUTH_SECRET` to a random string of at least 32 characters (for example, `openssl rand -base64 48`). Never commit `.env`.

3. Start MySQL and Qdrant:

   ```bash
   docker compose up -d
   ```

   MySQL runs `db/schema.sql` automatically when its data volume is first initialized. Wait until `docker compose ps` shows MySQL as healthy before seeding. If a MySQL volume already exists and you need to reapply the schema, run `npm run db:init` (the initializer understands the `DELIMITER` blocks used for triggers and the stored procedure).

4. Install packages and populate demo records:

   ```bash
   npm install
   npm run db:seed
   npm run vectors:seed
   ```

   The embedding model is downloaded the first time vector seeding or symptom search runs, so an internet connection is needed for the initial model download. Appointment `DATETIME` values are stored in UTC and rendered in each browser's local timezone.

5. Start Next.js:

   ```bash
   npm run dev
   ```

   Visit http://localhost:3000.

### Demo logins

Seeded accounts all use `DemoPass123!`:

| Role | Email |
|---|---|
| Patient | `patient@mediroute.local` |
| Doctor | `asha.rao@mediroute.local` |
| Doctor | `vikram.sen@mediroute.local` |
| Doctor | `meera.nair@mediroute.local` |
| Admin | `admin@mediroute.local` |

Public registration creates PATIENT accounts only. Doctor and administrator accounts are pre-seeded for demonstration and should be provisioned by a trusted administrator in any real application. Change demo passwords before sharing a deployment.

## Database design and DBMS concepts

- `db/schema.sql`: users, specialties, doctors, appointment_slots, triage_sessions, appointments, prescriptions and appointment_audit.
- `db/migrations.sql`: optional one-time `ALTER TABLE` example adding `preferred_language`; do not run it more than once.
- `db/ddl_examples.sql`: commented `ALTER`/`DROP` statements for demonstrating schema changes and rollback in a disposable database.
- Primary keys, foreign keys, unique constraints, CHECK constraints, and secondary indexes enforce consistency and support reads.
- The permissions and role_permissions tables store the database-backed authorization matrix. Protected API handlers resolve the live user's database role to permission codes before sensitive operations.
- See docs/ER_DIAGRAM.md, db/dml_examples.sql, db/query_showcase.sql and db/database_rbac.sql for the demo artefacts.
- `v_doctor_directory` and `v_appointment_details` encapsulate common joins.
- `sp_calculate_urgency` is a stored procedure illustrating database-side rule scoring.
- Triggers verify slot status/doctor ownership and triage ownership, reject emergency-triage bookings, mark slots booked after insertion, release slots on cancellation, prevent reopening closed bookings, and write status-change audit rows.
- Appointment booking uses an InnoDB transaction and `SELECT ... FOR UPDATE` to serialize concurrent attempts for the same slot. The insert trigger acts as a second database-level check.
- Qdrant stores embedding vectors and payload metadata (`condition`, `description`, `specialty`, `keywords`, `source`). The payload index on `specialty` supports filtering/metadata operations.

### Important SQL examples

```sql
-- JOIN and ORDER BY
SELECT * FROM v_appointment_details ORDER BY starts_at;

-- GROUP BY, aggregate and HAVING
SELECT specialty, COUNT(*) AS doctor_count, AVG(consultation_fee) AS average_fee
FROM v_doctor_directory
GROUP BY specialty
HAVING COUNT(*) >= 1;

-- Subquery: doctors with a future available slot
SELECT doctor_id FROM doctors d
WHERE EXISTS (
  SELECT 1 FROM appointment_slots s
  WHERE s.doctor_id=d.doctor_id AND s.status='AVAILABLE' AND s.starts_at>UTC_TIMESTAMP()
);

-- Trigger audit history
SELECT * FROM appointment_audit ORDER BY changed_at DESC;

-- Stored procedure
CALL sp_calculate_urgency('persistent headache and light sensitivity', @score, @level);
SELECT @score AS urgency_score, @level AS urgency_level;
```

## Demo SQL and DBMS artefacts

Run the analytical examples with:

~~~bash
mysql -h 127.0.0.1 -u root -p mediroute < db/query_showcase.sql
~~~

The query showcase includes joins, nested and correlated subqueries, aggregate
queries, window functions, a CTE and a recursive CTE generating a 14-day calendar.
The DML script demonstrates INSERT, SELECT, UPDATE and DELETE inside a transaction
that is rolled back after the demonstration:

~~~bash
mysql -h 127.0.0.1 -u root -p mediroute < db/dml_examples.sql
~~~

Inspect the database role-to-permission matrix with:

~~~sql
SELECT role_code,permission_code FROM role_permissions ORDER BY role_code,permission_code;
~~~

db/database_roles.sql contains optional native MySQL-role examples for a DBA
discussion. The web app uses one service DB account and enforces each end user's
permissions by looking up their role in MySQL; it does not switch native DB roles
for every HTTP request.

## Main API routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register a patient |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Clear session cookie |
| GET | `/api/auth/me` | Current session |
| GET | `/api/doctors` | Active specialist directory |
| GET | `/api/slots?doctorId=ID` | Public available future slots for one doctor |
| GET | `/api/slots?mine=1` | Doctor/admin availability management list |
| POST | `/api/slots` | Doctor creates a future 30–180 minute availability slot |
| DELETE | `/api/slots?slotId=ID` | Doctor/admin removes an unused future slot |
| POST | `/api/triage` | Run MySQL urgency scoring, then embed/search/save triage unless an emergency flag pauses routing |
| GET/POST/PATCH | `/api/appointments` | List, book and update authorized appointments |
| GET/POST | `/api/records` | List and create prescriptions |
| GET/POST/PATCH | `/api/admin/doctors` | Admin-only specialist directory listing, doctor creation and profile/availability status updates |
| GET/POST/DELETE | `/api/admin/corpus` | Admin-only vector corpus listing, upsert and delete |

## Tests and checks

Run the deterministic urgency-rule smoke test:

```bash
npm run test:triage
npm run test:db
npm run test:vectors
```

`test:db` requires the MySQL schema and seed data (`npm run db:init` and `npm run db:seed`). It checks the stored function and procedure, database permission matrix, emergency booking guard, slot booking/duplicate prevention, cancellation, slot reuse and audit trigger. The GitHub Actions workflow runs these checks against disposable MySQL 8.4 and Qdrant services. `test:vectors` requires Qdrant to be running and the sample vector corpus to have been seeded with `npm run vectors:seed`. It checks semantic retrieval and vector create/upsert, read and delete operations.

Manual DB/application checks:
1. Register a patient; verify the DB contains a bcrypt hash, never the original password.
2. Log in with correct credentials; incorrect credentials should return HTTP 401.
3. Submit a symptom phrase such as “one-sided throbbing headache with light sensitivity”; verify vector matches and a triage row.
4. Submit a red-flag phrase such as “chest pain and difficulty breathing”; verify the emergency warning is shown. This checks only the demo rule, not clinical safety.
5. In two sessions, try booking the same slot. The first booking should succeed and the second should receive HTTP 409.
6. Confirm a booked slot no longer appears in available slots.
7. Cancel a test appointment and confirm the slot is released and the audit row is written.
8. Verify doctors can prescribe only for their own appointments and non-admins receive HTTP 403 from the corpus API.

## Repository structure

- `app/`: Next.js pages and route handlers
- `components/`: shared UI
- `lib/`: MySQL, auth, embeddings, Qdrant and urgency services
- `db/`: schema and optional migration examples
- `scripts/`: relational and vector seed scripts
- `tests/`: simple urgency rule smoke test
- `scripts/test-db.ts` and `scripts/test-vectors.ts`: MySQL and Qdrant integration checks

## Reset local demo data

**This deletes local MySQL and Qdrant volumes.**

```bash
docker compose down -v
docker compose up -d
npm run db:seed
npm run vectors:seed
```

## Prototype boundaries

- The warning rules are simple text patterns and are not validated for clinical use. A potential emergency result deliberately skips Qdrant specialist matching and online booking; this is a protective demonstration behaviour, not a validated triage guarantee.
- The seed vector corpus is small, synthetic and for demonstrating semantic retrieval only; it is not an authoritative medical knowledge base.
- No payments, notifications, interoperability with hospital systems, clinical verification, consent workflow or production-grade deployment controls are included.
- The formal academic report, presentation slides, deployment screenshots and individual-contribution statements still need to be prepared by the team. The repository includes a schema-accurate ER diagram, SQL showcase and technical/demo notes.
