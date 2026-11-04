# Parity checklist: v2 replaces main only when every box is ticked

- [ ] Type check, lint (no suppressions), all tests and the level-number check pass in CI.
- [ ] Route smoke test passes for: unauthenticated, teacher, school admin, superadmin, user of another school.
- [ ] Scripted dry run on seeded data: log in, pick class and concepts, print concept sheets (one copy per child with a QR code) and the observation sheet, record results, see bands and the class view.
- [ ] Each changed screen clicked through in Chrome for each role.
- [ ] Deployed on the v2 link with its own port, database and key; health and smoke test pass after deploy.
- [ ] Rollback written down: point the proxy back at main.
