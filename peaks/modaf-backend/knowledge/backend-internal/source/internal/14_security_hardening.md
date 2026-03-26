# Security Hardening

> **TL;DR:** Lock down every layer -- validate inputs, encrypt data, manage secrets properly, set security headers, audit dependencies, and log everything that matters.

---

**Metadata**

| Field         | Value                          |
|---------------|--------------------------------|
| ID            | `backend-internal-014`         |
| Category      | Security                       |
| Audience      | Backend engineers              |
| Last reviewed | 2026-03-26                     |
| Status        | Active                         |

---

## 1. OWASP Top 10 Prevention

### 1.1 Injection (A03:2021)

**Rule: Always use parameterized queries. Never concatenate user input into SQL strings.**

```typescript
// DANGEROUS -- SQL injection risk
const query = `SELECT * FROM users WHERE email = '${email}'`;

// SAFE -- parameterized query
const user = await prisma.user.findUnique({ where: { email } });

// SAFE -- raw parameterized query when ORM is insufficient
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email} AND status = ${status}
`;
```

Use the ORM by default. Resort to raw queries only when the ORM cannot express the query, and always parameterize. This applies to every data store -- SQL, NoSQL, LDAP, OS commands.

For shell commands, never interpolate user input. Use `child_process.execFile` (not `exec`) with an explicit argument array:

```typescript
import { execFile } from 'node:child_process';

// SAFE -- arguments are not shell-interpreted
execFile('convert', [inputPath, '-resize', '800x600', outputPath]);
```

### 1.2 Broken Authentication (A07:2021)

- **Password hashing:** Use `bcrypt` with a cost factor of at least 12, or `argon2id` for new projects.
- **Token rotation:** Refresh tokens must be single-use. On each refresh, issue a new refresh token and invalidate the old one.
- **Session management:** Set short-lived access tokens (15 minutes). Store refresh tokens server-side with an expiry (7-30 days). Invalidate all sessions on password change.
- **Brute-force protection:** Rate-limit login endpoints (5 attempts per minute per IP/account). Lock account after 10 consecutive failures; require email verification to unlock.

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

### 1.3 Sensitive Data Exposure (A02:2021)

- **Encrypt at rest:** AES-256-GCM for application-level encryption; enable database-level encryption (PostgreSQL TDE or AWS RDS encryption).
- **Encrypt in transit:** TLS 1.3 minimum. Redirect all HTTP to HTTPS. Use HSTS headers.
- **Redact logs:** Strip passwords, tokens, credit card numbers, SSNs, and PII from all log output. Use a structured logger with a redaction plugin.

```typescript
const redactedFields = ['password', 'token', 'authorization', 'cookie', 'ssn', 'creditCard'];

function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...obj };
  for (const field of redactedFields) {
    if (field in redacted) {
      redacted[field] = '[REDACTED]';
    }
  }
  return redacted;
}
```

### 1.4 XML External Entity Processing (XXE) (A05:2021)

**Best approach: do not accept XML.** Use JSON for all API communication.

If XML is required (legacy integrations), disable external entity processing:

```typescript
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  allowBooleanAttributes: false,
  processEntities: false,       // Disable entity expansion
  htmlEntities: false,
});
```

### 1.5 Broken Access Control (A01:2021)

Check ownership on every request. Server-side authorization is mandatory -- never rely on client-side checks.

```typescript
// Middleware: verify the authenticated user owns the resource
async function verifyOwnership(req: Request, res: Response, next: NextFunction) {
  const resource = await prisma.document.findUnique({
    where: { id: req.params.id },
  });

  if (!resource) return res.status(404).json({ error: 'Not found' });
  if (resource.ownerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  req.resource = resource;
  next();
}
```

Enforce the principle of least privilege: users get only the permissions they need. Default to deny.

### 1.6 Security Misconfiguration (A05:2021)

- Set security headers on every response (see section 2).
- Disable debug mode in production (`NODE_ENV=production`).
- Remove default credentials from all services (databases, admin panels, message queues).
- Disable directory listing on static file servers.
- Remove `X-Powered-By` header (Express: `app.disable('x-powered-by')` or use Helmet).

### 1.7 Cross-Site Scripting (XSS) (A03:2021)

- **Output encoding:** Encode all dynamic content rendered in HTML context.
- **Content Security Policy:** Set a strict CSP header (see section 2).
- **Input sanitization:** Sanitize HTML input with `DOMPurify` (server-side via `jsdom`) if rich text is allowed.
- For APIs that return JSON only, XSS risk is lower but CSP headers should still be set to protect any admin UI.

### 1.8 Insecure Deserialization (A08:2021)

- Validate all deserialized data with a schema validator (Zod, Joi).
- Type-check every field. Never trust the shape of incoming data.
- Avoid `eval()`, `Function()`, `JSON.parse()` on untrusted input without schema validation afterward.

```typescript
import { z } from 'zod';

const UserUpdateSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  role: z.enum(['user', 'editor']),  // Never allow 'admin' from user input
});

