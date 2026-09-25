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
- **Persistence – MongoDB only, one collection per content type** – every hero slide, program, news
  item, video, notice, publication, album, photo, committee member, partner, circular, application,
  stat, the settings and the page copy is **its own document in its own MongoDB collection**
  (`heroslides`, `programs`, `newsitems`, `videos`, `notices`, `publications`, `galleryalbums`,
  `galleryphotos`, `committeemembers`, `partners`, `careers`, `applications`, `stats`, `sitesettings`,
  `pagecontents`). The old “one JSON blob + a `data/store.json` cache” design is **gone**: nothing is
  ever written to the server's disk, so a deploy can no longer wipe content. Writes are diffed, so
  only the collections that really changed are sent to MongoDB.
- **Fail-closed** – if MongoDB is unreachable an admin save is answered with **503 “not saved”**
  instead of a green tick followed by data loss, and the change is pushed as soon as the connection
  returns. An empty in-memory store can never overwrite populated collections.
- **Automatic backups** – point-in-time snapshots of the whole content (MongoDB `contentbackups` +
  a copy on AM Storage): on a schedule, after edits, before every restore and on shutdown. **If the
  database ever turns out to be empty at boot, the newest snapshot is restored automatically**, and
  the admin panel can list / download / restore / upload snapshots.
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
| **All site content** (slides, programs, news, videos, gallery records, notices, publications, committee, partners, stats, settings, page copy, CV applications) | **MongoDB — one document per record, one collection per type** | **no edit can be saved** (the panel answers 503 “সংরক্ষণ করা যায়নি”) — nothing is silently lost, and nothing is written to the disk |
| **Uploaded images & videos** | Cloudinary only | every upload is **refused** with an explanatory (Bengali) error — there is deliberately **no local-disk fallback any more** |
| **Uploaded documents** (PDFs, DOC/DOCX/TXT, applicant CVs) | AM Storage gateway (`server/services/amStorage.ts`, `POST /api/v1/storage/upload`) — Cloudinary cannot host the site's PDFs | the upload is **refused** with a 503 + reason; override the built-in credentials with `AM_STORAGE_BRIDGE_URL`, `AM_STORAGE_KEY_ID`, `AM_STORAGE_KEY_SECRET` (`AM_STORAGE_AUTH_MODE=hmac` for signed requests) |

> **Why content used to disappear after every update:** the old design kept every record in ONE JSON
> document (`sitecontents`) plus a `data/store.json` file on the container's own disk — and on Render /
> Heroku / Railway that disk is wiped on every deploy. One bad write (or a database that was not
> reachable at boot) therefore emptied the whole site. Both are gone: content is one document per
> record in MongoDB, nothing is written to the disk, an unreachable database refuses the edit instead
> of losing it, and the newest automatic snapshot is restored when a database ever comes up empty.
>
> **Photos:** the old upload code wrote files into `./uploads` on the container disk whenever Cloudinary
> was missing, returned HTTP 200 and showed a green message — and the next deploy wiped the folder.
> That fallback has been **deleted**: `server/services/storage.ts` has exactly one destination
> (Cloudinary). If it is not configured, `POST /api/uploads/*` answers **503 with the reason**, the
> picker shows a red toast, and nothing is saved — silence is now impossible. The admin dashboard also
> shows a red banner until Cloudinary **and** MongoDB are configured correctly (see “Cloudinary is not
> connected — but the pictures load?” below for what each colour means).

### 🔍 Analysis: why content disappeared — and what prevents it now

