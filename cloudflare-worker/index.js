/**
 * Fujifilm Simulation Recipes — Submission Worker
 *
 * Receives a recipe submission from the /submit page,
 * validates the Cloudflare Turnstile token, compresses nothing
 * (images are already compressed client-side), creates a branch on the
 * GitHub repo, commits the images + a .md file, then opens a Pull Request.
 *
 * Required Wrangler secrets (set via `wrangler secret put`):
 *   GITHUB_TOKEN   — GitHub PAT with `contents:write` and `pull-requests:write`
 *   TURNSTILE_SECRET — Cloudflare Turnstile secret key
 *
 * Required wrangler.toml vars:
 *   GITHUB_OWNER   — your GitHub username / org
 *   GITHUB_REPO    — repository name (e.g. fujisims.pantoine.com)
 *   GITHUB_BRANCH  — base branch to PR against (e.g. master)
 */

export default {
  async fetch(request, env) {
    // ── CORS preflight ──────────────────────────────────
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    if (request.method !== 'POST') {
      return corsResponse({ ok: false, message: 'Method not allowed' }, 405);
    }

    // ── Parse body ──────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse({ ok: false, message: 'Invalid JSON body' }, 400);
    }

    const { turnstileToken, recipe, images } = body;

    // ── Basic input validation ──────────────────────────
    if (!recipe?.name || !recipe?.core?.length || !images?.length) {
      return corsResponse({ ok: false, message: 'Missing required fields' }, 400);
    }
    if (images.length < 2 || images.length > 6) {
      return corsResponse({ ok: false, message: 'Please submit 2–6 images' }, 400);
    }

    // ── Validate Turnstile token ────────────────────────
    const turnstileValid = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, request);
    if (!turnstileValid) {
      return corsResponse({ ok: false, message: 'CAPTCHA verification failed' }, 403);
    }

    // ── Generate slug & ref ─────────────────────────────
    const slug = slugify(recipe.name);
    const refNo = `FJS-${slug.toUpperCase().replace(/-/g, '').slice(0, 6)}`;
    const branchName = `submission/${slug}-${Date.now()}`;
    const now = new Date().toISOString();

    // ── GitHub API helpers ──────────────────────────────
    const ghBase = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
    const ghHeaders = {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'fujisims-submission-worker/1.0',
    };

    try {
      // 1. Get the SHA of the base branch HEAD
      const refRes = await fetch(`${ghBase}/git/ref/heads/${env.GITHUB_BRANCH}`, { headers: ghHeaders });
      if (!refRes.ok) {
        const errBody = await refRes.text();
        throw new Error(`Failed to fetch base branch ref (HTTP ${refRes.status}): ${errBody}`);
      }
      const refData = await refRes.json();
      const baseSha = refData.object.sha;

      // 2. Create the new branch
      const branchRes = await fetch(`${ghBase}/git/refs`, {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
      });
      if (!branchRes.ok) {
        const err = await branchRes.json();
        throw new Error(`Failed to create branch: ${err.message}`);
      }

      // 3. Upload images one by one
      const imagePaths = [];
      const imageExifs = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        // dataUrl is "data:image/jpeg;base64,<DATA>"
        const base64 = img.dataUrl.split(',')[1];
        const ext = img.name.endsWith('.jpg') ? 'jpg' : 'jpg';
        const filePath = `src/assets/recipes/${slug}/${i + 1}.${ext}`;

        const uploadRes = await fetch(`${ghBase}/contents/${filePath}`, {
          method: 'PUT',
          headers: ghHeaders,
          body: JSON.stringify({
            message: `feat: add images for submission ${slug}`,
            content: base64,
            branch: branchName,
          }),
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(`Failed to upload image ${i + 1}: ${err.message}`);
        }
        imagePaths.push(`../../assets/recipes/${slug}/${i + 1}.${ext}`);
        imageExifs.push(img.exif || '');
      }

      // 4. Build the Markdown frontmatter
      const markdown = buildMarkdown({
        recipe,
        refNo,
        slug,
        imagePaths,
        imageExifs,
        submittedAt: now,
      });

      const mdBase64 = btoa(unescape(encodeURIComponent(markdown)));
      const mdPath = `src/content/recipes/${slug}.md`;

      const mdRes = await fetch(`${ghBase}/contents/${mdPath}`, {
        method: 'PUT',
        headers: ghHeaders,
        body: JSON.stringify({
          message: `feat: add recipe submission "${recipe.name}"`,
          content: mdBase64,
          branch: branchName,
        }),
      });
      if (!mdRes.ok) {
        const err = await mdRes.json();
        throw new Error(`Failed to create recipe file: ${err.message}`);
      }

      // 5. Open the Pull Request
      const prBody = buildPrBody({ recipe, refNo, slug, now });
      const prRes = await fetch(`${ghBase}/pulls`, {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({
          title: `[Recipe Submission] ${recipe.name}`,
          head: branchName,
          base: env.GITHUB_BRANCH,
          body: prBody,
        }),
      });
      if (!prRes.ok) {
        const err = await prRes.json();
        throw new Error(`Failed to open PR: ${err.message}`);
      }
      const prData = await prRes.json();

      return corsResponse({
        ok: true,
        message: 'Recipe submitted successfully',
        prUrl: prData.html_url,
      }, 200);

    } catch (err) {
      console.error('Worker error:', err);
      return corsResponse({ ok: false, message: err.message || 'Internal error' }, 500);
    }
  },
};

