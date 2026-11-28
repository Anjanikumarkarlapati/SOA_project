# Manual QA checklist

Run this checklist against a local stack with PostgreSQL and valid Maps credentials configured. Use two farmer accounts to check ownership boundaries.

## Authentication and persistence

- [ ] Register a new account; confirm it appears once in `users` and the browser receives a session only after the request succeeds.
- [ ] Sign in again with the same account; confirm `last_login_at` changes and no duplicate user is created.
- [ ] Try a duplicate email and an invalid form; confirm an actionable error is shown and no extra account is stored.
- [ ] Sign out, then open a protected URL; confirm the app redirects to login.
- [ ] Simulate an unavailable auth database; confirm no success session is issued and the UI shows an error.

## Property registration and access

- [ ] Complete the location step using Places search, a map pin, and a farm boundary; confirm address, coordinates, GeoJSON, and calculated area are shown.
- [ ] Complete water, soil, crop intent, previous crops, and sensor recommendation steps; refresh mid-wizard and confirm draft values return.
- [ ] Submit an invalid polygon or missing required value; confirm the step identifies the problem and does not advance.
- [ ] Save a property; confirm it appears in the property list and its details survive a reload.
- [ ] Create a second property; confirm the first remains intact and the selected default is clear.
- [ ] As the second account, try to view, update, and delete the first account's property ID; each request must be denied.
- [ ] Delete an owned property; confirm it disappears and another property becomes default when needed.

## Climate and crop recommendations

- [ ] Load climate analytics for a property with coordinates; inspect temperature/rainfall charts, trend, water balance, GDD, and risk values.
- [ ] Request a short known historical range; confirm dates and observation counts match the displayed period.
- [ ] Simulate an Open-Meteo failure; confirm cached data is marked as fallback, or a clear unavailable state is shown when no cache exists.
- [ ] Load crop recommendations for each intent: current season, chosen dates, and best overall.
- [ ] Confirm each ranked card includes score, water need, sow/harvest window, risk, explanation, and relevant adaptation suggestions.

## Sensors, irrigation, and responsive UI

- [ ] Open Sensors with live devices and with an empty account; verify loading, empty, error, retry, and status states.
- [ ] Open Irrigation with valves and schedules; verify loading, empty, error, retry, and permission states.
- [ ] At 320 px, 768 px, and desktop widths, check navigation, tables, cards, charts, maps, and forms for clipping or horizontal overflow.
- [ ] Complete login, onboarding, map controls, navigation, forms, and dialogs using only the keyboard; verify visible focus and sensible focus order.
- [ ] Use a screen reader to confirm each form control has a label, validation errors are announced, and status changes are understandable.
- [ ] Check text and controls for readable contrast in every supported theme.
