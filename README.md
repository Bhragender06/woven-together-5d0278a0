# 🌿 Medileaf

> **Rooted in Care, Driven by Science.**  
> An intelligent, accessible medication management ecosystem that combines clinical safety checks, prescription vision AI, Latin abbreviation decoding, and circular eco-rewards.

[![TanStack Start](https://img.shields.io/badge/Framework-TanStack%20Start%20v1-FF4154?style=flat-square)](https://tanstack.com/start)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-CSS%20v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Lovable Cloud](https://img.shields.io/badge/Backend-Lovable%20Cloud%20%2F%20Postgres-3ECF8E?style=flat-square)](https://lovable.dev)
[![Tests Passing](https://img.shields.io/badge/Vitest-28%2F28%20Passing-green?style=flat-square)](https://vitest.dev)

---

## 📌 Problem Statement

- **Medication Non-Adherence & Confusion:** Over 50% of chronic disease patients fail to take medications as directed, primarily due to complex dosage timing, confusing medical jargon, and hard-to-read prescription slips.
- **Silent Drug-Drug Contraindications:** Patients consulting multiple doctors often combine incompatible drugs without realizing potential adverse interactions or bleeding risks.
- **Pharmaceutical Packaging Waste:** Billions of non-recyclable aluminum/PVC blister packs end up in landfills annually without circular collection incentives.

---

## ✨ Key Features

### ⚡ 1. The 45-Second "Killer Demo" Flow
Built for judges and evaluators — instantly hydrate clinical profiles without signing up or typing drug names manually:
- **Grandma Savita (72, Diabetes & Hypertension):** Hydrates Metformin, Amlodipine, Aspirin, and an acute Ibuprofen prescription to showcase an instant **high-severity bleeding risk** alert in Safety Shield.
- **Rahul (28, Asthma & Allergies):** Hydrates Montelukast, Salbutamol, Cetirizine, and Propranolol to demonstrate **bronchospasm contraindications**.

### 🛡️ 2. Safety Shield (AI Clinical Interaction Checker)
- Analyzes patient drug lists for contraindications, duplicate therapies, and food/alcohol cautions.
- Deterministic severity scoring (**High**, **Medium**, **Low**) with visual conflict graph cards.
- Caches analyses locally by medication fingerprint to prevent unnecessary API re-evaluations.

### 📸 3. Prescription Scanner (AI Vision OCR)
- Private drag-and-drop or camera capture for prescription labels and slips.
- Server-side Vision extraction maps doctor notes directly to structured medication schedules, dosages, and refill quantities.
- Stored securely in a private user-scoped Cloud Storage bucket (`prescriptions/<user_id>/`).

### 🔍 4. Jargon Buster
- Instant translation chips for archaic prescription latin codes (`PO`, `PRN`, `BID`, `TID`, `QDS`, `HS`, `AC`, `PC`).
- AI fallback explaining pharmacological terms in simple, plain language with timeline breakdowns.

### 🎙️ 5. Multilingual Voice Assistant
- Voice-activated companion supporting **English & Hindi** for elderly or visually impaired users.
- Read daily timelines aloud and dictate symptom notes effortlessly.

### 🌱 6. Eco-Rewards Blister Pack Circular Loop
- Log empty blister pack counts and parcel drop-offs at certified collection points.
- Database trigger-verified claims system unlocking **Pollinator Native Seed Packets** once a user hits 50 recycled units.

### 🔐 7. Role-Gated Admin Control Center (`/admin`)
- Secure overview for platform moderators:
  - Real-time active medication counts and refill alerts.
  - Parcel verification and eco-credit approvals.
  - Audit logs and user suspension controls.

---

## 🏗️ Architecture & Tech Stack

```text
               ┌────────────────────────────────────────────────────────┐
               │                     User Interface                     │
               │   TanStack Start v1 (React 19 SSR) + Tailwind CSS v4   │
               │         shadcn/ui Primitives + Lucide Icons            │
               └───────────┬────────────────────────────────┬───────────┘
                           │                                │
                           ▼                                ▼
       ┌───────────────────────────────┐  ┌──────────────────────────────────┐
       │   Client State & Local Caches │  │     TanStack Server Functions    │
       │   - In-memory store (cloud.ts)│  │     - extractPrescription (OCR)  │
       │   - Safety Shield result cache│  │     - checkMedicationSafety (AI) │
       │   - Persona demo hydrator     │  │     - explainPrescription        │
       └───────────────┬───────────────┘  │     - admin.functions.ts         │
                       │                  └─────────────────┬────────────────┘
                       │                                    │
                       ▼                                    ▼
       ┌─────────────────────────────────────────────────────────────────────┐
       │                   Lovable Cloud (PostgreSQL / RLS)                  │
       │  18 tables (profiles, medications, medication_schedules, dose_events│
       │  refills, reward_claims, user_roles, audit_logs) + Storage Buckets  │
       └─────────────────────────────────────────────────────────────────────┘
