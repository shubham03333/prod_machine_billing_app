# TODO

- [ ] Add a new PIN-based read-only admin user (PIN: 9823) via seed/SQL instructions
- [x] Update login API response to include `canEditAdmin` (computed from PIN)

- [ ] Update UI (app/page.tsx) for admin dashboard to hide ALL edit/delete/add expense actions when `canEdit === false`
- [ ] Add backend guards for expense update/delete endpoints using PIN-based `canEdit`
- [ ] Test: login with PIN 9823 and verify buttons are removed and PUT/DELETE fail

