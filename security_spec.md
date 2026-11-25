# Security Specification — PORTFOLIO STUDIO PRO

## 1. Data Invariants
1. **Strict Draft / Published Isolation**: Public visitors may ONLY read `published_portfolio`, `published_pages`, `published_services`, `published_packages`, and `published_testimonials`. Drafts (`draft_*`), media library metadata (`media_folders`, `media_items`), admin records (`admins`), and version snapshots (`portfolio_versions`) are strictly restricted to verified administrators.
2. **Verified Admin Gate**: Administrator privileges require `request.auth != null && request.auth.token.email_verified == true` AND either the bootstrapped owner email (`rossdsing@gmail.com`) or an explicit document in `/admins/{request.auth.uid}`.
3. **Anti-Self-Escalation**: Non-admin users cannot create or elevate records in `/admins/{adminId}`.
4. **Immutable Ownership & Temporal Integrity**: Every created document binds `ownerUid == request.auth.uid` and `createdAt == request.time`. Subsequent updates cannot mutate `createdAt` or `ownerUid`, and must set `updatedAt == request.time`.
5. **Path ID & Payload Boundary Hardening**: All document IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), every string and array has strict `.size()` caps, and `keys().hasAll` + `keys().hasOnly` prevent shadow fields.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Draft Read**: Unauthenticated client runs `getDoc(/draft_pages/page_01)` -> `PERMISSION_DENIED`.
2. **Unauthenticated Media Library Scrape**: Unauthenticated client queries `collection('media_items')` -> `PERMISSION_DENIED`.
3. **Signed-In Non-Admin Published Tamper**: Non-admin verified user attempts `updateDoc(/published_pages/page_01, { title: 'Hacked' })` -> `PERMISSION_DENIED`.
4. **Unverified Email Admin Spoof**: User with `email_verified: false` attempts write to `/draft_portfolio/main` -> `PERMISSION_DENIED`.
5. **Self-Assigned Admin Escalation**: Non-admin user attempts `setDoc(/admins/attackerUid, { uid: 'attackerUid', email: 'a@b.com', role: 'owner', ... })` -> `PERMISSION_DENIED`.
6. **Shadow Field Injection on Create**: Admin attempts `setDoc(/draft_services/s1, { ...validFields, isVerified: true })` -> `PERMISSION_DENIED` (`hasOnly` rejects ghost key).
7. **Owner UID Spoofing**: Admin attempts `create` with `ownerUid: 'other_user_uid'` -> `PERMISSION_DENIED`.
8. **CreatedAt Forgery**: Client attempts `create` with `createdAt: Timestamp(2020-01-01)` instead of `request.time` -> `PERMISSION_DENIED`.
9. **Immutable CreatedAt Mutation**: Client attempts `update` altering `createdAt` -> `PERMISSION_DENIED`.
10. **ID Poisoning Attack**: Client attempts `setDoc` with 500-char or `/` / `$` special-char ID -> `PERMISSION_DENIED` (`isValidId`).
11. **Denial-of-Wallet Oversized String**: Client sends 50KB `title` string on a service -> `PERMISSION_DENIED` (`.size() <= 120`).
12. **Type Poisoning on Update**: Client sends `visible: "yes"` (string instead of boolean) on `draft_pages` -> `PERMISSION_DENIED` (`isValidPortfolioPage`).
