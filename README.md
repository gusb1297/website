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
- **Admin-only mobile navigation** — fixed bottom tabs on phones, with remaining sections under “আরও”; desktop keeps its sidebar. The public website retains its original hamburger menu and has no bottom navigation.
- **Hero Slider** – add / edit / reorder / toggle / delete.
- **Website Content** – edit *all* Home & About page copy (bilingual fields), leader bios, legal items.
- **Programs, News, Publications, Notices, Careers** – full create / edit / delete.
- **Videos – two-way upload**: ① *device upload* (drag & drop an MP4/WebM/MOV from a phone or computer,
  with a live progress bar; stored on **Cloudinary** when configured, local disk otherwise) or
  ② *YouTube / Vimeo link* (paste any watch / share / shorts / live / embed URL — it is normalised to a
  real embed URL and the thumbnail is fetched automatically). Titles/categories are editable inline.
- **Photo Gallery** – albums (add / edit / delete), optional photos during album creation, multi-image upload with previews/progress, and per-album photo management.
- **Governance / Committee** – add / edit / delete members across all committees.
- **Partners & Donors** – add / edit / delete.
- **Stats Counters** – add / edit / delete the animated numbers.
- **Website Settings & Colors** – org identity, logo, contact, branch offices, social links, map location,
  registration, **and a color picker (with presets) that re-themes the entire site instantly.**

### Engineering / production readiness
- **No public header/footer on admin routes** – the admin panel is a standalone, independent shell.
- **Site-wide theming** – two CSS custom properties (`--site-primary`, `--site-accent`) drive every brand
  color; changing them in admin recolors the whole site (Tailwind palette is mapped onto the tokens).
- **Persistence** – all content (hero slides, news, gallery records, settings, page copy, …) is saved
  in **MongoDB** (`sitecontents` collection, debounced + flushed on shutdown), so admin edits survive
  restarts **and redeploys**. `data/store.json` is only a local cache (and the sole store in development
  without MongoDB); on first boot an existing `store.json` is migrated into MongoDB automatically.
- **Uploads** – **Cloudinary** in production (videos use chunked `upload_large`, so large files do not
  fail). On hosts whose disk is wiped on every deploy (Render, Heroku, Railway, Fly, Vercel) or when
  `NODE_ENV=production`, an upload is *refused with a clear message* if Cloudinary is missing instead of
  being written to a disk that will vanish. Local disk is used only in development.
- **Storage status banner** – the admin dashboard shows where uploads / edits are being stored and
  warns loudly when they would be lost on the next deploy. `GET /api/health` exposes the same data.
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

## ☁️ Where is everything stored? (read this before deploying)

| Data | Stored in | If missing |
| --- | --- | --- |
| Admin accounts | MongoDB (`admins`) | nobody can log in |
| **All site content** (slides, programs, news, videos, gallery records, notices, publications, committee, partners, stats, settings, page copy, CV applications) | MongoDB (`sitecontents`, one document) — `data/store.json` is only a cache | content lives only in `data/store.json` and **is wiped on every deploy** on Render/Heroku/Railway |
| **Uploaded images & videos** | Cloudinary only | every upload is **refused** with an explanatory (Bengali) error — there is deliberately **no local-disk fallback any more** |
| **Uploaded documents** (PDFs, DOC/DOCX/TXT, applicant CVs) | AM Storage gateway (`server/services/amStorage.ts`, `POST /api/v1/storage/upload`) — Cloudinary cannot host the site's PDFs | the upload is **refused** with a 503 + reason; override the built-in credentials with `AM_STORAGE_BRIDGE_URL`, `AM_STORAGE_KEY_ID`, `AM_STORAGE_KEY_SECRET` (`AM_STORAGE_AUTH_MODE=hmac` for signed requests) |

> **Why photos used to disappear after every update:** the old upload code wrote the file into
> `./uploads` on the container's own disk whenever Cloudinary was missing, returned HTTP 200 and showed a
> green message — and the next deploy wiped the folder. That fallback has been **deleted**: `server/services/storage.ts`
> has exactly one destination (Cloudinary). If it is not configured, `POST /api/uploads/*` answers
> **503 with the reason**, the picker shows a red toast, and nothing is saved — silence is now impossible.
> The admin dashboard also shows a red banner until Cloudinary **and** MongoDB are configured correctly.

### Minimum environment for a live server (Render → *Environment*)

