<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Account data lives in normalized tables (profiles, medications, medication_schedules, refills, dose_events, orders, order_items, notification_preferences, user_devices, prescriptions, prescription_items, reminders, caregiver_permissions, audit_logs; all owner-scoped via user_id, cascading from profiles). `src/lib/cloud.ts` loads them into the in-memory store and writes back only changed rows; why: UI keeps one simple store while the database is the source of truth. `user_state` is deprecated.
- Prescription reading runs in the `extractPrescription` server function (AI Gateway, signed-in only); it stores the upload in the private `prescriptions` bucket under `<user_id>/` and records prescriptions + unverified items; why: keeps the AI key server-side and AI output separate from the verified plan.
- Removing a medicine from the current plan uses the shared store removal action to archive it, with existing cloud sync disabling its schedule; why: removal stops reminders and refill alerts without deleting dose history.
- Admin panel (`/admin`) reads and changes other users' data only through `src/lib/admin.functions.ts`: each handler checks `has_role(caller,'admin')` as the caller, then uses the service-role client; why: account sync (`cloud.ts`) reads tables without user filters, so cross-user RLS policies would leak other users' rows into an admin's own plan. Roles live in `user_roles`; emails in `admin_emails` get the admin role on signup. Suspension bans sign-in and sets `profiles.status` (users cannot change their own status).
- Eco rewards: users create return notices and seed claims through `src/lib/rewards.functions.ts` (RLS as the user; they can insert/read own rows but never update them); only admin functions credit parcels. A database trigger on seed claims re-checks the verified total and seed choice before saving; why: the unlock rule must hold even if the app check is bypassed. Pure rules live in `src/lib/rewards-logic.ts`.
- Safety Shield (AI interaction checker) runs in `checkMedicationSafety` (`src/lib/safety.functions.ts`, signed-in only, structured AI output); pure severity rules live in `src/lib/safety-logic.ts` and the UI/hook in `src/components/safety-shield.tsx`, which caches results per medicine list in localStorage; why: avoids re-billing the AI for an unchanged list and keeps the colour rules testable.
- Plain-language translator runs in `explainPrescription` (src/lib/jargon.functions.ts, signed-in, structured AI output); abbreviation dictionary and timeline rules live in src/lib/jargon-logic.ts; why: chips decode instantly without AI and rules stay testable.
