# 🎞️ Simulation Recipes

**[fujisims.pantoine.com](https://fujisims.pantoine.com)** — A dedicated Fujifilm X-System film simulation archive.

This project serves as a "film protocol archive," documenting custom in-camera settings that define specific photographic looks. It is designed with a clinical, cinematic, and archive-focused aesthetic, prioritising technical clarity and visual impact.

---

## 🚀 Key Features

- **Film Protocol Archive**: Each recipe is structured as a technical entry with precise in-camera settings (Film Simulation, Grain, WB, Tone, etc.).
- **Build-time EXIF Processing**: Uses `exifr` to extract camera settings directly from sample photographs at build time, ensuring metadata accuracy.
- **Responsive Cinematic Design**: A custom-built dark interface using vanilla CSS, featuring glassmorphism, micro-animations, and a highly responsive multi-page layout.
- **Community CMS**: A custom-built, serverless submission system that allows anyone to suggest new recipes via a PR-based workflow.

---

## 🛠️ Technology Stack

- **Framework**: [Astro](https://astro.build) (Static Site Generation)
- **Styling**: Vanilla CSS (Custom design system)
- **Content**: Astro Content Collections (Markdown-based)
- **Metadata**: [exifr](https://github.com/MikeKus/exifr) for EXIF extraction
- **Hosting**: GitHub Pages

### Custom Community CMS
Since the site is hosted on a static host (GitHub Pages), the "backend" is decoupled:
- **Client-side Compression**: Uses the browser's **Canvas API** to compress large 25-30MB camera JPEGs down to 1-3MB before upload.
- **Cloudflare Worker**: A serverless function that handles form submissions, verifies **Cloudflare Turnstile** CAPTCHA tokens, and communicates with the GitHub API.
- **GitHub PR Workflow**: Every submission automatically opens a Pull Request on this repository. This allows for manual review and approval through the standard Git workflow. Merging a PR automatically triggers a rebuild and deploy.

---

## 🧞 Project Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |

---

## 📂 Structure

- `src/content/recipes/`: Markdown files for each recipe.
- `src/assets/recipes/`: Original sample images for the recipes.
- `src/pages/`: Astro pages including the index and the dynamic `[slug]` routes.
- `cloudflare-worker/`: Source code for the community submission backend.

---

*Built with intention by [Antoine Pouligny](https://www.pantoine.com).*
