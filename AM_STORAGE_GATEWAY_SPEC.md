# AM Storage Gateway Specification & Integration Contract

> **Target Audience:** Developers / AI Agents building or maintaining the **AM Storage (st-gateway)** backend service.  
> **Purpose:** Full technical requirement, API specification, authentication schemas, and site lifecycle integration contract for the **GUSB (Village Development Organization Bogura)** web platform.

---

## 1. System Overview & Architecture

The GUSB web application uses a dual-storage strategy:
1. **Cloudinary:** Used exclusively for images (JPG, PNG, WebP, SVG, AVIF) and videos (MP4, WebM, MOV).
2. **AM Storage Gateway (st-gateway):** Used exclusively for all **documents and PDFs** (PDF, DOC, DOCX, TXT) across administrative modules and public application forms.

### Why a Dedicated Storage Gateway is Required:
- Production hosts (Render, Railway, Heroku, VPS containers) have ephemeral disks that wipe local storage upon redeployment.
- Documents (governance notices, financial reports, annual publications, applicant CVs) must be stored durably with persistent/signed HTTPS delivery URLs.
- The GUSB web client renders PDFs directly in interactive browser modals (`<iframe>`) and provides direct download triggers.

---

## 2. Gateway API Specifications

The gateway server (e.g., `https://st.thamjj13.top`) MUST expose the following REST endpoints and adhere to this exact contract.

### 2.1. Base URL Configuration
The website connects to the gateway using the environment variable:
```env
AM_STORAGE_BRIDGE_URL=https://st.thamjj13.top
AM_STORAGE_KEY_ID=am_store_live_xxxxxxxx
AM_STORAGE_KEY_SECRET=am_sec_live_xxxxxxxx
AM_STORAGE_AUTH_MODE=dual    # Options: 'dual' (default) or 'hmac'
```

---

### 2.2. Authentication Specifications

The gateway must support at least one of the two authentication mechanisms (preferably both):

#### Mode A: `dual` (Header-based Authentication — Default)
Sent over HTTPS on every request:
| Header | Value | Description |
| :--- | :--- | :--- |
| `X-AM-Storage-Key-Id` | `am_store_live_...` | Public Key ID issued for the application |
| `X-AM-Storage-Key-Secret` | `am_sec_live_...` | Private Secret Key issued for the application |
| `Accept` | `application/json` | Client expects JSON response |

#### Mode B: `hmac` (Cryptographic Signature Mode)
Sent over HTTPS on every request:
| Header | Value | Description |
| :--- | :--- | :--- |
| `X-AM-Storage-Key-Id` | `am_store_live_...` | Public Key ID |
| `X-AM-Storage-Timestamp` | `1725984000` | Unix epoch timestamp (seconds) |
| `X-AM-Storage-Signature` | `hex(HMAC_SHA256(secret, "<timestamp>:<sha256(body)>"))` | SHA256 HMAC signature |
| `Accept` | `application/json` | Client expects JSON response |

---

### 2.3. Endpoint 1: Upload Document / PDF

