# MediRoute Entity–Relationship Diagram

This is the Chen-style ER diagram for the current MySQL implementation in `db/schema.sql`. It uses entity rectangles, relationship diamonds, attribute ovals, and cardinality labels, matching the conventional ER format used in the project reference.

## Chen ER diagram

```mermaid
flowchart LR
  subgraph ACCESS["Identity, access and specialist directory"]
    U[USERS]
    u1(["user_id · PK"])
    u2(["full_name"])
    u3(["email · UK"])
    u4(["password_hash"])
    u5(["role"])
    u6(["phone"])
    u7(["created_at"])
    u8(["updated_at"])
    U --- u1 & u2 & u3 & u4 & u5 & u6 & u7 & u8

    S[SPECIALTIES]
    s1(["specialty_id · PK"])
    s2(["name · UK"])
    s3(["description"])
    s4(["is_active"])
    S --- s1 & s2 & s3 & s4

    D[DOCTORS]
    d1(["doctor_id · PK"])
    d2(["user_id · FK, UK"])
    d3(["specialty_id · FK"])
    d4(["qualification"])
    d5(["years_experience"])
    d6(["consultation_fee"])
    d7(["bio"])
    d8(["is_accepting_patients"])
    d9(["created_at"])
    D --- d1 & d2 & d3 & d4 & d5 & d6 & d7 & d8 & d9

    P[PERMISSIONS]
    p1(["permission_code · PK"])
    p2(["description"])
    P --- p1 & p2

    RP[ROLE_PERMISSIONS]
    rp1(["role_code · composite PK"])
    rp2(["permission_code · composite PK, FK"])
    RP --- rp1 & rp2
  end

  subgraph CARE["Patient triage, appointment and records"]
    T[TRIAGE_SESSIONS]
    t1(["triage_id · PK"])
    t2(["patient_id · FK"])
    t3(["symptom_text"])
    t4(["urgency"])
    t5(["urgency_score"])
    t6(["safety_flags · JSON"])
    t7(["top_matches · JSON"])
    t8(["created_at"])
    T --- t1 & t2 & t3 & t4 & t5 & t6 & t7 & t8

    SL[APPOINTMENT_SLOTS]
    sl1(["slot_id · PK"])
    sl2(["doctor_id · FK"])
    sl3(["starts_at"])
    sl4(["ends_at"])
    sl5(["status"])
    sl6(["created_at"])
    SL --- sl1 & sl2 & sl3 & sl4 & sl5 & sl6

    A[APPOINTMENTS]
    a1(["appointment_id · PK"])
    a2(["patient_id · FK"])
    a3(["doctor_id · FK"])
    a4(["slot_id · FK"])
    a5(["triage_id · nullable FK"])
    a6(["status"])
    a7(["urgency"])
    a8(["reason"])
    a9(["booked_at"])
    A --- a1 & a2 & a3 & a4 & a5 & a6 & a7 & a8 & a9

    RX[PRESCRIPTIONS]
    rx1(["prescription_id · PK"])
    rx2(["appointment_id · FK"])
    rx3(["doctor_id · FK"])
    rx4(["patient_id · FK"])
    rx5(["diagnosis_notes"])
    rx6(["medication_name"])
    rx7(["dosage"])
    rx8(["instructions"])
    rx9(["prescribed_at"])
    RX --- rx1 & rx2 & rx3 & rx4 & rx5 & rx6 & rx7 & rx8 & rx9

    AU[APPOINTMENT_AUDIT]
    au1(["audit_id · PK"])
    au2(["appointment_id · FK"])
    au3(["action"])
    au4(["old_status"])
    au5(["new_status"])
    au6(["changed_at"])
    AU --- au1 & au2 & au3 & au4 & au5 & au6

    RA[APPOINTMENT_RESCHEDULE_AUDIT]
    ra1(["reschedule_id · PK"])
    ra2(["appointment_id · FK"])
    ra3(["old_slot_id · FK"])
    ra4(["new_slot_id · FK"])
    ra5(["changed_by · FK"])
    ra6(["changed_at"])
    RA --- ra1 & ra2 & ra3 & ra4 & ra5 & ra6
  end

  HAS_PROFILE{HAS PROFILE}
  CLASSIFIES{CLASSIFIES}
  OFFERS{OFFERS}
  SUBMITS{SUBMITS}
  BOOKS{BOOKS}
  ATTENDS{ATTENDS}
  USES_SLOT{USES SLOT}
  LINKS_TRIAGE{OPTIONALLY LINKS}
  GRANTS{ASSIGNED VIA}
  ISSUES{ISSUES}
  RECEIVES{PATIENT RECEIVES}
  HAS_RX{HAS}
  HAS_STATUS_LOG{HAS STATUS LOG}
  HAS_MOVE_LOG{HAS RESCHEDULE LOG}
  CHANGED_BY{CHANGED BY}
  OLD_SLOT{OLD SLOT}
  NEW_SLOT{NEW SLOT}

  U -- "1" --- HAS_PROFILE
  HAS_PROFILE -- "0..1" --- D
  S -- "1" --- CLASSIFIES
  CLASSIFIES -- "0..N" --- D
  D -- "1" --- OFFERS
  OFFERS -- "0..N" --- SL
  U -- "1" --- SUBMITS
  SUBMITS -- "0..N" --- T
  U -- "1" --- BOOKS
  BOOKS -- "0..N" --- A
  D -- "1" --- ATTENDS
  ATTENDS -- "0..N" --- A
  SL -- "1" --- USES_SLOT
  USES_SLOT -- "0..N" --- A
  T -- "0..N" --- LINKS_TRIAGE
  LINKS_TRIAGE -- "0..1" --- A
  P -- "1" --- GRANTS
  GRANTS -- "0..N" --- RP
  A -- "1" --- HAS_RX
  HAS_RX -- "0..N" --- RX
  D -- "1" --- ISSUES
  ISSUES -- "0..N" --- RX
  U -- "1" --- RECEIVES
  RECEIVES -- "0..N" --- RX
  A -- "1" --- HAS_STATUS_LOG
  HAS_STATUS_LOG -- "0..N" --- AU
  A -- "1" --- HAS_MOVE_LOG
  HAS_MOVE_LOG -- "0..N" --- RA
  U -- "1" --- CHANGED_BY
  CHANGED_BY -- "0..N" --- RA
  SL -- "1" --- OLD_SLOT
  OLD_SLOT -- "0..N" --- RA
  SL -- "1" --- NEW_SLOT
  NEW_SLOT -- "0..N" --- RA

  classDef entity fill:#05aec2,stroke:#047e91,color:#ffffff,stroke-width:2px;
  classDef relationship fill:#075985,stroke:#06466a,color:#ffffff,stroke-width:2px;
  classDef attribute fill:#c21850,stroke:#9f1745,color:#ffffff,stroke-width:1.5px;
  class U,S,D,P,RP,T,SL,A,RX,AU,RA entity;
  class HAS_PROFILE,CLASSIFIES,OFFERS,SUBMITS,BOOKS,ATTENDS,USES_SLOT,LINKS_TRIAGE,GRANTS,ISSUES,RECEIVES,HAS_RX,HAS_STATUS_LOG,HAS_MOVE_LOG,CHANGED_BY,OLD_SLOT,NEW_SLOT relationship;
  class u1,u2,u3,u4,u5,u6,u7,u8,s1,s2,s3,s4,d1,d2,d3,d4,d5,d6,d7,d8,d9,p1,p2,rp1,rp2,t1,t2,t3,t4,t5,t6,t7,t8,sl1,sl2,sl3,sl4,sl5,sl6,a1,a2,a3,a4,a5,a6,a7,a8,a9,rx1,rx2,rx3,rx4,rx5,rx6,rx7,rx8,rx9,au1,au2,au3,au4,au5,au6,ra1,ra2,ra3,ra4,ra5,ra6 attribute;
```