| # | What could go wrong before | What happens now |
| --- | --- | --- |
| 1 | Content lived in **one** MongoDB document (`sitecontents`) *plus* a `data/store.json` file on the container disk. One failed/partial write emptied the whole site. | Every record is its own document in its own collection. A bad write can only affect the record being saved. |
| 2 | Render/Heroku/Railway **delete the disk on every deploy**, so any content that only existed in `data/store.json` was gone after the update. | Nothing is ever written to the disk. There is no file to lose. |
| 3 | When MongoDB was unreachable the server still answered “saved”, kept the edit in memory — and lost it on the next restart. | An unreachable database makes the save fail with **503**; the change stays queued and is written the moment the connection returns. |
| 4 | A fresh deploy pointing at an empty/wrong database showed an empty site with no explanation. | On boot an empty database is first filled from the previous architecture (`sitecontents` blob → `data/store.json`) and then from the newest **automatic snapshot**; the admin banner reports exactly where the content came from. |
| 5 | Pictures uploaded while Cloudinary was missing went to `./uploads`, answered HTTP 200 and vanished on the next deploy. | Uploads have exactly one destination: Cloudinary (images/videos) or the AM Storage gateway (PDFs). If either is unavailable the upload is **refused with the reason** — never silently “saved”. |
| 6 | No way back after a loss. | **Automatic backups** every few hours, after edits, before restores and on shutdown — in MongoDB *and* on AM Storage — restorable from `/admin → ব্যাকআপ ও রিস্টোর` with one click. |

Two checks make the state visible instead of silent: `GET /api/health`
(`content.durable`, `content.source`, `content.counts`, `backup.*`) and the admin
banner, which turns red while anything is not durable.

### Minimum environment for a live server (Render → *Environment*)

```env
NODE_ENV=production
JWT_SECRET=<long random string>
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/gusb?retryWrites=true&w=majority
CLOUDINARY_CLOUD_NAME=<from cloudinary.com dashboard>
CLOUDINARY_API_KEY=<from cloudinary.com dashboard>
CLOUDINARY_API_SECRET=<from cloudinary.com dashboard>
# Optional — PDF/document gateway (defaults are built in, set these to rotate keys)
# AM_STORAGE_BRIDGE_URL=https://st.thamjj13.top/api/v1
# AM_STORAGE_KEY_ID=ng_key_…
# AM_STORAGE_KEY_SECRET=ng_live_…
```

After saving the variables, redeploy once and open **/admin** — the banner at the top should turn green
(“সব ঠিক আছে”). `GET /api/health` returns `storage.durable: true` and `content.durable: true`.

There is nothing to switch on: local-disk storage no longer exists in the code base, so the same
Cloudinary rules apply in development and in production.

### 🛡️ Automatic backups & recovery (no more “all my data is gone”)

The server snapshots the **entire** content (every collection, plus settings and page copy):

| When | Why |
| --- | --- |
| every `BACKUP_INTERVAL_MINUTES` (default 6 h) | a daily safety net |
| ~10 s after a content edit (at most one per `BACKUP_MIN_INTERVAL_MINUTES`, default 30 min) | protects the newest work |
| before every restore | a mistaken restore can be undone |
| on a graceful shutdown (deploy / restart) | nothing edited in between is lost |

Each snapshot is written to the `contentbackups` MongoDB collection **and** mirrored to AM Storage as a
`.txt` file (best effort). Retention keeps the newest `BACKUP_KEEP` snapshots (default 40); manual and
pre-restore snapshots are pinned.

**Recovery is automatic:** when the server boots and MongoDB holds *no content at all* while at least
one snapshot exists, the newest snapshot is restored and the admin banner reports it. If an
administrator deletes the last record **on purpose**, that decision is remembered (`contentmeta`) and
the content is *not* resurrected.

From **/admin → ব্যাকআপ ও রিস্টোর** (full administrators) you can:
take a snapshot now, download any snapshot, restore it (a safety snapshot is written first), delete it,
open the AM Storage cloud copy, or restore from a downloaded/uploaded backup file.

```bash
# API
GET    /api/backups               # list + status
POST   /api/backups               # snapshot now
GET    /api/backups/:id/download  # download JSON
POST   /api/backups/:id/restore   # restore (a pre-restore snapshot is taken first)
DELETE /api/backups/:id
POST   /api/backups/upload        # restore from an uploaded backup file
```

### ✅ Run check (do this before every deploy)