```env
NODE_ENV=production
JWT_SECRET=<long random string>
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/gusb?retryWrites=true&w=majority
CLOUDINARY_CLOUD_NAME=<from cloudinary.com dashboard>
CLOUDINARY_API_KEY=<from cloudinary.com dashboard>
CLOUDINARY_API_SECRET=<from cloudinary.com dashboard>
# Optional — PDF/document gateway (defaults are built in, set these to rotate keys)
# AM_STORAGE_BRIDGE_URL=https://st.thamjj13.top
# AM_STORAGE_KEY_ID=am_store_live_…
# AM_STORAGE_KEY_SECRET=am_sec_live_…
```

After saving the variables, redeploy once and open **/admin** — the banner at the top should turn green
(“সব ঠিক আছে”). `GET /api/health` returns `storage.durable: true` and `content.durable: true`.

There is nothing to switch on: local-disk storage no longer exists in the code base, so the same
Cloudinary rules apply in development and in production.

## 🔐 Admin accounts

There are **no built-in, demo or fallback credentials**. Every admin account is a document in the
MongoDB `admins` collection with a **bcrypt-hashed** password (`passwordHash`).

### Do **not** add admins from the MongoDB Atlas panel

The Atlas / Compass UI is the wrong place to create login users. A document with a plaintext
`password` field will **never** log in — the server only compares bcrypt hashes. Use one of the
three methods below; they all hash the password for you.

### Creating the first administrator

Pick **one**:

**1. Environment bootstrap (recommended for production)**

Set `MONGODB_URI` plus the bootstrap variables and start the server once — if the `admins`
collection is empty the account is created automatically:

```env
MONGODB_URI="mongodb+srv://USER:PASSWORD@cluster.mongodb.net/gusb?retryWrites=true&w=majority"
MONGODB_DB="gusb"
BOOTSTRAP_ADMIN_NAME="Site Administrator"
BOOTSTRAP_ADMIN_EMAIL="you@yourorg.org"
BOOTSTRAP_ADMIN_PASSWORD="a-strong-password"
JWT_SECRET="a-long-random-string"
```

The bootstrap runs only while no account exists, so it is safe to leave configured.

**2. First-run form on the website**

Start the server with only `MONGODB_URI` set, then open **/admin/login**. When MongoDB is connected
and the `admins` collection is empty, the page shows **প্রথম অ্যাডমিন তৈরি করুন** instead of the
login form. Submit name + email + password (min. 8 characters). After that, log in as usual.

**3. CLI**

```bash
npm run create-admin -- --email you@yourorg.org --password 'a-strong-password' --name 'Site Administrator'
```

### If login says MongoDB is unreachable

`MONGODB_URI` being present in `.env` is not enough — the process must actually connect. Check:

1. **Atlas → Network Access** — allow this server’s IP, or `0.0.0.0/0` while testing.
2. **Atlas → Database Access** — username / password must match the URI. URL-encode special
   characters in the password (`@` → `%40`, `#` → `%23`, `%` → `%25`).
3. **Database name** — put it in the URI path (`...mongodb.net/gusb?...`). If the URI has no db
   name, the app uses `MONGODB_DB` (default `gusb`) instead of mongoose’s `test` database.
4. Restart the app after changing env vars. `GET /api/health` reports `{ mongo: { connected } }`.

### If an upload says "আপনার সেশন শেষ হয়েছে … আবার লগইন করুন।" (session ended)

That message means the server answered **401/403** — the admin's stored token no
longer verifies. The panel itself still opens (the list endpoints are public),
so the failure usually only shows up on the first photo/video upload or edit.
Causes, in order of likelihood:

1. **The server restarted without a persistent `JWT_SECRET`.** When the env var
   is missing, a new random signing key is generated on every boot and *all*
   logged-in sessions die. Fix: set a random `JWT_SECRET` (16+ characters) in
   the host's environment variables (e.g. Render → Environment), restart, then
   log in again.
