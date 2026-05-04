# HealthCircle Google Cloud deployment guide

This guide moves HealthCircle from the old Replit-style deployment to Google
Cloud. It is written for a first deployment, with commands you can copy and
paste.

## What is already working

The repository already contains the main product code:

- React/Vite PWA: `artifacts/askhealth`
  - installable PWA manifest: `artifacts/askhealth/public/manifest.json`
  - service worker: `artifacts/askhealth/public/sw.js`
  - build output: `artifacts/askhealth/dist/public`
- Express API: `artifacts/api-server`
  - server entrypoint: `artifacts/api-server/src/index.ts`
  - health check: `/api/healthz`
  - WebSocket signaling for teleconsult: `/api/tc/ws/session/:id`
- PostgreSQL schema and Drizzle commands: `lib/db`
- Same-origin API calls: the browser calls `/api/...` on the same domain.
- Session auth uses a secure `__session` cookie on Firebase Hosting rewrites
  and still reads legacy `sid` cookies for direct Cloud Run sessions, so
  production must use HTTPS.

The Google deployment added here keeps the frontend and API on the same Cloud
Run HTTPS origin. That is the simplest first move because it preserves cookies,
`/api` routes, and WebSockets without needing a second hosting product.

## Files added or changed for Google Cloud

- `Dockerfile` builds the monorepo, the PWA, and the API into one container.
- `.dockerignore` keeps local/build-only files out of the image.
- `cloudbuild.yaml` builds and deploys the container to Cloud Run.
- `artifacts/api-server/src/app.ts` now:
  - trusts Google's proxy for correct client IPs/rate limits.
  - serves the compiled PWA in production.
  - falls back to `index.html` for client-side routes.

## Target architecture

```text
Browser / installed PWA
  |
  | HTTPS
  v
Cloud Run service: healthcircle
  |-- serves React PWA static files
  |-- handles /api/*
  |-- handles WebSocket teleconsult signaling
  |
Cloud SQL for PostgreSQL
Secret Manager for application secrets
```

You can later add a custom domain, Firebase Hosting, Cloud CDN, or separate
frontend hosting. Start with one Cloud Run service first.

## One-time prerequisites

Install and log in to the Google Cloud CLI on your computer:

```bash
gcloud auth login
gcloud auth application-default login
```

Pick values for these variables. Replace the examples with your own project and
region.

```bash
export PROJECT_ID="your-google-project-id"
export REGION="asia-south1"
export SERVICE_NAME="healthcircle"
export DB_INSTANCE="healthcircle-db"
export DB_NAME="healthcircle"
export DB_USER="healthcircle"
```

Set the project:

```bash
gcloud config set project "$PROJECT_ID"
```

Enable required APIs:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com
```

Create an Artifact Registry repository for Docker images:

```bash
gcloud artifacts repositories create healthcircle \
  --repository-format=docker \
  --location="$REGION" \
  --description="HealthCircle Cloud Run images"
```

If Google says the repository already exists, continue.

## Create the Cloud SQL PostgreSQL database

Create the database instance:

```bash
gcloud sql instances create "$DB_INSTANCE" \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region="$REGION" \
  --storage-size=10GB
```

Create the database:

```bash
gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE"
```

Create a strong password locally:

```bash
openssl rand -hex 24
```

Copy that value and set it as the database user password. The `-hex` format is
intentional because it is safe inside the database connection URL.

```bash
export DB_PASSWORD="paste-the-password-here"
gcloud sql users create "$DB_USER" \
  --instance="$DB_INSTANCE" \
  --password="$DB_PASSWORD"
