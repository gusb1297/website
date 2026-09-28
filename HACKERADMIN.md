# /hackeradmin — Operations Console (quick card)

**URL:** `/hackeradmin` (passcode gate) → `/hackeradmin/console` (the console)
**Passcode:** `Mohi@99221` — set `HACKER_ADMIN_PASSCODE` to change it.
**Session:** 12 hours, stored in its own browser key (`ngo_hacker_token`), independent of `/admin`.

```
┌ CONTROL ROOM ─── Database ON/OFF · Public Write Freeze · flush · reload · snapshot · live state
├ GATEWAYS ─────── add · edit · test · enable/disable · make primary · delete (am-storage / cloudinary / external)
├ ADMIN ACCOUNTS ─ create · disable · reset password · delete  (bcrypt, last active admin protected)
├ AUDIT LOG ────── every privileged action + every wrong passcode, with actor, IP and time
├ TELEMETRY ────── process · MongoDB · Cloudinary · document gateway · per-collection counts · snapshots
└ CONTENT 10–1D ─ all /admin modules (hero slider … settings) + backups & restore
```

## The two switches

**Database ON/OFF** — বন্ধ করলে:

* MongoDB সংযোগ সত্যিই বিচ্ছিন্ন হয়; পাবলিক সাইট মেমরির স্ন্যাপশট থেকেই চলতে থাকে (ভিজিটর কিছু বুঝবে না)।
* কোনো লেখা সংরক্ষিত হয় না — ৫০৩ উত্তর আসে, চুপচাপ হারায় না। **কিছুই ডিলিট হয় না।**
* সাধারণ `/admin` সেশন কাজ করে না (প্রতি রিকোয়েস্টে MongoDB-তে ভেরিফাই হয়)।
* **এই কনসোল কাজ করতে থাকে** — কনসোল টোকেন ডাটাবেসে ভেরিফাই হয় না, তাই আবার চালু করার পথ কখনো বন্ধ হয় না।
* আবার ON করলে রিকানেক্ট + অটো-সিঙ্ক। স্টেট `systemcontrol` কলেেকশনে থাকে, রিস্টার্টেও টিকে যায়।

**Public Write Freeze** — চালু থাকলে ভিজিটর/এডিটর কিছুই সংরক্ষণ করতে পারে না (`503 maintenance_mode`); পড়া, লগইন ও কনসোল স্বাভাবিক থাকে।

## Gateways (`storagegateways`)

| kind | কীসের জন্য |
| --- | --- |
| `am-storage` | PDF / DOC / CV — multipart bridge (auth: `dual` বা `hmac`) |
| `cloudinary` | ছবি ও ভিডিও — cloud name + API key/secret + folder |
| `external` | অন্য যেকোনো HTTP endpoint (একই multipart কনট্র্যাক্ট) |

* প্রতি kind-এ **একটি enabled + primary** গেটওয়ে আপলোডে ব্যবহৃত হয়; কোনো enabled গেটওয়ে না থাকলে ওই ধরনের আপলোড বন্ধ (মেসেজসহ), এবং অ্যাডমিন ব্যানারে তা দেখা যায়।
* সিক্রেট কখনো ব্রাউজারে ফেরত যায় না — শুধু মাস্ক (`ng_live_x…5Js`)।
* রেজিস্ট্রি লোড না হলে (DB বন্ধ) এনভায়রনমেন্ট ক্রেডেনশিয়াল আগের মতোই কাজ করে — গেটওয়ে সমস্যায় আপলোড কখনো ভাঙে না।
* `restore defaults` → এনভায়রনমেন্টের ডিফল্ট গেটওয়ে ফিরিয়ে আনে।

## API (সব `/api/hackeradmin` নিচে)

```
POST   /login                      passcode → token (৮ চেষ্টা/১০ মিনিট + per-IP লকআউট, অডিটেড)
GET    /session | /system          সেশন / সম্পূর্ণ সিস্টেম স্ন্যাপশট
POST   /database                   { enabled: boolean }
POST   /maintenance                { enabled: boolean, note? }
GET    /gateways                   তালিকা + এখন সত্যিই কোন গেটওয়ে রাউটিং করছে
POST   /gateways                   নতুন গেটওয়ে
PUT|DELETE /gateways/:id           পরিবর্তন / মুছে ফেলা
POST   /gateways/:id/test          কানেক্টিভিটি + ক্রেডেনশিয়াল প্রোব
POST   /gateways/restore-defaults
GET    /audit                      অডিট ট্রেইল
POST   /content/flush|reload|backup
GET|POST /admins · DELETE /admins/:id
```

## Environment

```env
HACKER_ADMIN_PASSCODE=        # খালি রাখলে বিল্ট-ইন Mohi@99221
```

## Verification

```bash
npm run lint            # TypeScript
npm run test:content    # ৫৫টি কনটেন্ট চেক (MongoDB লাগে না)
npm run test:console    # /hackeradmin স্ক্রিনগুলোর রেন্ডার টেস্ট
npm run check           # উপরের সব + বিল্ড + লাইভ বুট প্রোব (কনসোল রুট ও পাসকোড গেট সহ)
```
