# CLAUDE.md — Vulcan Lodge Ritual Practice

## Project Overview
Interactive ritual practice web app for Vulcan Lodge No. 4510 (Middlesbrough). Helps Lodge officers learn their parts across all four main ceremonies by selecting their role and practising with cue cards, full scripts, quizzes, and mastery checklists.

Built by Jamie White as a single-file static HTML app for Cloudflare Pages deployment.

## Live URL
- **App:** https://ritual.vulcanlodge.uk (or wherever deployed on Cloudflare Pages)

## Tech Stack
- **Frontend:** Single static HTML file (`ritual-practice.html` / `index.html`)
- **Framework:** Vanilla JavaScript — no build step, no dependencies, no Node modules
- **Fonts:** Google Fonts (Cormorant Garamond + DM Sans) loaded via CSS import
- **State:** In-memory JavaScript state object, sessionStorage for checklist persistence
- **Hosting:** Cloudflare Pages — static site, £0/month

## Deployment
This is a single-file static site. To deploy to Cloudflare Pages:

1. Create a repo (or use direct upload) with the HTML file renamed to `index.html`
2. In Cloudflare Pages dashboard: Create project → Connect to Git (or Direct Upload)
3. Build settings: **None needed** — no build command, no framework
4. Output directory: `/` (root)
5. Deploy

### Cloudflare Pages Config
- **Build command:** (leave empty)
- **Build output directory:** `/`
- **Root directory:** `/`
- **No environment variables needed**

To update: just replace `index.html` and push (or re-upload).

## Source Data
All ceremony text is extracted from **"Vulcan Ritual - Master Mason.pdf"** (Revision 19th April 2018, W. Bro Alex G. Robinson) and embedded as JSON directly in the HTML file. The data covers:

### Ceremonies Included
| Ceremony | PDF Pages | Lines Parsed |
|----------|-----------|-------------|
| 1st Degree — Initiation | 1–12 | ~222 |
| 2nd Degree — Passing | 13–22 | ~344 |
| 3rd Degree — Raising | 27–40 | ~352 |
| Installation of the WM | 41–53 | ~248 |

### Officer Roles Supported
WM (Worshipful Master), SW (Senior Warden), JW (Junior Warden), SD (Senior Deacon), JD (Junior Deacon), IG (Inner Guard), DC (Director of Ceremonies), Tyler, Chap (Chaplain), SEC (Secretary), IPM (Immediate Past Master), CAN (Candidate)

## Features
1. **Ceremony Selector** — Pick from 1st, 2nd, 3rd Degree, or Installation
2. **Role Selector** — Choose your officer role; shows line count per role
3. **Overview** — Summary stats, all your lines listed, links to practice modes
4. **Full Script** — Complete ceremony with your lines highlighted in gold
5. **Cue Practice** — Flashcard-style; shows 2-3 preceding lines as context, reveal your response
6. **Test Me** — Type your lines from memory, word-similarity scoring
7. **Mastery Checklist** — Tick off each line as learned, progress bar tracking

## Design System

### Colour Palette (Masonic Theme)
| Token | Value | Usage |
|-------|-------|-------|
| Background | `linear-gradient(180deg, #0d1b2a, #1b2a4a, #162040, #0f1830)` | Deep navy page bg |
| Card bg | `rgba(22,38,65,0.85)` | Card backgrounds |
| Gold primary | `#d4af37` | Headings, highlights, your lines |
| Gold accent | `#c9a84c` | Buttons, tabs, interactive elements |
| Gold dark | `#a0842e` | Gradient endpoints, hover states |
| Body text | `#c8cfe0` | Main readable text |
| Muted text | `#7a8ba8` | Labels, subtitles, metadata |
| Stage directions | `#c07050` | Italic stage direction text |
| Card border | `rgba(201,168,76,0.15)` | Subtle gold card borders |
| Input bg | `rgba(13,27,42,0.8)` | Form input backgrounds |

### Typography
- **Headings/Display:** `Cormorant Garamond` — serif, weight 400–600
- **Body/UI:** `DM Sans` — sans-serif, weight 300–700
- **Google Fonts import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap');
```

### Component Patterns
- **Cards:** `border-radius: 18px`, backdrop blur, gold border, fadeIn animation
- **Buttons:** `border-radius: 14px`, gold gradient primary, ghost with gold border
- **Tabs:** Row of pill buttons, active state uses gold gradient with dark text
- **Progress bars:** 6px height, gold gradient fill
- **Highlighted lines:** Gold background tint `rgba(201,168,76,0.08)` with gold border

## File Structure
```
ritual-practice/
├── index.html          # Everything — single file, ~265KB (includes embedded ceremony JSON)
└── CLAUDE.md           # This file
```

## Architecture Notes
- **Single-file architecture:** All HTML, CSS, JS, and ceremony data in one file. No build step. This is intentional for simplicity of deployment and maintenance.
- **Embedded JSON data:** The ceremony text (~240KB JSON) is embedded directly in a `<script>` tag as a JavaScript object. This avoids any API calls or external data fetching.
- **State management:** Plain JavaScript object (`S`) with a `render()` function that rebuilds the DOM. Simple but effective for this scale.
- **Similarity scoring:** Word-overlap algorithm for the "Test Me" quiz mode — not perfect but good enough for ritual line checking.
- **sessionStorage:** Used only for checklist persistence within a browser session. No localStorage (not needed for this use case).

## Updating Ceremony Data
If the ritual book is revised, the ceremony data needs to be re-extracted:

1. Use `pdfplumber` (Python) to extract text from the updated PDF
2. Parse speaker lines using the regex pattern: `^(WM|JW|SW|JD|SD|IG|DC|Tyler|Chap|CHAP|SEC|IPM|CAN|ALL|JD & CAN|SD & CAN)\s+(.+)`
3. Group by ceremony using PDF page ranges
4. Generate JSON and embed in the HTML file's `CEREMONIES` constant

The extraction script used to build this is not included in the repo but can be recreated from the pattern above.

## Content Sensitivity
This file contains Masonic ritual text from Vulcan Lodge No. 4510. Certain words and phrases are intentionally abbreviated with `..` notation (e.g., `s..n`, `k..s`, `p..d`) as is standard practice in written Masonic ritual. **Do not expand or "fix" these abbreviations** — they are correct as-is.

## Future Enhancements (if needed)
- Audio recording/playback for practising delivery
- Spaced repetition algorithm for the quiz mode
- Multiple lodge ritual variants (Emulation, Taylor's, etc.)
- PWA manifest + service worker for offline use
- Print-friendly view for individual role scripts
- Share/export role-specific cue sheets as PDF