// ── Turnstile verification ──────────────────────────────
async function verifyTurnstile(token, secret, request) {
  if (!token || !secret) return false;
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  return data.success === true;
}

// ── Slug generator ──────────────────────────────────────
function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Markdown builder ────────────────────────────
function buildMarkdown({ recipe, refNo, slug, imagePaths, imageExifs, submittedAt }) {
  const author = recipe.author || 'Anonymous';
  const authorLine = recipe.authorLink ? `authorLink: "${recipe.authorLink}"\n` : '';
  const optLine = recipe.opt ? `opt: "${recipe.opt}"\n` : '';
  const descLine = recipe.description?.trim() ? recipe.description.trim() : 'A community-submitted Fujifilm simulation recipe.';

  const coreYaml = recipe.core
    .map(p => `  - label: "${p.label}"\n    value: "${p.value}"`)
    .join('\n');

  const adjYaml = recipe.adjustments
    .map(p => {
      const val = typeof p.value === 'number' ? p.value : `"${p.value}"`;
      return `  - label: "${p.label}"\n    value: ${val}`;
    })
    .join('\n');

  const imagesYaml = imagePaths.map(p => `  - "${p}"`).join('\n');

  // EXIF per image (extracted client-side before canvas stripped it)
  const exifsYaml = imageExifs && imageExifs.length
    ? `exif:\n${imageExifs.map(e => `  - "${e || ''}"`).join('\n')}\n`
    : '';

  return `---
name: "${recipe.name}"
refNo: "${refNo}"
version: "01.0"
calibration: "${recipe.calibration || 'X-TRANS V'}"
status: "Pending Review"
${optLine}author: "${author}"
${authorLine}submittedAt: "${submittedAt}"
core:
${coreYaml}
adjustments:
${adjYaml}
images:
${imagesYaml}
${exifsYaml}---

${descLine}
`;
}

// ── PR body builder ─────────────────────────────────────
function buildPrBody({ recipe, refNo, slug, now }) {
  const filmSim = recipe.core?.find(p => p.label === 'Film Simulation')?.value || 'Unknown';
  return `## 📷 New Recipe Submission

**Name:** ${recipe.name}
**Ref:** ${refNo}
**Film Simulation:** ${filmSim}
**Author:** ${recipe.author || 'Anonymous'}${recipe.authorLink ? ` — ${recipe.authorLink}` : ''}
**Submitted:** ${now}

---

### Review Checklist

- [ ] Images look good (no blurry, broken, or NSFW content)
- [ ] Settings are plausible for this film simulation
- [ ] No spam or duplicate of an existing recipe
- [ ] Author credit is appropriate

---

*To publish: merge this PR → GitHub Actions rebuilds the site.*
*To discard: close without merging.*

> Slug: \`${slug}\`
`;
}

// ── CORS response helper ────────────────────────────────
function corsResponse(body, status) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  return new Response(body ? JSON.stringify(body) : null, { status, headers });
}
