# MediRoute — AI-Assisted Symptom Triage & Specialist Routing System

## Mini-project report

**Course:** Database Management Systems — Level 3  
**Project:** MediRoute  
**Database technologies:** MySQL 8.4 and Qdrant  
**Application:** Next.js 16, React 19 and TypeScript  
**Team members:** [Insert names and identifiers]  
**Faculty / section:** [Insert details]  
**Demo date:** [Insert scheduled date]

---

## Abstract

MediRoute is an educational prototype that demonstrates a hybrid database architecture for matching free-text symptom descriptions to relevant medical specialties. A patient enters a natural-language description. The application applies a simple rule-based urgency assessment and, for non-emergency results, embeds the text and searches a curated condition-to-specialty vector corpus in Qdrant. MySQL stores structured application data, including user accounts, role permissions, doctor profiles, specialties, appointment availability, triage sessions, appointments, prescriptions and audit history.

The project demonstrates the use of two database paradigms in one workflow. MySQL provides relational integrity, constraints, transactions, stored routines and triggers. Qdrant provides vector similarity search over text embeddings. A Next.js interface exposes separate patient, doctor and administrator workspaces, with API authorization resolved against a permission matrix stored in MySQL.

**Safety note:** MediRoute is not a diagnostic tool, medical device or emergency service. The urgency rules and vector corpus are demonstrative only and are not clinically validated.

## 1. Problem statement

Patients may be unsure which medical specialty is relevant to a concern described in everyday language. A purely keyword-based lookup can be brittle when patient wording differs from the terms used in a specialty directory. At the same time, a scheduling application must preserve reliable relational data and prevent conflicting bookings.

MediRoute addresses this as a database and information-retrieval problem: semantic matching is performed against a vector corpus, while operational records and booking integrity remain in a relational database.

## 2. Objectives

1. Accept free-text symptom descriptions through a web interface.
2. Generate sentence embeddings and retrieve semantically similar routing concepts.
3. Apply demonstrative urgency rules before suggesting routine specialist routing.
4. Maintain users, roles, doctors, specialties, slots, appointments and prescriptions in MySQL.
5. Enforce data integrity using keys, constraints, indexes, transactions, stored routines and triggers.
6. Demonstrate vector create/upsert, read/search and delete operations in Qdrant.
7. Provide separate patient, doctor and administrator workflows.
8. Demonstrate authorization backed by a role-permission mapping stored in MySQL.

## 3. System architecture

The browser interacts with a Next.js application. Server route handlers validate requests, read the signed session, check database-backed permissions and orchestrate the two databases.

- **Presentation layer:** Next.js App Router and React pages for registration, login, doctor directory and role-specific dashboards.
- **Application/API layer:** Next.js route handlers for authentication, triage, doctors, availability, appointments, prescriptions and administrator operations.
- **Relational data layer:** MySQL 8.4 with InnoDB tables, views, constraints, procedures, function and triggers.
- **Vector data layer:** Qdrant collection containing embedding vectors and payload metadata.
- **Embedding layer:** Transformers.js with Xenova/all-MiniLM-L6-v2, producing 384-dimensional vectors.

### Request flow

1. Patient authenticates and submits a symptom description.
2. API validates the input and obtains the patient's session.
3. MySQL stored procedure calculates the demonstrative urgency score and level.
4. When the level is not EMERGENCY, the text is embedded and searched against Qdrant using cosine similarity.
5. Retrieved specialty names are used to select active doctor profiles from MySQL.
6. Patient may inspect available slots and book one.
7. MySQL transaction and row lock protect the booking; triggers validate the slot and update slot/audit state.

## 4. Technology selection and justification

### MySQL 8.4 / InnoDB

MySQL stores entities with stable identifiers and relationships. Foreign keys, unique constraints, CHECK constraints and indexes protect data integrity. InnoDB transactions and SELECT FOR UPDATE prevent two concurrent booking attempts from reserving the same currently available slot.

### Qdrant

The routing corpus is suited to semantic nearest-neighbour retrieval rather than exact relational matching. Qdrant stores dense vectors and payload fields such as condition, specialty, keywords and source. The application uses cosine similarity and retrieves up to five candidates. The specialty payload index supports metadata filtering.

### Sentence embedding model

