# ✦ Pause Before You Take — Painkiller Safety Check

A lightweight, zero-dependency Node.js web application designed to promote safe painkiller usage. It provides users with a 30-second interactive triage assessment and equips administrators with an anonymous usage analytics dashboard.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Traffic-Light Triage Logic](#traffic-light-triage-logic)
- [Project Architecture & File Structure](#project-architecture--file-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Running the Application](#running-the-application)
- [API Reference](#api-reference)
- [Privacy & Security](#privacy--security)
- [Production & Deployment Notes](#production--deployment-notes)
- [Medical Disclaimer](#medical-disclaimer)

---

## 🌟 Overview

Taking over-the-counter painkillers safely requires awareness of dosage limits, time intervals, and potential drug interactions. **Pause Before You Take** acts as a quick checkpoint before taking medication:

1. **User Safety Check (`/`)**: A 5-question responsive survey providing instant traffic-light feedback (🟢 Checked, 🟡 Check First, 🔴 Seek Advice).
2. **Admin Dashboard (`/admin`)**: Real-time aggregated statistics showing response counts, daily submission trends, and question breakdowns.
3. **Lightweight Backend (`server.js`)**: Pure Node.js server with **zero external `npm` dependencies** using local JSON storage.

---

## ✨ Key Features

- ⚡ **Zero Third-Party Dependencies**: Powered entirely by Node.js core modules (`node:http`, `node:fs`, `node:path`).
- ⏱️ **Fast 30-Second Triage**: Five focused, multiple-choice questions with a dynamic progress bar.
- 🚦 **Instant Traffic-Light Guidance**: Clear actionable recommendations based on user responses.
- 📊 **Built-in Analytics Dashboard**: Visualize response trends, daily submission counts, and categorized answer distributions.
- 🔒 **Privacy-by-Design**: Completely anonymous. Does not collect names, emails, IP addresses, device identifiers, or free-form text.
- 📱 **Mobile & Desktop Optimized**: Responsive, accessible UI designed for quick interaction on any device.

---

## 🚦 Traffic-Light Triage Logic

The safety outcome is calculated based on user answers according to the following triage criteria:

| Level | Outcome | Trigger Conditions | Recommendation |
| :--- | :--- | :--- | :--- |
| 🔴 **High Caution** | **SEEK ADVICE** | • Unsure if it is safe to take another dose (`unsure: Yes`)<br>• Unsure about last dose timing (`lastDose: Not sure`)<br>• Unsure about other medications (`otherMedicine: Not sure`) | Speak to a pharmacist or doctor before taking another dose. |
| 🟡 **Moderate Caution** | **CHECK FIRST** | • Recommended dose not checked (`doseChecked: No`)<br>• Taking other medication (`otherMedicine: Yes`)<br>• Took a dose earlier today (`lastDose: Earlier today`) | Check the medicine label carefully and consult a pharmacist regarding dose intervals and interactions. |
| 🟢 **Clear** | **CHECKED** | • None of the caution conditions triggered | Basic safety checks completed. Follow the product label directions and dosage limits. |

---

## 📁 Project Architecture & File Structure

```text
Binushi/
├── data/
│   └── responses.json     # Local JSON datastore for anonymized submissions
├── .gitignore             # Ignores responses.json from version control
├── admin.html             # Usage analytics dashboard UI
├── index.html             # 30-second safety check survey UI
├── package.json           # Project metadata (if applicable)
├── README.md              # Project documentation
├── server.js              # Native Node.js HTTP server & REST endpoints
└── start.bat              # Windows batch launcher script
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18.0.0 or higher recommended)

### Running the Application

Because the project uses standard Node.js libraries, **no `npm install` is required**.

1. **Start the server**:
   - On **Windows** (Double click `start.bat` or run):
     ```cmd
     start.bat
     ```
   - On **macOS / Linux / Terminal**:
     ```bash
     node server.js
     ```

2. **Access the web interfaces**:
   - **Safety Check**: Open [http://localhost:3000](http://localhost:3000) in your browser.
   - **Admin Dashboard**: Open [http://localhost:3000/admin](http://localhost:3000/admin).

3. **Custom Port Configuration (Optional)**:
   You can specify a custom port using the `PORT` environment variable:
   ```bash
   PORT=8080 node server.js
   ```

---

## 🔌 API Reference

### 1. Submit Safety Check Response
- **Endpoint**: `POST /api/responses`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "reason": "Headache",
    "lastDose": "Not today",
    "doseChecked": "Yes",
    "otherMedicine": "No",
    "unsure": "No"
  }
  ```
- **Allowed Field Values**:
  - `reason`: `"Headache"`, `"Toothache"`, `"Body pain"`, `"Period pain"`, `"Other"`
  - `lastDose`: `"Not today"`, `"Earlier today"`, `"Not sure"`
  - `doseChecked`: `"Yes"`, `"No"`
  - `otherMedicine`: `"Yes"`, `"No"`, `"Not sure"`
  - `unsure`: `"Yes"`, `"No"`
- **Response**: `201 Created`
  ```json
  {
    "saved": true,
    "result": "CHECKED"
  }
  ```

---

### 2. Fetch Usage Statistics
- **Endpoint**: `GET /api/admin/stats`
- **Response**: `200 OK`
  ```json
  {
    "total": 42,
    "results": {
      "CHECKED": 25,
      "CHECK FIRST": 12,
      "SEEK ADVICE": 5
    },
    "counts": {
      "reason": { "Headache": 18, "Toothache": 6, ... },
      "lastDose": { "Not today": 30, ... },
      "doseChecked": { "Yes": 38, ... },
      "otherMedicine": { "No": 32, ... },
      "unsure": { "No": 37, ... }
    },
    "days": {
      "2026-09-27": 14
    }
  }
  ```

---

## 🔒 Privacy & Security

- **No Personal Data Collected**: The application does not log IP addresses, user agents, headers, names, or identifiable cookies.
- **Payload Strictness**: Payloads are strictly validated against allowed option values and constrained to a maximum of 4 KB.
- **Strict Headers**: The server delivers security headers including `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, and `Referrer-Policy: no-referrer`.
- **Restricted File Permissions**: Data file creation applies restrictive OS file modes (`0o600`).

---

## 🌐 Production & Vercel Deployment (with Supabase)

Because Vercel runs on ephemeral serverless containers, data must be stored in a cloud database. The app includes built-in support for **Supabase** (Free PostgreSQL):

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com/) and create a free project.
2. In the left sidebar, open the **SQL Editor** -> Click **New query**.
3. Paste and run the query from [`supabase_schema.sql`](file:///d:/SLIIT/projectr/Binushi/supabase_schema.sql):
   ```sql
   create table if not exists responses (
     id bigint generated always as identity primary key,
     created_at timestamptz default now(),
     date text not null,
     answers jsonb not null,
     result text not null
   );

   alter table responses enable row level security;

   drop policy if exists "Allow anonymous inserts" on responses;
   drop policy if exists "Allow read access" on responses;

   create policy "Allow anonymous inserts" on responses
     for insert with check (true);

   create policy "Allow read access" on responses
     for select using (true);
   ```

### 2. Add Environment Variables to Vercel
1. In your Supabase project: Go to **Project Settings** -> **API**.
2. Copy your **Project URL** and **anon / public key**.
3. In your **Vercel Project Dashboard**:
   - Go to **Settings** -> **Environment Variables**.
   - Add:
     - `SUPABASE_URL` = `https://your-project-id.supabase.co`
     - `SUPABASE_ANON_KEY` = `your-anon-public-key`
4. **Redeploy** on Vercel.

> **Note**: If `SUPABASE_URL` is not set (e.g. running offline locally), the app automatically falls back to saving responses locally in `data/responses.json`.

---

## ⚕️ Medical Disclaimer

> **IMPORTANT**: This tool is created for educational and general informational purposes only. It is **not** a substitute for professional medical advice, clinical diagnosis, or treatment. Always read the packaging and patient information leaflet of your medication, and consult a qualified pharmacist or doctor if you have any questions or feel unwell.