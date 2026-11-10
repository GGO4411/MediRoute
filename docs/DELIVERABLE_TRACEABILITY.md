# Mini-project demo deliverable traceability

| Required deliverable | Repository evidence | How to demonstrate |
|---|---|---|
| ER diagram | docs/ER_DIAGRAM.md | Open the Mermaid ER diagram; discuss why user roles share users and why slots are a separate table. |
| Relational schema, keys, relationships, constraints | db/schema.sql | Show SHOW CREATE TABLE for doctors, appointment_slots, appointments and prescriptions. |
| SQL DDL with constraints | db/schema.sql | Show primary/foreign keys, UNIQUE, CHECK and indexes. |
| NoSQL/vector database | lib/vector.ts, scripts/seed-vectors.ts, docker-compose.yml | Show the Qdrant collection, 384D vector configuration and payload schema. |
| Technology justification | docs/TECHNOLOGY_JUSTIFICATION.md | Explain what belongs in MySQL vs Qdrant and why. |
| DML | db/dml_examples.sql | Run the transaction-safe DML showcase. |
| Nested, correlated, recursive and join queries | db/query_showcase.sql | Demonstrate the numbered query examples. |
| Procedures/functions, triggers and CTEs | db/schema.sql, db/query_showcase.sql | Show fn_urgency_level, sp_calculate_urgency, appointment triggers and recursive/non-recursive CTEs. |
| Vector RUD operations | app/api/admin/corpus/route.ts, app/dashboard/page.tsx, scripts/test-vectors.ts | Admin create/update/delete; patient semantic search; admin list. |
| Next.js interface | app/ and components/ | Walk through patient, doctor and admin dashboards. |
| Backend/API and DB integration | app/api/, lib/ | Explain the triage-to-vector-to-MySQL flow and transactional booking. |
| Authentication and at least two roles | app/api/auth/, lib/auth.ts, db/schema.sql | Login as patient, doctor and admin; show the role_permissions rows and hasPermission lookup. |
| Documentation and Git/GitHub | README.md, docs/, .github/workflows/ci.yml | Open report, setup guide, SQL examples and successful Actions run. |
| Originality | triage, vector, appointment and audit modules | Demonstrate semantic routing, urgency gating, transaction-safe booking and vector admin management. |
| Individual contribution and viva | docs/PROJECT_REPORT.md contribution table, GitHub commit history | Each member fills their actual contribution evidence and prepares the viva prompts in docs/DEMO_GUIDE.md. |

## Items that require team-specific input

- Add actual names, university/section, faculty details and demo date to the report.
- Fill in the individual contribution table using real commits, issues, PRs and code ownership.
- Capture application screenshots on the team's local environment.
- Rehearse the live browser flow and ensure MySQL and Qdrant are running before the slot.