```bash
npm run check                     # type check + content tests + build + boot probe
MONGODB_URI="mongodb://127.0.0.1:27017/gusb-check" npm run check   # + end-to-end database test
```

It (1) type-checks, (2) runs the 55-check content test (load / write / migration / backup / restore /
fail-closed, no database needed), (3) builds the frontend and the server bundle, (4) boots the app and
probes every public API route, and (5) — when `MONGODB_URI` is set — runs a real create → restart →
wipe → auto-restore round trip in a throw-away database.

### “Cloudinary is not connected” — but the pictures load?

Pictures that are already on the site load straight from Cloudinary's public CDN
(`https://res.cloudinary.com/<cloud>/…`) — **no API key or secret is involved**. Only *new uploads* use
the key and secret, so broken credentials never show up on the public site. The admin banner checks the
credentials themselves:

| Banner | Meaning | What to do |
| --- | --- | --- |
| green “সব ঠিক আছে — Cloudinary সংযুক্ত” | Cloudinary accepted the credentials | nothing |
| grey “যাচাই করা হচ্ছে…” | the check is still running (right after a restart) | wait a few seconds |
| amber “সাময়িকভাবে পৌঁছানো যাচ্ছে না” | network trouble / Cloudinary outage — **not** a credential problem | nothing; it re-checks automatically (15 s → 5 min) |
| red, names the value (cloud name / API key / API secret / permission) | Cloudinary rejected that value; the banner shows Cloudinary's own answer and which variable each value came from | fix that variable, restart, press **আবার যাচাই** |

How the check works (`server/services/storage.ts`, `server/config/cloudinaryEnv.ts`):

- **Values are cleaned first.** Surrounding quotes, leading/trailing spaces or newlines, a trailing comma,
  invisible zero-width characters and a pasted `CLOUDINARY_API_KEY=` prefix are stripped (hosting panels and
  copy-paste add these, and Cloudinary then answers *Invalid cloud_name* / *Unknown API key* / *Invalid
  Signature*). Each correction is listed in the banner so the variable can be tidied up. Common alternative
  names (`CLOUDINARY_SECRET`, `CLOUDINARY_KEY`, `CLOUD_NAME`, …) are accepted, and a separate variable wins
  over the same part of `CLOUDINARY_URL`. A malformed `CLOUDINARY_URL` is ignored instead of crashing the server.
- **It runs in the background and repeats.** The check never delays the server start and is retried
  automatically after a failure; **আবার যাচাই** runs a fresh one (`GET /api/storage/status?verify=1`).
- **The Upload API has the last word.** If the Admin API refuses the ping — it can be restricted on its own
  (Settings → Security → allowed Admin API IPs, or an API key role without Admin permissions) while uploads
  work — a 1×1 test image is uploaded (and deleted) instead.
- **One bad file is not a broken connection.** A file Cloudinary refuses (e.g. larger than the plan allows)
  gets its own message (HTTP 413/422) and does not turn the banner red.

`GET /api/storage/status` (signed-in panel users) returns the same status as `/api/health` plus diagnostics:
the cloud name, the **masked** API key, the secret's length (never the secret), which variable each value
came from, the automatic corrections, and the cloud names the saved images point at — a mismatch there
means the credentials belong to a different Cloudinary account than the pictures.

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
  config/        mongo (connection + reachability), env (JWT secret, ephemeral-host check),
                 contentDb.ts — the ONLY place MongoDB is touched (one collection per type),
                 persistence.ts — the façade controllers call (`persistStore()` → 503 on failure)
  controllers/   all API handlers (CRUD + auth + settings + page-content + backups)
                 uploadController.ts — returns the Cloudinary asset / discards an orphan
  middleware/    auth (JWT), rate limiting, upload.ts (multer → Cloudinary, JSON-only guard)
  models/        schemas.ts — Admin model + the in-memory content cache
  services/      contentStore.ts  the content repository: load, diff-write, migrate, restore
                 backupService.ts automatic snapshots (MongoDB + AM Storage) & auto-recovery
                 adminService     MongoDB CRUD + bootstrap + first-run setup
                 storage.ts       the ONE place files are written (Cloudinary, no fallback)
                 amStorage.ts     PDF/document gateway bridge
  utils/         assets.ts (asset refs in JSON bodies + release-on-replace/delete)
  routes/api.ts  all /api routes