```

Build the Cloud SQL Unix-socket database URL:

```bash
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${PROJECT_ID}:${REGION}:${DB_INSTANCE}"
```

## Create secrets

Create the required secrets:

```bash
printf "%s" "$DATABASE_URL" | gcloud secrets create DATABASE_URL --data-file=-
openssl rand -base64 48 | gcloud secrets create SESSION_SECRET --data-file=-
openssl rand -base64 32 | gcloud secrets create ADMIN_TOKEN --data-file=-
```

Optional but recommended secrets:

```bash
printf "%s" "HealthCircle <no-reply@your-domain.com>" | gcloud secrets create EMAIL_FROM --data-file=-
printf "%s" "your-resend-api-key" | gcloud secrets create RESEND_API_KEY --data-file=-
printf "%s" "your-google-oauth-client-id.apps.googleusercontent.com" | gcloud secrets create GOOGLE_CLIENT_ID --data-file=-
```

The first deploy only attaches the required secrets. After the first deploy,
attach optional secrets with commands in the email, AI, and Google sign-in
sections when you are ready to configure those features.

AI features require provider keys or proxy endpoints. If you still have Replit
AI integration URLs, replace them with your new provider/proxy values:

```bash
printf "%s" "https://your-openai-compatible-base-url" | gcloud secrets create AI_INTEGRATIONS_OPENAI_BASE_URL --data-file=-
printf "%s" "your-openai-api-key" | gcloud secrets create AI_INTEGRATIONS_OPENAI_API_KEY --data-file=-
printf "%s" "https://your-anthropic-compatible-base-url" | gcloud secrets create AI_INTEGRATIONS_ANTHROPIC_BASE_URL --data-file=-
printf "%s" "your-anthropic-api-key" | gcloud secrets create AI_INTEGRATIONS_ANTHROPIC_API_KEY --data-file=-
```

If you skip the AI secrets, the app still deploys, but AI chat/summary features
return "service not configured" style errors.

The first deploy below only attaches the required secrets. After the service is
deployed, attach any optional secrets you created with:

```bash
gcloud run services update "$SERVICE_NAME" \
  --region="$REGION" \
  --update-secrets=EMAIL_FROM=EMAIL_FROM:latest \
  --update-secrets=RESEND_API_KEY=RESEND_API_KEY:latest \
  --update-secrets=GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest \
  --update-secrets=AI_INTEGRATIONS_OPENAI_BASE_URL=AI_INTEGRATIONS_OPENAI_BASE_URL:latest \
  --update-secrets=AI_INTEGRATIONS_OPENAI_API_KEY=AI_INTEGRATIONS_OPENAI_API_KEY:latest \
  --update-secrets=AI_INTEGRATIONS_ANTHROPIC_BASE_URL=AI_INTEGRATIONS_ANTHROPIC_BASE_URL:latest \
  --update-secrets=AI_INTEGRATIONS_ANTHROPIC_API_KEY=AI_INTEGRATIONS_ANTHROPIC_API_KEY:latest
```

Only include the lines for secrets you actually created. For example, if you
only created `GOOGLE_CLIENT_ID`, run the command with just that
`--update-secrets` line.

## Let Cloud Build and Cloud Run read secrets and Cloud SQL

Find your project number:

```bash
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
```

Allow Cloud Build to deploy Cloud Run:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

Create a runtime service account:

```bash
gcloud iam service-accounts create healthcircle-runner \
  --display-name="HealthCircle Cloud Run runtime"
```

Allow the runtime service account to connect to Cloud SQL and read secrets:

```bash
export RUNTIME_SA="healthcircle-runner@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

## First deploy

From the repository root:

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions=_REGION="$REGION",_SERVICE="$SERVICE_NAME",_CLOUD_SQL_INSTANCE="${PROJECT_ID}:${REGION}:${DB_INSTANCE}",_SERVICE_ACCOUNT="$RUNTIME_SA"
```

When it completes, get your Cloud Run URL:

```bash
gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --format='value(status.url)'
```

Open:

```text
https://YOUR-CLOUD-RUN-URL/api/healthz
```

You should see:

```json
{"status":"ok"}
```

Then open the root URL and confirm the PWA loads.

### If Google Console says `gcr.io repo does not exist`

The Docker build itself is healthy if you see both of these complete:

```text
pnpm --filter @workspace/askhealth run build
pnpm --filter @workspace/api-server run build
```

If the build fails later with this message:

```text
denied: gcr.io repo does not exist. Creating on push requires the artifactregistry.repositories.createOnPush permission
```

you are using Google Console's default Docker build trigger, not the
`cloudbuild.yaml` deployment command above. That console trigger pushes to a
legacy `gcr.io/...` image path. Create the `gcr.io` compatibility repository
and give Cloud Build permission to push there:

```bash
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