Xenova/all-MiniLM-L6-v2 is used through Transformers.js to generate 384-dimensional sentence embeddings. It enables the prototype to compare meaning across different phrasings. It is not a medical model and does not establish diagnosis, risk probability or treatment.

### Next.js, React and TypeScript

Next.js provides the user interface and server API routes in one application. Authentication and database calls remain server-side. TypeScript supports typed request and database handling.

### Supporting tools

mysql2 provides pooled MySQL access; Qdrant JS client manages collections and points; bcryptjs hashes passwords; jose signs JWT sessions; Zod validates API payloads; Docker Compose starts the database services; GitHub Actions runs integration and build checks.

## 5. ER model and relational schema

The schema-aligned ER diagram is maintained in docs/ER_DIAGRAM.md. The user-supplied conceptual ER diagram is mapped to the implemented model as follows:

- PATIENT, DOCTOR and ADMIN are roles in the shared users table.
- SYMPTOM_REPORT is represented by triage_sessions.
- DOCTOR profiles are stored separately from login identity in doctors.
- APPOINTMENT availability is split into appointment_slots and appointments.
- SPECIALTY, PRESCRIPTION and appointment administration concepts remain represented.

### Main relations

| Relation | Primary key | Important foreign keys / constraints |
|---|---|---|
| users | user_id | email UNIQUE; role ENUM |
| permissions | permission_code | permission description |
| role_permissions | (role_code, permission_code) | permission_code references permissions |
| specialties | specialty_id | name UNIQUE |
| doctors | doctor_id | user_id references users and is UNIQUE; specialty_id references specialties; fee CHECK |
| appointment_slots | slot_id | doctor_id references doctors; ends_at > starts_at; doctor/start UNIQUE |
| triage_sessions | triage_id | patient_id references users; urgency and indexes |
| appointments | appointment_id | patient_id, doctor_id, slot_id and optional triage_id reference parent rows |
| prescriptions | prescription_id | appointment_id, doctor_id and patient_id reference parent rows |
| appointment_audit | audit_id | appointment_id is retained as an audit reference; no declared FK in current schema |

## 6. SQL implementation and DBMS concepts

The executable schema is db/schema.sql.

### DDL and integrity

The schema defines tables, primary keys, foreign keys, unique keys, CHECK constraints and indexes. Views v_doctor_directory and v_appointment_details encapsulate frequently used joins.

### DML

db/dml_examples.sql demonstrates INSERT, SELECT, UPDATE and DELETE within a transaction. It rolls back the temporary row after the demonstration.

### Query classes

db/query_showcase.sql contains:

- JOIN query across doctors, users and specialties.
- Nested subquery comparing consultation fees with the average.
- Correlated EXISTS query for doctors with future available slots.
- Correlated aggregate query comparing active bookings with the average.
- Non-recursive CTE aggregating appointments by specialty.
- Recursive CTE generating a 14-day calendar and counting available slots.
- Window-function ranking of doctors by consultation fee within each specialty.
- View-based appointment-detail query.

### Stored function and procedure

fn_urgency_level maps a numeric score to ROUTINE, SOON, URGENT or EMERGENCY. sp_calculate_urgency evaluates selected warning phrases and returns a score and level. These rules are for demonstrating database routines only.

### Triggers

Appointment triggers validate slot status and doctor ownership, validate triage ownership, block booking from an emergency triage session, mark slots BOOKED, release slots following cancellation, reject invalid reopening of closed appointments and write status-change audit entries.

### Transaction management

Appointment creation uses an InnoDB transaction and locks the selected slot row with SELECT ... FOR UPDATE. A trigger independently checks slot validity before the row is inserted.

## 7. NoSQL/vector model and operations

Qdrant collection: medical_routing_v1 (configurable through environment variables).  
Vector size: 384 dimensions.  
Distance: cosine.  
Search limit: top five semantic matches.

Each point contains an embedding and a payload with the entry key, condition, description, specialty, keywords and source.

- **Create:** the administrator submits a new routing entry; the API embeds it and upserts a Qdrant point.
- **Read:** triage searches by vector similarity; the admin console lists stored payloads.
- **Update:** the same entry key derives the same point ID; upsert updates that vector/payload.
- **Delete:** an administrator deletes the point by entry key.

