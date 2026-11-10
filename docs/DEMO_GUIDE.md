# MediRoute mini-project demo guide

## Suggested demonstration order

1. Start MySQL and Qdrant with docker compose up -d; install dependencies and
   seed the MySQL records and vector corpus.
2. Sign in as the patient. Submit a non-emergency symptom description and
   explain embedding generation and the top semantic matches.
3. Select a specialist and book a slot. Show the appointment row and slot
   changing from AVAILABLE to BOOKED.
4. Explain the transaction, row lock and database trigger that protect booking.
5. Sign in as a doctor. Show the assigned queue, add availability, complete a
   confirmed appointment and create a prescription.
6. Sign in as admin. Create or pause a doctor; create, update and delete a
   routing-corpus entry. Explain how Qdrant stores vectors and metadata.
7. Show the ER diagram, relational schema, permission matrix, SQL showcase,
   stored function, procedure, triggers and audit history.
8. Finish with limitations and each member's individual contribution.

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

## Viva questions to prepare

- Why are both MySQL and Qdrant needed? What data belongs in each?
- How does cosine similarity differ from a keyword match?
- Why do we use a transaction and SELECT ... FOR UPDATE during booking?
- What does each foreign key and uniqueness constraint protect?
- How do triggers update slot status and write audit rows?
- What does the stored procedure calculate? What does the function return?
- How does the recursive CTE generate the next 14 days?
- How are roles mapped to permissions in MySQL and checked by APIs?
- Why is a similarity score not a medical diagnosis or probability?
- What limitations remain in the corpus and urgency rules?

## Individual contribution record

Each member should prepare a factual summary of the modules they personally
implemented, SQL objects they wrote, commits/PRs they reviewed, bugs they fixed
and demo steps they can explain. Do not claim another member's work.