// Parse throws on invalid data
const validated = UserUpdateSchema.parse(req.body);
```

### 1.9 Using Components with Known Vulnerabilities (A06:2021)

- Run `npm audit` in CI on every build. Fail the build on high/critical severity.
- Integrate Snyk or GitHub Dependabot for automated dependency scanning.
- Set up automated PRs for security patches (Renovate or Dependabot).
- Pin major versions in `package.json`; commit `package-lock.json`.
- Review changelogs before merging dependency updates.

### 1.10 Insufficient Logging & Monitoring (A09:2021)

Log the following events at minimum:

| Event                      | Log Level | Details to include                       |
|----------------------------|-----------|------------------------------------------|
| Login success/failure      | `info`    | User ID, IP, user-agent, timestamp       |
| Password change            | `info`    | User ID, timestamp                       |
| Role/permission change     | `warn`    | User ID, old role, new role, changed by  |
| Data access (sensitive)    | `info`    | User ID, resource type, resource ID      |
| Admin actions              | `warn`    | Admin ID, action, target, timestamp      |
| Rate limit exceeded        | `warn`    | IP, endpoint, count                      |
| Authorization failure      | `warn`    | User ID, resource, attempted action      |
| Application error (500)    | `error`   | Stack trace, request context (redacted)  |

Set up alerts for: >5 failed logins in 1 minute, any admin action, any 500 error spike.

---

## 2. Security Headers (Helmet.js)

Install and configure Helmet as the first middleware:

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Tighten if possible
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    interest_cohort: [],
  },
}));
```

### Header summary

| Header                        | Value                                          | Purpose                           |
|-------------------------------|-------------------------------------------------|-----------------------------------|
| `Strict-Transport-Security`   | `max-age=31536000; includeSubDomains; preload` | Force HTTPS for 1 year            |
| `Content-Security-Policy`     | `default-src 'self'`                           | Restrict resource loading origins |
| `X-Content-Type-Options`      | `nosniff`                                      | Prevent MIME sniffing             |
| `X-Frame-Options`             | `DENY`                                         | Prevent clickjacking              |
| `X-XSS-Protection`           | `0`                                            | Deprecated; CSP replaces it       |
| `Referrer-Policy`             | `strict-origin-when-cross-origin`              | Limit referrer leakage            |
| `Permissions-Policy`          | `camera=(), microphone=(), geolocation=()`     | Disable browser features          |

---

## 3. Secrets Management

### 3.1 Core Rules

- **Never commit secrets to source control.** Not even "temporarily."
- Store all secrets as environment variables or in a secrets manager (AWS Secrets Manager, HashiCorp Vault, Doppler).
- Use `.env` files only for local development. They must be in `.gitignore`.

### 3.2 Rotation Policy

| Secret Type          | Rotation Frequency      | Trigger for Immediate Rotation         |
|----------------------|-------------------------|----------------------------------------|
| API keys             | Quarterly               | Suspected compromise, employee offboarding |
| Database passwords   | Monthly                 | Suspected compromise                   |
| JWT signing secrets  | On incident only        | Any auth-related security incident     |
| TLS certificates     | Before expiry (auto)    | Suspected private key compromise       |
| OAuth client secrets | Annually                | Suspected compromise                   |

### 3.3 Secret Scanning

Install pre-commit hooks to block secrets before they reach the repository:

