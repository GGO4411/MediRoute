# MediRoute technology justification

## MySQL 8.4 / InnoDB — relational and transactional records

MySQL stores users, role assignments, specialists, appointment availability,
triage history, bookings, prescriptions and audit history. These records have
stable identifiers and explicit relationships. Primary/foreign keys, unique
constraints, CHECK constraints and indexes protect integrity. InnoDB
transactions and row locks make slot booking safe when patients concurrently
attempt to reserve the same slot. Procedures and triggers demonstrate
database-side business rules and auditing.

## Qdrant — vector search over natural-language symptom descriptions

The condition-to-specialty corpus is semantic rather than naturally relational.
Qdrant stores dense 384-dimensional embeddings alongside payload metadata such
as condition, specialty, keywords and source. Cosine similarity retrieves
semantically related routing concepts even when the patient's wording does
not exactly match a corpus keyword. Qdrant complements rather than replaces
MySQL: appointments and patient records remain relational and transactional.

## Embedding model — Xenova/all-MiniLM-L6-v2

This model produces 384-dimensional sentence embeddings and can run locally
through Transformers.js. It is small enough for an educational prototype.
It is not a medical model and does not diagnose or validate urgency. The corpus
is small and synthetic for database demonstration purposes.

## Next.js 16 / React 19 / TypeScript

Next.js provides patient, doctor and administrator interfaces plus server
route handlers. Authentication, validation and database calls remain on the
server while React renders the user interface. TypeScript makes API payloads
and database integrations more explicit.

## Supporting technologies

- mysql2: pooled MySQL connections and prepared statements.
- Qdrant JS client: collection, point and similarity-search operations.
- Transformers.js: local embedding inference.
- bcryptjs: password hashing.
- jose: signed JWT sessions in HTTP-only cookies.
- zod: API request validation.
- Docker Compose: repeatable local MySQL and Qdrant services.
- GitHub Actions: automated database, vector and production-build checks.

## Why use a hybrid database design?

A relational database is suited to constrained records, referential integrity
and transactions. A vector database is suited to nearest-neighbour search over
embeddings. Each database is used for the workload it handles best; vector
similarity is never treated as the source of truth for appointments or roles.

## Trade-offs and limitations

Qdrant is an additional service to operate. Initial model download needs
network access. Similarity scores are not probabilities or diagnoses.
Keyword urgency rules are unvalidated and can miss emergencies. This is an
academic prototype and must not be used for clinical decisions.
