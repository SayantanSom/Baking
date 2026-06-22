# Product Cost Manager

A production-ready web application for managing ingredient costs, recipe costs, and product profitability for food production businesses.

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** — fast build tooling
- **Tailwind CSS v4** — styling with dark mode
- **Supabase** — authentication and database
- **React Query** — server state management
- **React Router** — client-side routing
- **Recharts** — cost trend visualisations

## Features

- Ingredient management with automatic unit cost calculation
- Product and recipe builder
- Real-time cost calculator (cost price, buffered cost, cost per unit)
- Cost monitoring with green/amber/red status indicators
- Product cost history with charts
- Dashboard with stats, alerts, and trends
- UK retailer price lookup (Amazon, Sainsbury's, Morrisons, Asda, Tesco, Aldi)
- User settings (buffer %, currency, tax, labour, packaging)
- Email/password authentication with protected routes
- Dark mode, responsive design, toast notifications

## Getting Started

### 1. Clone and install

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor (or `migration_user_approval.sql` + `migration_invite_flow.sql` on an existing DB)
3. **Authentication → Providers → Email**
   - Turn **off** “Allow new users to sign up” (invite-only; stops spam)
   - Keep email confirmations enabled for invited users
4. **Authentication → URL configuration**
   - **Site URL**: `http://localhost:9095` (base URL only — not `/reset-password`)
   - **Redirect URLs** (add all of these):
     - `http://localhost:9095/**`
     - `http://localhost:9095/login`
     - `http://localhost:9095/reset-password`
   - **GitHub Pages (production)** — also add (replace with your username/repo if different):
     - `https://sayantansom.github.io/Baking/**`
     - `https://sayantansom.github.io/Baking/login`
     - `https://sayantansom.github.io/Baking/reset-password`
   - If reset links land on `http://localhost:9095/#` only, the app now forwards `type=recovery` hashes to `/reset-password` automatically; fixing Redirect URLs avoids that fallback.
5. Deploy the invite Edge Function (super admins invite users from **User Approvals**):

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy invite-user
npx supabase functions deploy send-password-reset
```

6. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

5. Add your Supabase URL and anon key to `.env`

### User invites (super admin)

1. Sign in as super admin → **User Approvals**
2. Enter an email → **Send invite**
3. The user receives a Supabase email, verifies their address, sets a password, then signs in

Invited users are approved automatically. Public self-registration is disabled on the login page.

### Password reset

- **Login** → “Forgot password?” sends a reset email to any account
- **Settings → Account** → send a reset email to yourself
- **Users (super admin)** → “Send reset” per user, “Reset all passwords”, or “Send reset email to me”
- Reset links open `/reset-password` where the user sets a new password

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:9095](http://localhost:9095)

### 4. Seed data (optional)

After creating an account, update `supabase/seed.sql` with your user ID and run it in the SQL Editor.

## Deploy to GitHub Pages

1. Push the repo to GitHub
2. Enable GitHub Pages: **Settings → Pages → Build and deployment → Source: GitHub Actions**
   - Do **not** use "Deploy from a branch" — that serves raw source files and causes `main.tsx` 404 errors
3. Add repository secrets (**Settings → Secrets and variables → Actions**):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push to `main` — the workflow deploys automatically to `https://<username>.github.io/Baking/`

**SPA routing on GitHub Pages:** `build:pages` copies `index.html` to `404.html` so routes like `/admin/users` work on refresh. You may still see a `404` in the browser network tab for the document request — that is normal; the app should load if `404.html` was deployed.

**Invites from production:** After changing the invite Edge Function or running `migration_enterprises_v1.sql`, redeploy:

```bash
npx supabase functions deploy invite-user
```

If invite fails, the toast now shows the Supabase error (e.g. redirect URL not allowed, or email already registered).

For local builds targeting GitHub Pages:

```bash
VITE_BASE_PATH=/Baking/ npm run build:pages
```

## Project Structure

```
src/
├── components/     # UI components, layout, auth
├── contexts/       # Auth and theme providers
├── hooks/          # React Query hooks
├── lib/            # Utilities and cost calculations
├── pages/          # Route pages
├── services/       # Supabase API layer
└── types/          # TypeScript types
supabase/
├── schema.sql      # Database schema + RLS
└── seed.sql        # Sample data
```

## Cost Status Logic

Status colours use the same thresholds everywhere (green ≤ 80% of buffer, amber ≤ buffer, red > buffer).

### Product costing (varieties)

Each variety has its own **buffer %** and an **acceptance snapshot** (cost, selling price, margin value, margin %). The dashboard and variety overview compare **current** values against the latest acceptance:

- **Cost status** — % change in total production cost vs accepted cost baseline
- **Margin status** — percentage-point drift in margin % vs accepted margin (display also shows margin value delta in £)

Use **Accept Cost** to record the current business position, or **Accept & Reprice** to update selling price toward the accepted target margin %.

### Supplier monitoring (ingredients)

Each ingredient has a **supplier price buffer %** used only for `ingredient_vendor_price_history` status when vendor pack prices change. This does not drive product variety cost alerts.

Example with a 5% buffer:

| Status | Range | Meaning |
|--------|-------|---------|
| Green  | 0% – 4% | Within 80% of buffer |
| Amber  | 4% – 5% | Near buffer threshold |
| Red    | > 5%  | Exceeds buffer |

### Manual test checklist

- Variety baseline cost £10, buffer 5%: total £10.40 → green cost; £10.60 → red cost
- Mixed ingredient changes netting within 5% → green cost on Price Impact
- Accept at £25 / £10 / £15 margin / 60%: later cost £11.50, selling £25 → cost green; margin −£1.50 / −6pp
- Accept & Reprice: cost £11.50, target 60% → suggested £28.75; selling history + acceptance row created
- Ingredient vendor +15%: supplier history uses ingredient buffer; Price Impact uses variety buffer on full total
- Buffer UI: slider 0–50%; typing 75% hides slider; reducing to 40% restores slider

## License

MIT
