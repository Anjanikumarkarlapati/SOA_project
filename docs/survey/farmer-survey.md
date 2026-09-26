# Farmer and stakeholder survey (DTI: Empathize stage)

**Purpose:** validate the problem in PRD section 1 before and after building the prototype.
**Audience:** farmers, farm workers, agriculture students and agronomists. Target: 20 or more responses.
**Format:** Google Form. Takes about 4 minutes. Anonymous. Respondents may answer in English or Telugu.

## Part A: Current practice (Empathize)

1. What do you mainly grow? *(paddy / cotton / chilli / maize / vegetables / other)*
2. Farm size? *(< 2 acres / 2–5 / 5–10 / > 10)*
3. How do you decide when to irrigate? *(fixed days / look at the soil or plants / power or canal availability / advice from others / sensor)*
4. How do you irrigate? *(flood / furrow / sprinkler / drip)*
5. How many times a week do you walk your fields to check them? *(0–1 / 2–3 / daily / more than daily)*
6. In the last season, did you irrigate a field that turned out to be already wet enough? *(never / once or twice / often / don't know)*
7. In the last season, did a crop show stress (wilting, yellowing) before you noticed the soil was dry? *(never / once or twice / often)*
8. What costs you most in irrigation? *(water / electricity or diesel / labour and time / crop loss)*

## Part B: The proposed solution (Define / Ideate)

9. Would a phone alert saying "*South field is dry, water in the next 6 hours*" change how you irrigate? *(1–5)*
10. Would you trust the system to **skip** a scheduled watering when the soil is already moist? *(1–5)*
11. How important is a remote **emergency stop** for all pumps and valves? *(1–5)*
12. Which should the dashboard show first? *(field health / soil moisture numbers / alerts / valve status)*
13. Would you prefer advice in plain language ("water in 6 hours") or raw numbers ("moisture 28 %")? *(plain / numbers / both)*
14. Who else should be able to see or control your fields? *(only me / family / farm worker (view only) / agronomist)*

## Part C: After seeing the prototype (Test)

15. After seeing the dashboard, how easy was it to find the field that needs attention? *(1–5)*
16. What one thing would make you actually use this? *(open text)*

---

## How each answer maps to the design

| Question | Tests which assumption | Design decision it validates |
|---|---|---|
| Q3, Q6 | Irrigation is calendar-driven and over-waters | `skipIfMoist` closed loop (FR-7) |
| Q5, Q7 | Stress is noticed too late | Health score + alerts + 48 h forecast (FR-5, FR-6) |
| Q11 | Remote stop matters | Emergency stop (FR-8) |
| Q13 | Numbers alone are not enough | Plain-language recommendations (FR-6) |
| Q14 | Different people need different powers | ADMIN / FARMER roles (FR-2) |
| Q15, Q16 | The prototype is usable | UI refinements |

## Demo results (illustrative data, not collected responses)

These are **demo numbers** (illustrative sample, n = 30), used in the LinkedIn article to show how
responses map to design decisions. Replace them with real results once the survey has been run.

| Finding | Demo result |
|---|---|
| Irrigate on fixed days or by habit (Q3) | 63 % |
| Over-watered at least once last season (Q6) | 57 % |
| Saw crop stress before noticing dry soil (Q7) | 70 % |
| Would trust auto-skip when moist (Q10 ≥ 4) | 67 % |
| Rated emergency stop important (Q11 ≥ 4) | 83 % |
| Want plain-language advice, alone or with numbers (Q13) | 87 % |
| Found the field needing attention easily (Q15 ≥ 4) | 80 % |

## Real results

Fill this in from the Google Forms "Responses → Summary" tab, then copy the numbers into the
LinkedIn article (`linkedin-article/`).

| Finding | Result |
|---|---|
| Responses collected | ___ |
| Irrigate on fixed days or by habit (Q3) | ___ % |
| Over-watered at least once last season (Q6) | ___ % |
| Saw crop stress before noticing dry soil (Q7) | ___ % |
| Would trust auto-skip when moist (Q10 ≥ 4) | ___ % |
| Rated emergency stop important (Q11 ≥ 4) | ___ % |
| Prefer plain-language advice (Q13) | ___ % |
| Found the field needing attention easily (Q15 ≥ 4) | ___ % |
| Most common request (Q16) | ___ |