- **Route:** `POST /api/v1/storage/upload`
- **Content-Type:** `multipart/form-data; boundary=----AMStorage...`
- **Request Body Parts:**
  1. `file`: Binary file stream (MIME: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`).
  2. `title`: UTF-8 string (Document title / label, max 200 characters).

#### Accepted File Constraints:
- **Extensions:** `.pdf`, `.doc`, `.docx`, `.txt`
- **Maximum File Size:**
  - Admin uploads (Notices, Publications, Circulars): Up to **25 MB** (configurable via `MAX_DOCUMENT_UPLOAD_MB`).
  - Job Applicant CVs: Up to **5 MB** (configurable via `MAX_APPLICATION_UPLOAD_MB`).

#### Expected Success Response (HTTP 200 or 201):
The gateway **MUST** return a JSON object containing at least `url` (valid public/signed HTTPS URL) and optionally `file.id`:

```json
{
  "success": true,
  "data": {
    "file": {
      "id": "doc_9876543210",
      "title": "Official Annual Report 2025-2026",
      "size": 2458900,
      "bytes": 2458900,
      "mime": "application/pdf",
      "status": "ready",
      "retention": "permanent"
    },
    "url": "https://st.thamjj13.top/files/doc_9876543210/Official_Annual_Report.pdf"
  }
}
```

*(Note: The client also tolerates direct structures such as `{ "file": { "id": "...", "url": "..." }, "url": "..." }` or `{ "url": "https://..." }`)*

#### Expected Error Response (HTTP 400 / 401 / 403 / 500):
The gateway must return JSON, **NEVER** an HTML error page:
```json
{
  "success": false,
  "error": "invalid_credentials",
  "message": "Invalid Key ID or Secret provided."
}
```

---

### 2.4. Endpoint 2: Delete Stored Document

When an admin updates a record, replaces a PDF, or deletes a notice/publication/application, the GUSB server triggers cleanup.

- **Route:** `DELETE /api/v1/storage/files/:fileId`
- **Headers:** Auth headers (`X-AM-Storage-Key-Id`, etc.)
- **Expected Success Response:** HTTP 200 OK or 204 No Content
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```
*(If the file is already gone, return HTTP 404 with JSON)*

---

### 2.5. Document Delivery & Viewer Requirements (Critical)

PDFs uploaded to the gateway are displayed inside the website's built-in **`PDFViewerModal`** using an `<iframe>`:
```html
<iframe src="https://st.thamjj13.top/files/.../notice.pdf#toolbar=1" />
```

For the viewer and download buttons to work seamlessly across all browsers:
1. **MIME Header:** Must send `Content-Type: application/pdf` (or proper document MIME).
2. **CORS Headers:** Must include `Access-Control-Allow-Origin: *` or allow the website origin.
3. **Framing Policy:** Do **NOT** send `X-Frame-Options: DENY` or restrictive `Content-Security-Policy: frame-ancestors 'none'` on the delivered file URL, otherwise the browser will block the in-page PDF viewer modal.
4. **Content-Disposition:** Should support inline rendering (e.g. `inline; filename="notice.pdf"`) while also supporting direct download when requested.

---

## 3. PDF & Document Workflows on the GUSB Website

Here is how each module on the website interacts with the document storage:

### 1. Notice Board (`/notices` & `/admin/notices`)
- **Use Case:** Official notices, circulars, tender announcements, executive orders.
- **Payload:** `title`, `referenceNo`, `publishedAt`, `expiryDate`, `pdfFile` (URL returned by gateway), `pdfFilePublicId` (`amstorage/<fileId>`).
- **User Experience:** Visitors click "দেখুন" (View) to open an inline PDF viewer modal with zoom/print/page controls, or "ডাউনলোড" to download the PDF.

### 2. Publications & Reports (`/publications` & `/admin/publications`)
- **Use Case:** Annual reports, research papers, newsletters, financial audit reports.
- **Payload:** `title`, `type` (`annual_report` | `newsletter` | `report`), `year`, `thumbnail` (Cloudinary image URL), `pdfFile` (AM Storage URL), `pdfFilePublicId`.
- **User Experience:** Displays a publication card with a cover image, publication year, and direct download/view PDF buttons.

### 3. Career Circulars (`/career` & `/admin/career`)
- **Use Case:** Job recruitment circulars.
- **Payload:** `title`, `deadline`, `vacancy`, `location`, `description`, optional `pdfFile` (AM Storage URL for the official circular PDF).
- **User Experience:** Candidates can read the job details and download the official circular document.

### 4. Job Applications & CV Submissions (`/career` public form & `/admin/career`)
- **Use Case:** Public candidates applying for jobs.
- **Endpoint:** `POST /api/uploads/cv` (Streamed to gateway `POST /api/v1/storage/upload`)
- **Payload:** `name`, `email`, `phone`, `careerId`, `notes`, `cvFile` (AM Storage URL), `cvPublicId`.
- **User Experience:** Admin reviews candidate applications and downloads their submitted CVs (PDF/DOCX) from the admin panel.

---

## 4. End-to-End Data Flow

```
[User Browser / Admin Panel]
         │
         │ 1. Picks PDF/DOCX (Client validation: max 25MB admin, 5MB CV)
         ▼
[GUSB Express Backend]  ─── POST /api/uploads/document or /api/uploads/cv
         │
         │ 2. Assembles multipart stream (file + title)
         │ 3. Injects Auth Headers (X-AM-Storage-Key-Id / Secret)
         ▼
[AM Storage Gateway (st-gateway)] ─── POST /api/v1/storage/upload
         │
         │ 4. Validates credentials & stores file durably
         │ 5. Returns JSON { data: { file: { id }, url: "https://..." } }
         ▼
[GUSB Express Backend]
         │
         │ 6. Receives gateway response
         │ 7. Formats asset { url, publicId: "amstorage/<id>", storage: "am-storage" }
         ▼
[Admin CMS / Mongo Database]
         │
         │ 8. Saves { title, pdfFile: url, pdfFilePublicId: "amstorage/<id>" }
         ▼
[Public Visitors]
         │
         │ 9. Opens PDF inside <iframe src="url#toolbar=1" /> or downloads file
```

---

## 5. Gateway Implementation Checklist (For the Gateway Developer / AI)

If you are implementing or fixing the gateway backend (Next.js App Router / Express / Fastify / Go / Python):

- [ ] **Check 1: Route Exists**  
  Ensure `POST /api/v1/storage/upload` is mounted and listening. If using Next.js, create `app/api/v1/storage/upload/route.ts` (App Router) or `pages/api/v1/storage/upload.ts` (Pages Router).
- [ ] **Check 2: JSON Response Only**  
  Ensure all status codes (200, 400, 401, 403, 404, 500) return a valid `Content-Type: application/json` body, never an HTML error page.
- [ ] **Check 3: Multipart Parser**  
  Accept multipart fields `file` (binary) and `title` (text). Disable default Next.js body parser if using Pages Router (`export const config = { api: { bodyParser: false } }`).
- [ ] **Check 4: Authentication Verification**  
  Check incoming `X-AM-Storage-Key-Id` and `X-AM-Storage-Key-Secret` against your database / env credentials.
- [ ] **Check 5: Persistent Storage**  
  Save the file to S3, MinIO, Cloudflare R2, or persistent volume disk, and generate a permanent or long-lived HTTPS signed URL.
- [ ] **Check 6: DELETE Route**  
  Implement `DELETE /api/v1/storage/files/[id]` to purge deleted documents and free storage.
- [ ] **Check 7: CORS & Framing**  
  Add `Access-Control-Allow-Origin: *` and ensure PDF files can be embedded in browser iframes.

---

## 6. Reference Implementation for the Gateway (Next.js App Router Example)

Here is a ready-to-use reference handler for `app/api/v1/storage/upload/route.ts` on the gateway server:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const keyId = req.headers.get('x-am-storage-key-id');
    const keySecret = req.headers.get('x-am-storage-key-secret');

    // 1. Verify Credentials
    if (!keyId || !keySecret || keyId !== process.env.VALID_KEY_ID || keySecret !== process.env.VALID_KEY_SECRET) {
      return NextResponse.json(
        { success: false, error: 'unauthorized', message: 'Invalid or missing API credentials' },
        { status: 401 }
      );
    }

    // 2. Parse Multipart Form
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || file?.name || 'Document';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'no_file', message: 'No document file provided in payload' },
        { status: 400 }
      );
    }

    const fileId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 3. Save to storage (S3 / R2 / Persistent Disk)
    // await s3.putObject({ Bucket: '...', Key: `${fileId}-${file.name}`, Body: buffer, ContentType: file.type });
    
    // 4. Generate Delivery URL
    const publicUrl = `https://${req.headers.get('host')}/api/v1/storage/files/raw/${fileId}/${encodeURIComponent(file.name)}`;

    // 5. Return Document Object
    return NextResponse.json({
      success: true,
      data: {
        file: {
          id: fileId,
          title,
          size: buffer.length,
          bytes: buffer.length,
          mime: file.type || 'application/pdf',
          status: 'ready'
        },
        url: publicUrl
      }
    }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'server_error', message: error.message || 'Internal storage failure' },
      { status: 500 }
    );
  }
}
```

---

*This specification represents the complete, binding technical interface for the GUSB document storage system.*
