# গ্রাম উন্নয়ন সংস্থা বগুড়া (GUSB) — Official Website & Admin CMS

A bilingual (বাংলা / English) public website for **Village Development Organization Bogura (GUSB)** with a
full-featured **admin content management system**. Every piece of content a visitor can see — hero slides,
programs, news, videos, gallery, publications, notices, careers, governance/committee, partners, stats,
about/home page copy, footer/header identity, **and the entire site color theme** — is editable from the
admin panel without touching code.

## ✨ Features

### Public site
- Fully bilingual (বাংলা / English) with a live language switcher.
- Home, About, Governance, Programs (+ detail), Publications, Gallery (photos + videos),
  News (+ detail), Career (with CV submission), Notice board (PDF preview), Contact (interactive map).
- Animated stats counters, hero slider, video player, PDF viewer.

### Admin panel (`/admin`)
- **Hero Slider** – add / edit / reorder / toggle / delete.
- **Website Content** – edit *all* Home & About page copy (bilingual fields), leader bios, legal items.
- **Programs, News, Publications, Notices, Careers** – full create / edit / delete.
- **Videos – two-way upload**: ① *device upload* (drag & drop an MP4/WebM/MOV from a phone or computer,
  with a live progress bar; stored on **Cloudinary** when configured, local disk otherwise) or
  ② *YouTube / Vimeo link* (paste any watch / share / shorts / live / embed URL — it is normalised to a
  real embed URL and the thumbnail is fetched automatically). Titles/categories are editable inline.
- **Photo Gallery** – albums (add / edit / delete) and per-album photos (upload / delete).
- **Governance / Committee** – add / edit / delete members across all committees.
- **Partners & Donors** – add / edit / delete.
- **Stats Counters** – add / edit / delete the animated numbers.
- **Website Settings & Colors** – org identity, logo, contact, branch offices, social links, map location,
  registration, **and a color picker (with presets) that re-themes the entire site instantly.**

### Engineering / production readiness
- **No public header/footer on admin routes** – the admin panel is a standalone, independent shell.
- **Site-wide theming** – two CSS custom properties (`--site-primary`, `--site-accent`) drive every brand
  color; changing them in admin recolors the whole site (Tailwind palette is mapped onto the tokens).
- **Persistence** – all content is saved to `data/store.json` (debounced + flushed on shutdown), so admin
  edits survive restarts. MongoDB is supported as an optional connection.
- **Uploads** – local disk by default; Cloudinary when credentials are provided (videos use chunked
  `upload_large`, so large files do not fail, and a Cloudinary failure silently falls back to local disk
  so an upload is never lost).
- **Security** – JWT auth, admin role gating, login rate limiting, security headers, size-capped body
  parsing, JSON error handler, `x-powered-by` disabled, optional HSTS in production.
- **Type-safe** – strict TypeScript end to end; `npm run lint` passes.
- **Single-binary production build** – `npm run build && npm start`.

## 🚀 Run locally

**Prerequisites:** Node.js 18+ (V8, `tsx`)

```bash
# 1. Install dependencies
npm install

# 2. (Optional) create your env file
cp .env.example .env      # then edit values, at least JWT_SECRET

# 3. Run in development (Vite + Express on http://localhost:3000)
npm run dev
```

Open **http://localhost:3000** for the public site and **http://localhost:3000/admin** for the admin panel.

## 🔐 Admin accounts

There are **no built-in, demo or fallback credentials**. Every admin account is a document in the
MongoDB `admins` collection with a bcrypt-hashed password.

### Creating the first administrator

Set `MONGODB_URI` plus the bootstrap variables and start the server once — if the `admins`
collection is empty the account is created automatically:

```env
MONGODB_URI="mongodb+srv://..."
BOOTSTRAP_ADMIN_NAME="Site Administrator"
BOOTSTRAP_ADMIN_EMAIL="you@yourorg.org"
BOOTSTRAP_ADMIN_PASSWORD="a-strong-password"
JWT_SECRET="a-long-random-string"
```

The bootstrap runs only while no account exists, so it is safe to leave configured.

### Managing admins from the panel

Log in at **/admin** → **অ্যাডমিন ব্যবস্থাপনা** (Admin Management, visible to the `admin` role) to:

* **add** a new admin (name, email, password of at least 8 characters, role)
* **edit** name, email, role, active status, or set a new password
* **delete** an account

Two roles exist: `admin` (full access, including settings, page content and admin management) and
`editor` (content only). Safety rules enforced by the API: you cannot delete or deactivate your own
account, and the last active `admin` cannot be removed or demoted. Deleting or deactivating an
account revokes its session immediately, because every request re-validates the account in MongoDB.

> Without a reachable `MONGODB_URI` the admin panel cannot be used — login fails closed instead of
> falling back to any hard-coded credential.

##  Production build

```bash
# Build the frontend (dist/) and bundle the server (dist/server.cjs)
npm run build

# Run
NODE_ENV=production npm start
```

The production server serves the built SPA from `dist/`, falls back to `index.html` for client-side
routes, serves `/api` and `/uploads`, and enables HSTS + long-lived static caching.