scripts/
  create-admin.ts   CLI to add an admin (`npm run create-admin`)
  run-check.ts      `npm run check` — type check + content test + build + boot probe + e2e
  smoke-test.ts     55-check content test against an in-memory MongoDB (no database needed)
  e2e-test.ts       live create → restart → wipe → auto-restore test (needs MONGODB_URI)
  lib/memoryMongo.ts  the in-memory MongoDB substitute used by the tests
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
| `BACKUP_ENABLED` | no (default `true`) | Automatic content snapshots |
| `BACKUP_INTERVAL_MINUTES` | no (default `360`) | One snapshot at least this often |
| `BACKUP_MIN_INTERVAL_MINUTES` | no (default `30`) | Minimum gap between two edit-triggered snapshots |
| `BACKUP_KEEP` | no (default `40`) | How many snapshots are kept (manual/pre-restore ones are pinned) |
| `BACKUP_MIRROR_AM_STORAGE` | no (default `true`) | `false` = keep snapshots in MongoDB only |
| `BOOTSTRAP_ADMIN_EMAIL` | first run | Email of the automatically created first admin |
| `BOOTSTRAP_ADMIN_PASSWORD` | first run | Password of the first admin (min. 8 chars) |
| `BOOTSTRAP_ADMIN_NAME` | no | Display name of the first admin |
| `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET` | **yes in prod** | Cloudinary for all uploads (incl. video). Without it, production uploads are refused. Stray quotes/spaces are stripped automatically; `CLOUDINARY_SECRET`, `CLOUDINARY_KEY`, `CLOUD_NAME` … are accepted as alternative names |
| `CLOUDINARY_URL` | no | Alternative single-string Cloudinary credential (`cloudinary://KEY:SECRET@CLOUD`); a separate variable above overrides the matching part |
| `CLOUDINARY_FOLDER` | no (default `vdo_bogura`) | Root folder inside the Cloudinary media library; each kind gets a sub-folder (`gallery`, `hero`, `videos`, …) |
| `MAX_IMAGE_UPLOAD_MB` | no (default 10) | Max size of one image (gallery, hero, thumbnails, logos) |
| `MAX_VIDEO_UPLOAD_MB` | no (default 512) | Max size of one uploaded video (`MAX_UPLOAD_MB` is still accepted as the legacy name) |
| `MAX_DOCUMENT_UPLOAD_MB` | no (default 25) | Max size of an admin PDF / DOCX (notices, publications, circulars) |
| `MAX_APPLICATION_UPLOAD_MB` | no (default 5) | Max size of a CV uploaded by a job applicant (public endpoint) |

## 📄 API overview (all under `/api`)

`health` (Mongo / Cloudinary / content-persistence status), `storage/status` (same + credential diagnostics, signed-in users; `?verify=1` re-checks Cloudinary now), `auth/status` (Mongo + whether first-run setup is needed), `auth/setup` (create the first admin when the collection is empty), `auth/login`, `auth/me`, `admins` (GET/POST/PUT/DELETE, admin role only), `hero-slides`, `programs`, `news`, `videos` (see below), `notices`, `publications`,
`gallery/albums` (+ `/photos`), `committee`, `partners`, `career` (+ `/applications`),
`stats`, `settings`, `page-content`, the backup endpoints (`backups`, `backups/:id/download`,
`backups/:id/restore`, `backups/upload` — admin role only), plus the upload endpoints `uploads/image`,
`uploads/logo`, `uploads/video`, `uploads/document`, `uploads/cv`, `uploads/limits` and `uploads/discard`.
Public reads are open; writes require a valid admin JWT (settings, page-content and backups additionally
require the `admin` role). A write that could not reach MongoDB is answered with **503
`content_not_durable`**, never with a fake success.

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