The vector CRUD smoke test creates a disposable point, retrieves it, updates it through upsert, and deletes it.

## 8. Authentication and database-backed RBAC

Passwords are hashed with bcryptjs. Sessions are signed JWTs in HTTP-only cookies. Public registration creates PATIENT accounts; seeded and administrator-provisioned accounts demonstrate DOCTOR and ADMIN.

The users table stores the application role. permissions stores supported permissions, and role_permissions maps roles to permission codes. The API's hasPermission helper joins the authenticated user to this mapping in MySQL before sensitive operations. Ownership checks are also applied to appointment and prescription operations.

The optional db/database_roles.sql file illustrates native MySQL roles for a DBA discussion. The web application itself uses one service database account and does not switch native database accounts per end-user request; the live application authorization mechanism is the MySQL permission matrix.

## 9. Interface and API modules

- Patient: registration, login, free-text symptom entry, semantic specialist matches, slot selection, booking/cancellation, prescription history.
- Doctor: assigned appointment queue, availability management, visit completion and prescription entry.
- Administrator: doctor creation and intake pause/resume; routing-corpus listing, upsert and deletion.
- APIs: auth, doctors, slots, triage, appointments, records, admin doctors and admin corpus.

## 10. Testing and verification

GitHub Actions runs the project against disposable MySQL 8.4 and Qdrant services. The workflow executes:

1. Dependency installation.
2. MySQL schema initialization and demo seeding.
3. Stored function, procedure, RBAC, emergency guard, booking, duplicate-prevention, cancellation, slot-release and audit tests.
4. The SQL DML and query showcase files.
5. Rule-based triage smoke test.
6. Qdrant seed and semantic retrieval plus create/upsert, read and delete tests.
7. Next.js production build.

The successful workflow for the latest code at the time of this report is linked from the repository Actions tab. A CI pass confirms the automated checks; a live browser walkthrough is still required for the presentation.

## 11. Originality and contribution

The project combines semantic text retrieval with relational scheduling and database-enforced booking integrity. The distinction between vector similarity and transactional source-of-truth data is a central design choice. Additional demonstrable features include database-backed permission lookup, emergency booking guard, appointment audit triggers, stable-key vector upserts and administrator-managed routing concepts.

### Individual contribution record — complete with actual team evidence

| Team member | Modules personally implemented | SQL/API/UI contribution | Commits/PRs/issues | Viva section |
|---|---|---|---|---|
| [Name 1] | [Fill in] | [Fill in] | [Link commits/PRs] | [Fill in] |
| [Name 2] | [Fill in] | [Fill in] | [Link commits/PRs] | [Fill in] |
| [Name 3] | [Fill in] | [Fill in] | [Link commits/PRs] | [Fill in] |
| [Name 4] | [Fill in] | [Fill in] | [Link commits/PRs] | [Fill in] |

Do not claim work performed by another member. Use GitHub commits, reviewed pull requests, issue assignments and working demonstrations as evidence.

## 12. Limitations and future enhancements

- The urgency rules are simple phrase patterns and have not been clinically validated.
- The corpus is small and synthetic; it is not a medical reference source.
- Similarity scores are not probabilities and must not be interpreted as diagnoses.
- There is no hospital-system interoperability, payment, notification or production deployment workflow.
- A production system would require clinical governance, privacy/legal review, stronger operational monitoring, rate limiting, CSRF/security review, backups, access auditing and validated clinical content.

## 13. Conclusion

MediRoute demonstrates how a relational database and a vector database can serve complementary roles in a single application. MySQL manages structured data, consistency and transactions. Qdrant performs semantic retrieval over embeddings. The Next.js application connects both databases through authenticated, validated and permission-checked APIs. The project provides a base for demonstrating DDL, DML, joins, nested and correlated queries, CTEs, stored routines, triggers, transactions, vector operations and role-based access.

## References and repository artefacts

- Source repository: https://github.com/GGO4411/MediRoute
- ER diagram: docs/ER_DIAGRAM.md
- Technology justification: docs/TECHNOLOGY_JUSTIFICATION.md
- SQL examples: db/dml_examples.sql and db/query_showcase.sql
- Permission matrix: db/database_rbac.sql
- Demo instructions: docs/DEMO_GUIDE.md
