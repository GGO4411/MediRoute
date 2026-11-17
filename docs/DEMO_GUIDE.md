# MediRoute mini-project demo guide

## Suggested demonstration order

1. Start MySQL and Qdrant with docker compose up -d; install dependencies and
   seed the MySQL records and vector corpus.
2. Sign in as the patient. Submit a non-emergency symptom description and
   explain embedding generation and the top semantic matches.
3. Select a specialist and book a slot. Show the appointment row and slot
   changing from AVAILABLE to BOOKED.
4. Explain the transaction, row lock and database trigger that protect booking.
5. Return to the patient workspace. Filter the paginated history by upcoming,
   past, completed, cancelled or another status. The Past filter includes
   completed visits based on their slot start time. Reschedule an active visit to another future slot for
   the same doctor, then expand its history to show status/reschedule events.
   Explain that the old slot is released and the new slot reserved in one transaction.
6. Sign in as a doctor. Show the assigned queue, add availability, complete a
   confirmed appointment and create a prescription.
7. Sign in as admin. Create or pause a doctor; create, update and delete a
   routing-corpus entry. Explain how Qdrant stores vectors and metadata.
8. Show `docs/ER_DIAGRAM.pdf`, `docs/RELATIONAL_SCHEMA.pdf`, the permission matrix, SQL showcase,
   stored function, procedure, triggers and audit history.
9. Finish with limitations and each member's individual contribution.

## Demo accounts

All seeded accounts use password DemoPass123!:

- Patient: patient@mediroute.local
- Doctors: asha.rao@mediroute.local, vikram.sen@mediroute.local,
  meera.nair@mediroute.local
- Admin: admin@mediroute.local

Change these credentials before sharing a deployment. Do not use real patient
details or real medical information in the demonstration.

## SQL demonstration files

- db/schema.sql: DDL, constraints, views, permission matrix, function,
  procedure and triggers.
- db/dml_examples.sql: transaction-safe INSERT, SELECT, UPDATE and DELETE.
- db/query_showcase.sql: JOINs, nested/correlated subqueries, CTE,
  recursive CTE, aggregation and window functions.
- db/database_rbac.sql: inspect the application permission matrix.
- db/database_roles.sql: optional native MySQL roles for a DBA discussion.
- db/appointment_rescheduling.sql: idempotent one-time migration for reschedule permission and audit records.
- db/migrations/20261117_appointment_integrity.sql: checks for legacy orphan/mismatched rows, adds the appointment-audit foreign key, and installs slot-move and prescription-consistency triggers. Apply it to existing databases before running the integrity tests.

## Rescheduling integration test

After applying the current schema/migrations and seeding records, run `npm run test:reschedule`. It invokes the actual reschedule route and checks patient ownership, a closed appointment, an unavailable target, a successful move, database integrity guards, a rollback when writing the audit record fails, and two concurrent requests for one target slot. The script cleans up only the test rows it creates.

Run `npm run typecheck`, `npm run lint`, and `npm run build` as part of the verification walkthrough. CI runs these checks and the rescheduling route test against disposable MySQL and Qdrant services.

## Viva questions to prepare

- Why are both MySQL and Qdrant needed? What data belongs in each?
- How does cosine similarity differ from a keyword match?
- Why do we use a transaction and SELECT ... FOR UPDATE during booking?
- How does rescheduling atomically release one slot and reserve another, and what does the audit table preserve?
- What does each foreign key and uniqueness constraint protect?
- How do triggers update slot status and write audit rows?
- What does the stored procedure calculate? What does the function return?
- How does the recursive CTE generate the next 14 days?
- How are roles mapped to permissions in MySQL and checked by APIs?
- How do `SELECT ... FOR UPDATE`, a conditional update and rollback prevent concurrent status/reschedule requests from leaving inconsistent data?
- How does pagination with a stable tie-breaker preserve deterministic appointment ordering?
- Why is a similarity score not a medical diagnosis or probability?
- What limitations remain in the corpus and urgency rules?

## Individual contribution record

Each member should prepare a factual summary of the modules they personally
implemented, SQL objects they wrote, commits/PRs they reviewed, bugs they fixed
and demo steps they can explain. Do not claim another member's work.
