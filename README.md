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
2. Run `supabase/schema.sql` in the SQL Editor
3. Enable Email auth in Authentication → Providers
4. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

5. Add your Supabase URL and anon key to `.env`

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:9095](http://localhost:9095)

### 4. Seed data (optional)

After creating an account, update `supabase/seed.sql` with your user ID and run it in the SQL Editor.

## Deploy to GitHub Pages

1. Push the repo to GitHub
2. Enable GitHub Pages: Settings → Pages → Source: **GitHub Actions**
3. Add repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push to `main` — the workflow deploys automatically

For local builds targeting GitHub Pages:

```bash
VITE_BASE_PATH=/your-repo-name/ npm run build
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

With a buffer of 5%:

| Status | Range | Meaning |
|--------|-------|---------|
| Green  | 0% – 4% | Within 80% of buffer |
| Amber  | 4% – 5% | Near buffer threshold |
| Red    | > 5%  | Exceeds buffer |

## License

MIT
