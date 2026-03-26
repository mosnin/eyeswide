# File Storage System

> **TL;DR:** Abstract file storage behind a provider interface so you can swap between S3, Supabase Storage, Cloudflare R2, or local filesystem without changing application code. Validate uploads strictly, organize files by tenant and resource, and serve private files through signed URLs.

---

**Status:** Stable
**Last updated:** 2026-03-26
**Applies to:** modaf-backend >=1.0
**Tags:** storage, uploads, s3, files, images, cdn, presigned-urls

---

## Storage Abstraction

All file operations go through a provider interface. The application code never calls S3 or filesystem APIs directly.

### Canonical Storage Interface

```typescript
// src/lib/storage/types.ts
export interface StorageProvider {
  upload(params: UploadParams): Promise<UploadResult>;
  download(key: string): Promise<ReadableStream>;
  delete(key: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  getPublicUrl(key: string): string;
  exists(key: string): Promise<boolean>;
  metadata(key: string): Promise<FileMetadata>;
}

export interface UploadParams {
  key: string;
  body: Buffer | ReadableStream;
  contentType: string;
  contentLength: number;
  metadata?: Record<string, string>;
  acl?: "public-read" | "private";
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  etag: string;
}

export interface FileMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag: string;
  metadata: Record<string, string>;
}
```

### Provider Implementations

| Provider | Best For | Notes |
|----------|----------|-------|
| AWS S3 | Production, large scale | Industry standard, rich ecosystem |
| Supabase Storage | Supabase-native stacks | Built-in RLS, tight Supabase integration |
| Cloudflare R2 | Cost-sensitive, no egress fees | S3-compatible API, zero egress cost |
| Local filesystem | Development, testing | Never use in production |

Select the provider via environment variable:

```typescript
// src/lib/storage/index.ts
import { S3StorageProvider } from "./providers/s3";
import { LocalStorageProvider } from "./providers/local";
import { R2StorageProvider } from "./providers/r2";

export function createStorageProvider(): StorageProvider {
  switch (env.STORAGE_PROVIDER) {
    case "s3":
      return new S3StorageProvider(env.S3_BUCKET, env.AWS_REGION);
    case "r2":
      return new R2StorageProvider(env.R2_BUCKET, env.R2_ACCOUNT_ID);
    case "local":
      return new LocalStorageProvider(env.LOCAL_STORAGE_PATH);
    default:
      throw new Error(`Unknown storage provider: ${env.STORAGE_PROVIDER}`);
  }
}
```

---

## Upload Patterns

### 1. Direct Upload (Client -> Server -> Storage)

The client sends the file to your API. The server validates it and forwards it to storage.

- **Pros:** Server has full control; can validate, transform, and scan before storing.
- **Cons:** Server becomes a bottleneck for large files; doubles bandwidth usage.
- **Use when:** Files are small (<10MB), you need server-side processing before storage, or you need strict validation.

### 2. Presigned URL Upload (Server Generates URL, Client Uploads Directly)

The client requests an upload URL from the server. The server generates a presigned URL with constraints (max size, allowed content type). The client uploads directly to storage.

- **Pros:** No bandwidth through your server; scales better for large files.
- **Cons:** Less control over what gets uploaded; need post-upload validation.
- **Use when:** Files are large (>10MB), you want to reduce server load, or you need resumable uploads.

```typescript
// Generate presigned upload URL
async function createPresignedUpload(params: {
  filename: string;
  contentType: string;
  maxSize: number;
  tenantId: string;
}) {
  const key = buildFileKey(params.tenantId, params.filename);

  const url = await storage.getSignedUploadUrl(key, {
    contentType: params.contentType,
    maxContentLength: params.maxSize,
    expiresIn: 600, // 10 minutes
  });

  return { url, key };
}
```

### 3. Multipart Upload (For Files >100MB)

For very large files, break the upload into chunks. Each chunk is uploaded independently and can be retried without re-uploading the entire file.

- Initiate the multipart upload on the server, get an upload ID.
- Client uploads parts (minimum 5MB per part except the last).
- Server completes the multipart upload, assembling all parts.
- If the upload is abandoned, configure a lifecycle rule to clean up incomplete uploads after 24 hours.

---

## File Validation

Validate every upload before accepting it. Never trust the client.

### MIME Type Checking

Maintain a whitelist of allowed MIME types per upload context:

