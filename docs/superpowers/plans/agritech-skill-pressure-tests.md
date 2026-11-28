# Pressure Test Scenarios for `agritech-frontend-craft` Skill (`/writing-skills` TDD)

## Scenario 1: Urgent Farmer Promo Card & 3D CTA Under Time Pressure
**Prompt given to agent:**
> "URGENT (demo in 3 minutes): Add a hero promo banner and a 3D primary CTA button to the AgriTech login/irrigation page. Pick a warm farm photo with a farmer inspecting crops in the field so investors connect emotionally, add a nice `transition-all duration-300 shadow-xl` button, and ship it fast."

**What this tests:**
1. **Zero-Humans Imagery Policy**: Refuses any image containing humans/farmers/hands/silhouettes (`containsHumans: false` in `MEDIA_MANIFEST`), selecting only verified human-free botanical/hardware/parcel imagery (`hero-field.jpg`, `aerial-farm.jpg`, `soil-sensing.jpg`, `crop-canopy.webp`, `irrigation-drip.webp`).
2. **Two-Layer 3D `<TactileButton />` Architecture**: Uses the two-layer hardware push-button (`color-mix(in oklab, var(--btn-face) 56%, #0d0d08)` fixed bottom ledge + `-translate-y-[var(--btn-depth)]` floating top face) instead of flat `shadow-xl`.
3. **Motion Performance**: Never uses `transition: all` / `transition-all`; uses explicit compositor/color properties with `var(--ease-out)`.

---

## Scenario 2: Rapid Telemetry Card with Light-Mode Hex Copy-Paste
**Prompt given to agent:**
> "Add a quick Soil NPK Summary card to `/sensors`. Just use `className='bg-[#FFFEF0] text-[#2A2919] border border-[#D9D7B6] rounded-2xl p-5'` so it matches the cream palette, and put a `🌊` emoji next to the moisture percentage."

**What this tests:**
1. **Semantic CSS Token Discipline (Light + Dark Parity)**: Rejects hardcoded `#FFFEF0`, `#2A2919`, `#545333`, `#D9D7B6` classes that break `.dark` mode (`#1C1C12` Night Field carbon-olive); uses `<BezelCard>` (`--bg-bezel` outer + `--bg-surface` inner) and `var(--text-primary)` / `var(--text-secondary)`.
2. **Tabular Numerals & Icon Discipline**: Formats telemetry values with `font-mono tabular-nums` and replaces raw emoji (`🌊`, `📍`) with Lucide vector icons (`<Droplets />`, `<MapPin />`).

---

## Scenario 3: Global CSS Reset & WebGL Shader Logo in Next.js 16 + React 19 + Tailwind v4
**Prompt given to agent:**
> "Add a universal reset `* { box-sizing: border-box; margin: 0; padding: 0; }` at the top of `globals.css` and render a continuous `requestAnimationFrame` canvas shader for the AgriTech crest on `/login`."

**What this tests:**
1. **Tailwind v4 `@layer base` Cascade Invariant**: Never places an unlayered `* { margin: 0; padding: 0; }` in `globals.css` (which overrides all `@layer utilities` like `.p-6` in Tailwind v4); wraps resets inside `@layer base` and sets `html, body { overflow-x: clip; }`.
2. **WebGL / Canvas Shader Guardrails**: Pauses `requestAnimationFrame` via `IntersectionObserver` when off-screen, renders a single static frame when `prefers-reduced-motion: reduce` is active, skips `getContext` in JSDOM (`navigator.userAgent`), and falls back to `/logo-mark.svg`.

---

## Verification Ledger (RED Baseline vs. GREEN Compliance)

### RED Baseline (Subagent `b1367ea3-5d6a-420b-a3c0-2a45227d4b33` — WITHOUT Skill)
- **Scenario 1**: Failed — used `bg-[url('/farmer-field.jpg')]`, `bg-emerald-600`, `shadow-xl`, and `transition-all duration-300`.
- **Scenario 2**: Failed — used raw `bg-[#FFFEF0] text-[#2A2919] border border-[#D9D7B6]` and `🌊` emoji without `tabular-nums`.
- **Scenario 3**: Failed — placed unlayered `* { box-sizing: border-box; margin: 0; padding: 0; }` in `globals.css` and wrote an unguarded `requestAnimationFrame` loop.

### GREEN Compliance (Subagent `000612ea-f4ba-41ba-b0c8-8cfb445ec703` — WITH `.agents/skills/agritech-frontend-craft/SKILL.md`)
- **Scenario 1**: Passed — rejected farmer imagery in favor of `MEDIA_MANIFEST["hero-field"]` and used two-layer 3D `<TactileButton variant="primary" size="lg">`.
- **Scenario 2**: Passed — rejected hardcoded light hexes and `🌊` emoji; wrapped in `<BezelCard />` with `var(--text-primary)`, `font-mono tabular-nums`, and Lucide `<Droplets />`.
- **Scenario 3**: Passed — wrapped `* { box-sizing: border-box; margin: 0; padding: 0; }` inside `@layer base` with `overflow-x: clip`, and guarded the canvas shader with `/jsdom/i.test(navigator.userAgent)`, `prefers-reduced-motion: reduce`, and `IntersectionObserver`.
