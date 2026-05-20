# PRISM HIV Dashboard: Current Architecture & Data Flow (May 2026)

## Overview
This document describes the current architecture and data flow of the PRISM HIV dashboard, highlighting key components, data pipelines, and known duplication or architectural issues. It is intended as a reference for ongoing refactor and cleanup work.

---

## 1. Frontend Structure
- **Framework:** React (Vite)
- **Key entry points:**
  - `src/App.jsx` (main app shell, routing, session management)
  - `src/components/` (shared UI components)
  - `src/pages/` (main dashboard pages)
  - `src/data/` (static and semi-static data modules)

---

## 2. Data Pipelines
### A. Current (Live) Data Path
- **studyData.js** (in `src/data/`):
  - Contains the main study data for the dashboard (audience, segments, items, etc.)
  - Consumed directly by React components for rendering
  - Updated manually or via ad-hoc scripts

### B. Intended (Not Fully Wired) Data Path
- **Pipeline:**
  1. `create_template.py` generates an Excel template for new studies
  2. Data is filled in Excel (HIV_Study_Template.xlsx)
  3. `convert_study.py` parses the Excel file and outputs a normalized JS/JSON file (`study.js`)
  4. `study.js` is meant to be the canonical data source for the dashboard
- **Status:**
  - This pipeline is only partially connected; the dashboard still reads from `studyData.js` instead of the output from the pipeline
  - Known header bug in Excel template (columns 31-50 labeled `prepost_key4_*` four times)

---

## 3. Data Duplication & Structure
- **Segments:**
  - Defined in both `src/data/segments.js` and inside `src/pages/SegmentProfile.jsx`
  - Leads to risk of drift and inconsistency
- **ROI and PrePost Tables:**
  - Inline in `SegmentProfile.jsx` but should be in the data layer
- **Other static data:**
  - Some chart data, ideology matrices, map coordinates, etc. are embedded directly in components

---

## 4. Supabase Integration
- **supabaseClient.js**:
  - Handles connection to Supabase backend (now using environment variables)
  - Used for authentication and any dynamic data fetches

---

## 5. High-Risk/Fragile Areas
- **Imperative SVG in HIV Persona Profile Tab:**
  - `hiv_tab_v5.html` uses direct SVG construction and positioning math
  - If ported to React, viewBox and math must be preserved exactly
- **Dual data pipeline:**
  - Both `studyData.js` and the intended Excel→JS pipeline exist in parallel
- **Manual data updates:**
  - Many updates are still manual, risking errors and inconsistency

---

## 6. Summary of Issues
- Data duplication (segments, ROI tables)
- Incomplete data pipeline wiring
- Manual/inline data updates
- Fragile imperative SVG code
- Supabase credentials now secured (see separate doc)

---

## 7. Next Steps
- Complete wiring of the intended data pipeline
- Centralize all static data in `src/data/`
- Remove duplication from components
- Modularize and document all data flows

---

*This document will be updated as the refactor progresses.*