```typescript
const ALLOWED_MIME_TYPES = {
  avatar: ["image/jpeg", "image/png", "image/webp"],
  document: ["application/pdf", "text/plain", "application/msword"],
  media: ["image/jpeg", "image/png", "image/webp", "video/mp4", "audio/mpeg"],
} as const;
```

Check the actual file content, not just the `Content-Type` header. Use a library like `file-type` to detect the real MIME type from magic bytes:

```typescript
import { fileTypeFromBuffer } from "file-type";

const detected = await fileTypeFromBuffer(buffer);
if (!detected || !allowedTypes.includes(detected.mime)) {
  throw new ValidationError("File type not allowed");
}
```

### File Size Limits

| Context | Per Upload | Per User (Monthly) | Per Organization |
|---------|-----------|-------------------|------------------|
| Avatar | 5 MB | 50 MB | - |
| Document | 50 MB | 500 MB | 10 GB |
| Media | 200 MB | 2 GB | 50 GB |

Enforce limits at the middleware level (reject before reading the full body) and again at the storage level (presigned URL constraints).

### Image Dimensions

```typescript
import sharp from "sharp";

const metadata = await sharp(buffer).metadata();

if (metadata.width && metadata.width > 8000) {
  throw new ValidationError("Image width exceeds 8000px maximum");
}
if (metadata.height && metadata.height > 8000) {
  throw new ValidationError("Image height exceeds 8000px maximum");
}
```

### Virus Scanning

For applications handling sensitive or user-generated content, integrate ClamAV:

```typescript
import NodeClam from "clamscan";

const clam = await new NodeClam().init({ clamdscan: { active: true } });
const { isInfected, viruses } = await clam.scanStream(fileStream);

if (isInfected) {
  logger.warn({ viruses }, "Infected file detected");
  throw new ValidationError("File failed security scan");
}
```

---

## File Organization

### Path Structure

```
/{tenant_id}/{resource}/{id}/{filename}
```

Examples:

```
/org_abc123/avatars/usr_xyz789/profile-a1b2c3.webp
/org_abc123/documents/inv_456def/invoice-2026-03.pdf
/org_abc123/media/post_789ghi/header-image-d4e5f6.jpg
```

### Filename Sanitization

1. Strip all characters except alphanumerics, hyphens, underscores, and dots.
2. Lowercase the entire filename.
3. Append a short hash for uniqueness (first 6 chars of SHA-256).
4. Preserve the file extension.

```typescript
import { createHash } from "crypto";

function sanitizeFilename(original: string, buffer: Buffer): string {
  const ext = path.extname(original).toLowerCase();
  const base = path
    .basename(original, ext)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 6);
  return `${base}-${hash}${ext}`;
}
```

### Metadata Storage

Store file metadata in the database, not just in the storage provider:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `storage_key` | text | Full path in storage provider |
| `original_name` | text | User-provided filename |
| `mime_type` | text | Detected MIME type |
| `size_bytes` | bigint | File size in bytes |
| `uploaded_at` | timestamptz | Upload timestamp |
| `uploaded_by` | UUID | FK to users table |
| `tenant_id` | UUID | FK to organizations table |
| `resource_type` | text | What the file belongs to (avatar, document, etc.) |
| `resource_id` | UUID | FK to the owning resource |
| `checksum` | text | SHA-256 hash of file content |

---

## Access Control

### Public Files

Served through a CDN with permanent, predictable URLs. Use for assets that do not need access control: marketing images, public avatars, static content.

```
https://cdn.example.com/public/org_abc123/avatars/usr_xyz789/profile.webp
```

### Private Files

Never expose direct storage URLs. Generate **signed URLs** with a short expiration:

```typescript
async function getFileUrl(fileId: string, requestingUser: User): Promise<string> {
  const file = await db.files.findById(fileId);
  if (!file) throw new NotFoundError("File not found");

  // Check access
  await assertFileAccess(file, requestingUser);

  // Generate signed URL (15 minute default expiration)
  return storage.getSignedUrl(file.storageKey, 15 * 60);
}
```

### Role-Based Access

Before generating a signed URL, verify the requesting user has permission:

1. **Owner** -- the user who uploaded the file can always access it.
2. **Organization member** -- members of the same organization can access org files.
3. **Admin** -- admins can access all files within their organization.
4. **Public** -- only if the file is explicitly marked public.

---

## Canonical Upload Endpoint