2. **The token expired** — tokens live for 7 days. Just log in again.
3. **The account was removed or deactivated** in *অ্যাডমিন ব্যবস্থাপনা* — re-enable
   it (the login page now shows the server's specific message for this case).

The dashboard now verifies the stored session on load and bounces the admin to
the login page with an explanation, so this never surprises them mid-upload.

### Emergency insert in Atlas (only if you must)

Only do this if the app cannot run the methods above. Collection: **`admins`** (in the `gusb`
database, not `test`). Generate a hash locally, then insert **`passwordHash`** — never `password`:

```bash
node -e "require('bcryptjs').hash('YourPasswordHere', 12).then(console.log)"
```

```json
{
  "name": "Site Administrator",
  "email": "you@yourorg.org",
  "passwordHash": "<bcrypt hash from the command above>",
  "role": "admin",
  "isActive": true
}
```

### Managing further admins from the panel

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
  config/        mongo, persistence (JSON cache), env (JWT secret, ephemeral-host check)
  controllers/   all API handlers (CRUD + auth + settings + page-content)
                 uploadController.ts — returns the Cloudinary asset / discards an orphan
  middleware/    auth (JWT), rate limiting, upload.ts (multer → Cloudinary, JSON-only guard)
  models/        mongoose schemas (incl. Admin) + empty content store
  services/      adminService (MongoDB CRUD + bootstrap + first-run setup)
                 storage.ts — the ONE place files are written (Cloudinary, no fallback)
  utils/         assets.ts (asset refs in JSON bodies + release-on-replace/delete)
  routes/api.ts  all /api routes
scripts/create-admin.ts  CLI to add an admin (`npm run create-admin`)
src/
  admin/         admin dashboard + per-module managers
  components/    Navbar, Footer, HeroSlider, StatsCounter, cards, map, video, PDF
                 admin/AssetField.tsx      single-file picker (upload on pick + preview)
                 admin/AssetBatchField.tsx multi-image picker for the gallery
  context/       Auth, Language, Settings (applies theme colors), Toast (upload feedback)
  hooks/         useFetch (reads), useSaveAction (saves + toasts + 401 handling)
  lib/upload.ts  XHR uploader (progress, abort, validation, limits from the server)
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
| `MONGODB_URI` | **yes** | MongoDB connection — stores all admin accounts **and all site content** |
| `MONGODB_DB` | no (default `gusb`) | Database name when the URI path does not include one |
| `BOOTSTRAP_ADMIN_EMAIL` | first run | Email of the automatically created first admin |
| `BOOTSTRAP_ADMIN_PASSWORD` | first run | Password of the first admin (min. 8 chars) |
| `BOOTSTRAP_ADMIN_NAME` | no | Display name of the first admin |
| `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET` | **yes in prod** | Cloudinary for all uploads (incl. video). Without it, production uploads are refused |
| `CLOUDINARY_URL` | no | Alternative single-string Cloudinary credential |
| `CLOUDINARY_FOLDER` | no (default `vdo_bogura`) | Root folder inside the Cloudinary media library; each kind gets a sub-folder (`gallery`, `hero`, `videos`, …) |
| `MAX_IMAGE_UPLOAD_MB` | no (default 10) | Max size of one image (gallery, hero, thumbnails, logos) |
| `MAX_VIDEO_UPLOAD_MB` | no (default 512) | Max size of one uploaded video (`MAX_UPLOAD_MB` is still accepted as the legacy name) |
| `MAX_DOCUMENT_UPLOAD_MB` | no (default 25) | Max size of an admin PDF / DOCX (notices, publications, circulars) |
| `MAX_APPLICATION_UPLOAD_MB` | no (default 5) | Max size of a CV uploaded by a job applicant (public endpoint) |

## 📄 API overview (all under `/api`)

`health` (Mongo / Cloudinary / content-persistence status), `auth/status` (Mongo + whether first-run setup is needed), `auth/setup` (create the first admin when the collection is empty), `auth/login`, `auth/me`, `admins` (GET/POST/PUT/DELETE, admin role only), `hero-slides`, `programs`, `news`, `videos` (see below), `notices`, `publications`,
`gallery/albums` (+ `/photos`), `committee`, `partners`, `career` (+ `/applications`),
`stats`, `settings`, `page-content`, plus the upload endpoints `uploads/image`, `uploads/logo`,
`uploads/video`, `uploads/document`, `uploads/cv`, `uploads/limits` and `uploads/discard`.
Public reads are open; writes require a valid admin JWT (settings & page-content additionally require the
`admin` role).

### How an upload works now

```
admin picks a file →  POST /api/uploads/<kind>  (multipart, one file)
                      → streamed to Cloudinary  → 201 { url, publicId, resourceType, bytes, … }
                      → picker shows progress + a toast, keeps the returned asset in form state
admin presses Save   →  POST/PUT /api/<entity>   (plain JSON: { title, thumbnail: {url, publicId}, … })
```

* The file is uploaded **the moment it is selected** — no hidden "staged" file that only
  travels when the form is saved, which is what used to fail quietly.
* Success **and** failure produce a toast (`src/context/ToastContext.tsx`); a failed upload never
  leaves the form looking ready.
* `publicId` is stored next to every URL so that replacing or deleting a record also destroys the
  Cloudinary file (`server/utils/assets.ts` → `releaseAsset`). Uploaded-but-abandoned files are freed
  through `uploads/discard`.
* Entity endpoints are **JSON only**: a browser tab still running the previous bundle gets a
  `415 stale_client` answer that tells the admin to hard-reload instead of saving an empty record.
* `GET /api/uploads/limits` returns the server-side ceilings so the pickers validate the same sizes.

## 🎬 Two-way video upload

Videos can be added in **two ways** from **/admin → ভিডিও গ্যালারি**, and both end up in the same public
video library (Home highlight + Gallery → ভিডিও গ্যালারি).

| Way | How | Where the file lives | Thumbnail |
| --- | --- | --- | --- |
| **Device upload** | Drag & drop / pick an MP4, WebM, MOV, MKV… (up to `MAX_VIDEO_UPLOAD_MB`, default 512 MB). The file starts uploading immediately with a progress bar that can be cancelled. | **Cloudinary** (chunked `upload_large`). Without credentials the upload is refused (503) — in development as well as in production | Auto poster frame from Cloudinary (`so_2`); a custom image can be uploaded instead |
| **YouTube / Vimeo link** | Paste any URL: `watch?v=`, `youtu.be/`, `/shorts/`, `/live/`, `/embed/`, `player.vimeo.com/…`, even a bare 11-char YouTube id. `?t=90` start offsets are preserved. | Nothing is stored — the video is embedded from the provider | `https://i.ytimg.com/vi/<id>/hqdefault.jpg` automatically (overridable) |

### Enabling Cloudinary

```env
CLOUDINARY_CLOUD_NAME="your-cloud"
CLOUDINARY_API_KEY="123456789012345"
CLOUDINARY_API_SECRET="your-secret"
```

Put these in `.env` (loaded automatically) and restart — `GET /api/health` should then report
`storage.durable: true`. Uploaded videos get a Cloudinary CDN URL, `/api/videos/stream/:id`
302-redirects to it, and deleting a video also destroys the Cloudinary asset. Without credentials every
device upload is refused (YouTube/Vimeo links keep working, since nothing is stored for them).

### Video API

| Method | Endpoint | Body |
| --- | --- | --- |
| `GET` | `/api/videos` | – |
| `POST` | `/api/videos` | JSON: `title`, `description`, `category`, `type: 'upload'` + `filePath` (the asset from `/api/uploads/video`, or its URL), **or** `type: 'embed'` + `embedUrl`/`youtubeUrl`. `duration` is taken from Cloudinary; `type` is also detected from what the form sent |
| `PUT` | `/api/videos/:id` | same fields (JSON); a new `filePath` releases the previous asset |
| `DELETE` | `/api/videos/:id` | – (also destroys the Cloudinary asset) |
| `GET` | `/api/videos/stream/:id` | redirects to Cloudinary (or to the embed page) |

## 🖼️ Photo Gallery uploads

Gallery writes require a valid admin/editor JWT. Every picture is uploaded on its own through
`POST /api/uploads/image?folder=gallery`, so the album endpoints are plain JSON:

| Method | Endpoint | Body |
| --- | --- | --- |
| `POST` | `/api/gallery/albums` | `title`, optional `description`, optional `photos: [{ url, publicId, caption? }]`, optional `cover` (defaults to the first photo) |
| `PUT` | `/api/gallery/albums/:id` | `title`, `description`, `cover` |
| `POST` | `/api/gallery/albums/:id/photos` | `photos: [{ url, publicId }]` (+ one shared `caption`, or a `captions[]` per photo) |
| `DELETE` | `/api/gallery/photos/:id` / `/api/gallery/albums/:id` | – (destroys the Cloudinary file once no record refers to it) |

`MAX_GALLERY_PHOTOS` (40) pictures per request are accepted; JPG/JPEG, PNG, WEBP, AVIF and GIF pass the
server's MIME/extension check and the `MAX_IMAGE_UPLOAD_MB` per-file limit.