> The production bundle never `require`s the dev-only `vite` package, so deploying with
> `npm install --omit=dev` works fine.

## 🎨 Changing the site color

1. Log in to **/admin** → **ওয়েবসাইট সেটিংস & রঙ** (Website Settings & Colors).
2. Pick a **Primary** color (headers, footer, banners, dark sections) and an **Accent** color
   (buttons, highlights, logo border). Both are chosen **manually** — use the colour wheel, type a
   `#RRGGBB` HEX code, or enter exact R / G / B values. There are no preset palettes.
3. **সেভ করুন** — the entire public site recolors immediately (navbar, hero, stats band, banners,
   footer, cards, links, hover states). The choice is persisted.

## 📁 Project structure

```
server/
  config/        cloudinary, ffmpeg, multer, persistence (JSON store)
  controllers/   all API handlers (CRUD + auth + settings + page-content)
  middleware/    auth (JWT), rate limiting
  models/        mongoose schemas (incl. Admin) + empty content store
  services/      admin account service (MongoDB CRUD + bootstrap)
  routes/api.ts  all /api routes
src/
  admin/         admin dashboard + per-module managers
  components/    Navbar, Footer, HeroSlider, StatsCounter, cards, map, video, PDF
  context/       Auth, Language, Settings (applies theme colors)
  pages/         public routes
  types/         shared TypeScript interfaces
server.ts        Express app (security, persistence, vite dev / static prod)
```

## 🌐 Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | no (default 3000) | HTTP port |
| `NODE_ENV` | no | Set `production` for the built server |
| `JWT_SECRET` | **yes in prod** | Signs admin JWTs (min. 16 chars; random per restart in dev) |
| `MONGODB_URI` | **yes** | MongoDB connection — stores all admin accounts |
| `BOOTSTRAP_ADMIN_EMAIL` | first run | Email of the automatically created first admin |
| `BOOTSTRAP_ADMIN_PASSWORD` | first run | Password of the first admin (min. 8 chars) |
| `BOOTSTRAP_ADMIN_NAME` | no | Display name of the first admin |
| `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET` | no | Use Cloudinary for uploads (incl. video) instead of local disk |
| `CLOUDINARY_URL` | no | Alternative single-string Cloudinary credential |
| `MAX_UPLOAD_MB` | no (default 512) | Maximum size of a single uploaded file |

## 📄 API overview (all under `/api`)

`auth/login`, `auth/me`, `admins` (GET/POST/PUT/DELETE, admin role only), `hero-slides`, `programs`, `news`, `videos` (see below), `notices`, `publications`,
`gallery/albums` (+ `/photos`), `committee`, `partners`, `career` (+ `/applications`),
`stats`, `settings`, `page-content`. Public reads are open; writes require a valid admin JWT
(settings & page-content additionally require the `admin` role).

## 🎬 Two-way video upload

Videos can be added in **two ways** from **/admin → ভিডিও গ্যালারি**, and both end up in the same public
video library (Home highlight + Gallery → ভিডিও গ্যালারি).

| Way | How | Where the file lives | Thumbnail |
| --- | --- | --- | --- |
| **Device upload** | Drag & drop / pick an MP4, WebM, MOV, MKV… (up to `MAX_UPLOAD_MB`, default 512 MB). A progress bar shows the upload and can be cancelled. | **Cloudinary** (chunked `upload_large`) when credentials are set — otherwise `uploads/videos/` on the server | Auto poster frame from Cloudinary (`so_2`), or ffmpeg locally; a custom image can be uploaded instead |
| **YouTube / Vimeo link** | Paste any URL: `watch?v=`, `youtu.be/`, `/shorts/`, `/live/`, `/embed/`, `player.vimeo.com/…`, even a bare 11-char YouTube id. `?t=90` start offsets are preserved. | Nothing is stored — the video is embedded from the provider | `https://i.ytimg.com/vi/<id>/hqdefault.jpg` automatically (overridable) |

### Enabling Cloudinary

```env
CLOUDINARY_CLOUD_NAME="your-cloud"
CLOUDINARY_API_KEY="123456789012345"
CLOUDINARY_API_SECRET="your-secret"
```

Put these in `.env` (loaded automatically) and restart. Uploaded videos then get a Cloudinary CDN URL,
`/api/videos/stream/:id` 302-redirects to it, and deleting a video also destroys the Cloudinary asset.
Without credentials everything keeps working on local disk with HTTP-range streaming.

### Video API

| Method | Endpoint | Body |
| --- | --- | --- |
| `GET` | `/api/videos` | – |
| `POST` | `/api/videos` | multipart with `videoFile` (+ optional `thumbnail`) **or** `embedUrl` / `youtubeUrl`; plus `title`, `category`, `description` |
| `PUT` | `/api/videos/:id` | `title`, `category`, `description`, `embedUrl`, `thumbnail` |
| `DELETE` | `/api/videos/:id` | – (also removes the Cloudinary / local asset) |
| `GET` | `/api/videos/stream/:id` | Range-enabled streaming (redirects to Cloudinary when remote) |

Legacy `POST /api/videos/upload` and `POST /api/videos/embed` still work.
