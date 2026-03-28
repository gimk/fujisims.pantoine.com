# Cloudflare Worker — Deployment Guide

This Worker is the backend for the `/submit` page. It validates the Turnstile CAPTCHA, then uses the GitHub API to create a branch, commit the recipe Markdown file and example images, and open a Pull Request for your review.

---

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com) (free tier is enough)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed: `npm install -g wrangler`
- A GitHub **Personal Access Token** with:
  - `Contents: Read & Write` (to push files to the repo)
  - `Pull requests: Read & Write` (to open PRs)
  - Scoped to **only this repository**
  - Generate at: https://github.com/settings/tokens?type=beta (Fine-grained tokens recommended)
- A Cloudflare **Turnstile site** (free):
  - Create at: https://dash.cloudflare.com/?to=/:account/turnstile
  - Copy the **Site Key** (for the frontend) and **Secret Key** (for the Worker)

---

## Step 1 — Configure `wrangler.toml`

Edit `cloudflare-worker/wrangler.toml` and fill in your GitHub username and repo name:

```toml
[vars]
GITHUB_OWNER  = "your-github-username"
GITHUB_REPO   = "fujisims.pantoine.com"
GITHUB_BRANCH = "master"
```

---

## Step 2 — Set Secrets

From inside the `cloudflare-worker/` directory:

```bash
cd cloudflare-worker
wrangler login           # authenticate with Cloudflare
wrangler secret put GITHUB_TOKEN
# paste your GitHub PAT when prompted

wrangler secret put TURNSTILE_SECRET
# paste your Turnstile Secret Key when prompted
```

---

## Step 3 — Deploy the Worker

```bash
wrangler deploy
```

Take note of the Worker URL printed at the end (e.g. `https://fujisims-submission.your-subdomain.workers.dev`).

---

## Step 4 — Update the Submit Page

In `src/pages/submit.astro`, replace the two placeholders:

```js
// Line near the top of the <script> block:
const WORKER_URL = 'https://fujisims-submission.your-subdomain.workers.dev';
```

```html
<!-- In the Turnstile widget div: -->
data-sitekey="YOUR_TURNSTILE_SITE_KEY"
```

---

## Step 5 — Add the Submit Link to the Homepage (optional)

The homepage (`src/pages/index.astro`) already has a header; you can add a "Submit" pill link next to the portfolio pill.

---

## Workflow Summary

```
User visits /submit
  → Fills form + photos (compressed in-browser to ~1–3 MB each)
  → Completes Turnstile CAPTCHA
  → Submits → Worker receives JSON

Worker:
  1. Verifies Turnstile token
  2. Creates a branch: submission/<slug>-<timestamp>
  3. Uploads images to src/assets/recipes/<slug>/
  4. Creates src/content/recipes/<slug>.md
  5. Opens PR: "[Recipe Submission] <Recipe Name>"

You:
  → Receive GitHub email notification
  → Review PR on github.com (images + markdown diff)
  → Merge → GitHub Actions builds → recipe is live in ~2 min
  → Or close → recipe discarded
```

---

## Updating the Worker

```bash
cd cloudflare-worker
wrangler deploy
```

---

## Local Testing

```bash
wrangler dev
```

This starts a local server at `http://localhost:8787`. Update `WORKER_URL` in `submit.astro` temporarily to test end-to-end locally (note: Turnstile won't work in local mode without `wrangler dev --local` + a localhost-allowed site key).