```bash
# Install git-secrets
brew install git-secrets  # or build from source
git secrets --install
git secrets --register-aws

# Add custom patterns
git secrets --add 'PRIVATE.KEY'
git secrets --add '[A-Za-z0-9]{40}'  # Generic long tokens (tune to reduce false positives)
```

Run `truffleHog` in CI for historical scanning:

```bash
trufflehog git file://. --only-verified --fail
```

---

## 4. Dependency Security

- **Lockfile:** Always commit `package-lock.json`. Run `npm ci` (not `npm install`) in CI.
- **Audit in CI:** Add `npm audit --audit-level=high` to the CI pipeline. Fail on high or critical.
- **Automated PRs:** Enable Dependabot or Renovate for automatic security patch PRs.
- **License compliance:** Use `license-checker` to ensure no GPL-licensed dependencies leak into proprietary code.

---

## 5. Request Validation

Set limits to prevent abuse:

```typescript
import express from 'express';

const app = express();

// Body size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// File upload limit (if applicable)
// Configure multer with: limits: { fileSize: 10 * 1024 * 1024 } // 10MB

// Request timeout
app.use((req, res, next) => {
  req.setTimeout(30_000); // 30 seconds
  next();
});
```

Additional limits:
- **Max URL length:** 2048 characters (reject longer with 414).
- **Max header size:** 8KB (Node.js default; adjust with `--max-http-header-size` if needed).
- **Max query parameters:** 100 (prevent hash collision DoS).

---

## 6. IP Filtering

For compliance or restricted environments, implement optional IP allow/deny lists:

```typescript
import { Request, Response, NextFunction } from 'express';

const ALLOWED_IPS = process.env.ALLOWED_IPS?.split(',') ?? [];
const DENIED_IPS = process.env.DENIED_IPS?.split(',') ?? [];

function ipFilter(req: Request, res: Response, next: NextFunction) {
  const clientIp = req.ip || req.socket.remoteAddress || '';

  if (DENIED_IPS.length > 0 && DENIED_IPS.includes(clientIp)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (ALLOWED_IPS.length > 0 && !ALLOWED_IPS.includes(clientIp)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}
```

For geo-blocking (GDPR, export controls), use a GeoIP database (MaxMind GeoLite2) and block by country code.

---

## 7. Canonical Security Middleware Setup

```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();

// 1. Security headers
app.use(helmet());

// 2. CORS (restrict origins)
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 3. Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                    // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
}));

// 4. Stricter rate limit on auth endpoints
app.use('/api/auth', rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 5,
  message: { error: 'Too many auth attempts, please try again later' },
}));

// 5. Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 6. Remove x-powered-by
app.disable('x-powered-by');
```

---

## 8. Security Audit Checklist

Run these commands to verify security posture. All should pass before any production deployment.

```bash
# 1. Check for known vulnerable dependencies
npm audit --audit-level=high

# 2. Scan for hardcoded secrets
npx trufflehog git file://. --only-verified --fail

# 3. Verify .env is gitignored
git ls-files --error-unmatch .env 2>&1 | grep -q "not find" && echo "PASS" || echo "FAIL: .env is tracked"

# 4. Check that debug mode is off in production config
grep -r "DEBUG=true" .env.production && echo "FAIL" || echo "PASS"

# 5. Verify security headers are set (requires running server)
curl -sI https://your-app.example.com | grep -i "strict-transport-security"
curl -sI https://your-app.example.com | grep -i "content-security-policy"
curl -sI https://your-app.example.com | grep -i "x-content-type-options"

# 6. Check for outdated dependencies
npm outdated

# 7. Verify lockfile integrity
npm ci --ignore-scripts && echo "PASS" || echo "FAIL"

# 8. Check Node.js version is LTS and supported
node -v  # Should be 20.x or 22.x LTS

# 9. Ensure no default ports exposed unnecessarily
# Review docker-compose.yml and Dockerfile for exposed ports
```

---

## Summary

Security is not a feature -- it is a constraint that applies to every feature. Apply defense in depth: validate at the edge, authorize in the middleware, encrypt in the data layer, and log everything. No single measure is sufficient; the combination is what matters.