## Cardinality and implementation notes

- **USERS–DOCTORS:** one user can have zero or one doctor profile; each doctor profile belongs to exactly one user because `doctors.user_id` is unique and non-null.
- **SPECIALTIES–DOCTORS:** one specialty can classify many doctors; each doctor references one specialty.
- **DOCTORS–APPOINTMENT_SLOTS:** one doctor can offer many slots.
- **USERS–TRIAGE_SESSIONS:** one patient can submit many triage sessions.
- **USERS–APPOINTMENTS:** one patient can book many appointments.
- **DOCTORS–APPOINTMENTS:** one doctor can be assigned many appointments.
- **APPOINTMENT_SLOTS–APPOINTMENTS:** an appointment references one slot. A slot may be referenced by multiple historical appointment rows over time after cancellation and rebooking.
- **TRIAGE_SESSIONS–APPOINTMENTS:** an appointment can have zero or one triage session. The FK is nullable and not unique, so one triage session can be referenced by multiple appointment rows.
- **APPOINTMENTS–PRESCRIPTIONS:** one appointment can have multiple prescription rows. The prescription also stores doctor and patient FKs; triggers ensure those values match the appointment.
- **APPOINTMENTS–APPOINTMENT_AUDIT:** one appointment can have multiple status audit events.
- **APPOINTMENTS–APPOINTMENT_RESCHEDULE_AUDIT:** one appointment can have multiple reschedule events. The reschedule history also references the old slot, new slot and user who made the change.
- **PERMISSIONS–ROLE_PERMISSIONS:** one permission can be assigned through multiple role-permission rows.

**RBAC note:** `ROLE_PERMISSIONS.permission_code` is an enforced FK to `PERMISSIONS.permission_code`. `ROLE_PERMISSIONS.role_code` is part of the composite PK but is not an FK to `USERS.role`; the application performs that role-code match in its permission lookup.

**Vector-store boundary:** Qdrant collection `medical_routing_v1` is separate from MySQL and is not included in this relational ER diagram.
