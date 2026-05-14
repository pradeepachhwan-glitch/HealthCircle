# Hospital Workspace Implementation Plan

## Goal
Build a "WhatsApp-simple" teleconsultation operational workspace for clinics/hospitals, keeping personal account logic frozen.

## Core Modules
- [ ] **Clinical Inbox**: Chat-like view for consultation requests.
- [ ] **Google Workspace Integration**: Meet & Calendar automation.
- [ ] **AI Scribe**: Automated SOAP note generation.
- [ ] **Document Engine**: PDF clinical notes with electronic signatures.
- [ ] **Care Team Management**: Role-based access for clinic staff.

## Tech Stack Expansion
- **Auth**: Google OAuth 2.0.
- **Documents**: `react-pdf` (client-side) or `pdfkit` (server-side).
- **State**: Existing React Query + Zod schema generation.

## Progress Tracking
### 1. Database Schema
- [x] Create `hospital_settings` table.
- [x] Create `hospital_care_team` table.
- [x] Create `hospital_consultations` table.
- [x] Push schema to production database.

### 2. Backend APIs (The Big 5)
- [x] `POST /api/hospital/google/authorize` (Placeholder logic)
- [x] `POST /api/hospital/consultations` (Scheduling)
- [x] `POST /api/hospital/consultations/:id/scribe` (AI Mock SOAP)
- [x] `PATCH /api/hospital/consultations/:id/approve` (Doc Signature)
- [x] `GET /api/hospital/consultations/:id/pdf` (Metadata retrieval)

### 3. Frontend UI
- [x] Hospital Workspace Layout (Sidebar/Header).
- [x] Consultation Inbox (Dual-pane).
- [x] Clinical Profile Management (Care Team).
- [x] Care Team Management View (Admin/Staff list).
- [ ] Branding & Settings View.