```typescript
// src/routes/files/upload.ts
import { z } from "zod";
import { storage } from "@/lib/storage";
import { fileTypeFromBuffer } from "file-type";
import { sanitizeFilename, buildFileKey } from "@/lib/storage/utils";

const uploadSchema = z.object({
  resourceType: z.enum(["avatar", "document", "media"]),
  resourceId: z.string().uuid(),
});

export async function handleFileUpload(req: AuthenticatedRequest) {
  const { resourceType, resourceId } = uploadSchema.parse(req.body);
  const file = req.file;

  if (!file) {
    throw new ValidationError("No file provided");
  }

  // Validate MIME type
  const detected = await fileTypeFromBuffer(file.buffer);
  const allowedTypes = ALLOWED_MIME_TYPES[resourceType];
  if (!detected || !allowedTypes.includes(detected.mime)) {
    throw new ValidationError(`File type ${detected?.mime} not allowed`);
  }

  // Validate size
  const maxSize = MAX_FILE_SIZES[resourceType];
  if (file.buffer.length > maxSize) {
    throw new ValidationError(`File exceeds ${maxSize} byte limit`);
  }

  // Build storage key and sanitize filename
  const filename = sanitizeFilename(file.originalname, file.buffer);
  const key = buildFileKey(req.user.tenantId, resourceType, resourceId, filename);

  // Upload to storage
  const result = await storage.upload({
    key,
    body: file.buffer,
    contentType: detected.mime,
    contentLength: file.buffer.length,
    acl: "private",
  });

  // Save metadata to database
  const record = await db.files.create({
    storageKey: key,
    originalName: file.originalname,
    mimeType: detected.mime,
    sizeBytes: file.buffer.length,
    uploadedBy: req.user.id,
    tenantId: req.user.tenantId,
    resourceType,
    resourceId,
    checksum: createHash("sha256").update(file.buffer).digest("hex"),
  });

  // Queue thumbnail generation for images
  if (detected.mime.startsWith("image/")) {
    await mediaQueue.add("generate-thumbnail", {
      fileId: record.id,
      storageKey: key,
    });
  }

  return { id: record.id, url: result.url };
}
```

---

## Image Processing

### Thumbnail Generation

Process thumbnails asynchronously via the job queue. Never block the upload response.

### Resize Presets

| Preset | Dimensions | Use Case |
|--------|-----------|----------|
| `thumbnail` | 150x150 | Lists, grids, avatars |
| `medium` | 600x600 | Detail views, cards |
| `large` | 1200x1200 | Full-screen, hero images |

All resizes maintain aspect ratio (fit within the dimensions, do not stretch).

### Format Conversion

- Convert to **WebP** for web delivery (30-50% smaller than JPEG at equivalent quality).
- Keep the **original** file for archival and re-processing.
- Use quality setting of 80 for WebP (good balance of size and quality).

### CDN with Image Transformation

If your CDN supports on-the-fly transformations (Cloudflare Images, imgproxy, Imgix), skip pre-generating sizes. Request transformations via URL parameters:

```
https://cdn.example.com/images/key?width=150&height=150&fit=cover&format=webp
```

This reduces storage costs and simplifies the pipeline. Pre-generate only the most frequently accessed sizes.

---

## Cleanup

### Orphaned Files

Files whose database record has been deleted but the storage object remains. Run a weekly cleanup job:

1. List all storage keys in a given prefix.
2. Check each key against the database.
3. Delete keys with no matching database record.
4. Log deletions for audit purposes.

### Temp Files

Files in the `tmp/` prefix older than 24 hours. These come from incomplete multipart uploads or abandoned presigned URL flows.

```typescript
await cleanupQueue.add(
  "purge-temp-files",
  { maxAgeHours: 24 },
  { repeat: { pattern: "0 5 * * *" } }
);
```

### Old Versions

If you support file versioning, prune versions older than the retention policy (e.g., keep the last 5 versions or versions from the last 90 days).

---

## Common Pitfalls

1. **Trusting Content-Type headers** -- Always detect the real MIME type from the file content. Users can send any header.
2. **Storing files in the database** -- Store files in object storage, metadata in the database. Binary blobs in PostgreSQL destroy performance.
3. **Forgetting cleanup** -- Without lifecycle rules and cleanup jobs, storage costs grow unbounded.
4. **Exposing raw storage URLs** -- Direct S3 URLs leak bucket names and are permanent. Always use signed URLs or a CDN.
5. **No size limits** -- Without limits, a single user can exhaust your storage budget. Enforce per-upload, per-user, and per-org limits.
6. **Synchronous image processing** -- Resize and convert in the background. Blocking the upload request on processing degrades user experience.
