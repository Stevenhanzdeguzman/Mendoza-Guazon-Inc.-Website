# API contract (what the app expects from the backend)

Base URL: `window.MG_API` in config.js. JSON everywhere. Auth: `Authorization: Bearer <token>` on every call except login.
Errors: HTTP status + `{"error":"message shown to the user"}`. `401` signs the user out. Enable CORS for the app's origin.
Field names match `database/schema.sql`, so rows can be returned almost as-is.

| Method & path | Who | Request | Response |
|---|---|---|---|
| POST /auth/login | anyone | `{username,password}` | `{token, user:{id,username,full_name,role:"employee"|"supervisor",branch,sales_target}}` |
| GET /auth/me | signed in | – | `{user}` |
| GET /expenses[?mine=1] | employee: own only (server enforces); supervisor: all | – | `[{id,txn_id,vendor,gross,status,nature,user_name,branch,submitted_at,supervisor_note}]` (employee list = current month) |
| POST /expenses | employee | `{client_ref,gross,account_code,vendor,doc_type,nature,receipt_url}` | created row. Server sets status `Pending`, `wht_rate` from nature (Goods .01, Service .02, Professional .05) |
| PATCH /expenses/:id | supervisor: `{status}` / `{gross}` / `{status:"Flagged",supervisor_note}`; employee (own, flagged): `{receipt_url,status:"Pending"}` | see left | updated row. Every change writes a row to `audit_log` |
| GET /expenses/:id/audit | supervisor | – | `[{action,actor,note,at}]` oldest first |
| GET /sales[?mine=1] | employee: own; supervisor: all | – | `[{customer,gross,status,submitted_at}]` (current month) |
| POST /sales | employee | `{client_ref,customer,item,invoice_no,payment:"Cash"|"Transfer"|"Check",gross,invoice_url}` | created row. Reject duplicate `invoice_no` with 409. Sales are immutable for employees after this |
| GET /ledger | supervisor | – | approved items: `[{day:"2026-09-30",label,gross,branch,txn_id}]` |
| POST /uploads | signed in | multipart field `file` (image) | `{url}` |

Rules the server must enforce (the app only hides buttons): role checks on every route, branch scoping, only supervisors change status/amount, VAT and withholding computed server-side (never trust the app's numbers), `client_ref` unique so an offline retry never creates a duplicate.