gcloud artifacts repositories create gcr.io \
  --repository-format=docker \
  --location=us \
  --description="gcr.io compatibility repository"

gcloud artifacts repositories add-iam-policy-binding gcr.io \
  --location=us \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

If Google says the repository already exists, only run the permission command.
After that, rerun the failed build.

For the cleaner long-term setup, configure the trigger to use
`cloudbuild.yaml`; that file pushes to:

```text
${REGION}-docker.pkg.dev/$PROJECT_ID/healthcircle/healthcircle
```

## Apply the database schema

The app needs PostgreSQL tables before real sign-in and content flows work.
The simplest beginner-friendly way is to run the Drizzle push from your machine
using the Cloud SQL Auth Proxy.

Install the Cloud SQL Auth Proxy:

```bash
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.18.3/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy
```

Start the proxy in one terminal:

```bash
./cloud-sql-proxy "${PROJECT_ID}:${REGION}:${DB_INSTANCE}" --port 5432
```

In a second terminal, from the repo root:

```bash
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/db run seed-providers
pnpm --filter @workspace/db run seed-communities
```

Then restart the Cloud Run service so startup seed checks run against the fresh
schema:

```bash
gcloud run services update "$SERVICE_NAME" --region="$REGION"
```

## Bootstrap your first admin

1. Open the Cloud Run URL.
2. Sign up with your email.
3. After you are signed in, call the one-time bootstrap endpoint:

```bash
curl -X POST \
  -H "Cookie: sid=YOUR_BROWSER_SID_COOKIE" \
  "https://YOUR-CLOUD-RUN-URL/api/admin/bootstrap"
```

For a novice-friendly path, I can also add a small temporary admin bootstrap
page or command later. Do not share your `ADMIN_TOKEN` publicly.

## Google sign-in setup

In Google Cloud Console:

1. Go to **APIs & Services > OAuth consent screen**.
2. Configure your app name, support email, and domain.
3. Go to **Credentials > Create Credentials > OAuth client ID**.
4. Choose **Web application**.
5. Add your Cloud Run/custom domain to **Authorized JavaScript origins**.
6. Add the client ID as the `GOOGLE_CLIENT_ID` secret.
7. Redeploy Cloud Run.

## Add a custom domain

Cloud Run can map a domain directly:

```bash
gcloud run domain-mappings create \
  --service "$SERVICE_NAME" \
  --domain "app.your-domain.com" \
  --region "$REGION"
```

Google will show DNS records to add at your domain registrar.

After the domain works, update Google OAuth authorized origins to include:

```text
https://app.your-domain.com
```

## Updating the app later

Every time code changes:

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions=_REGION="$REGION",_SERVICE="$SERVICE_NAME",_CLOUD_SQL_INSTANCE="${PROJECT_ID}:${REGION}:${DB_INSTANCE}",_SERVICE_ACCOUNT="$RUNTIME_SA"
```

## Smoke test checklist

- `/api/healthz` returns `{"status":"ok"}`.
- The landing page loads over HTTPS.
- Browser DevTools > Application shows the manifest and service worker.
- Sign-in creates a secure `__session` cookie on the Firebase-hosted domain.
- `/communities`, `/chat`, `/providers`, and `/teleconsult` load after sign-in.
- Teleconsult WebSocket flow works in two browser windows.
- Admin bootstrap works once, then refuses after an admin exists.
- Cloud Run logs do not show database connection errors.

## Important notes

- The old `.replit` and `.replit-artifact` files can stay for history, but they
  are no longer used by the Google deployment.
- The app currently stores uploads as inline/base64 data in PostgreSQL. For real
  production media uploads, the next Google-native improvement should be Cloud
  Storage signed uploads.
- The current database workflow uses `drizzle-kit push`. For a mature
  production setup, add versioned Drizzle migrations and run them as a controlled
  release step.
