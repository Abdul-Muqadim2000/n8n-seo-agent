# Ascentra — Brand Guide v1.0

Ascentra is enterprise-grade autonomous SEO. This kit holds the logo system, icons, favicons, colours and type for the product and marketing site. Hand this file plus the folder to Claude (or any developer) to rebrand the app.

## 1. The mark

The mark is unchanged from the original artwork, rebuilt as clean vectors (99% pixel match with the source file).

- 33 rays radiating from one hub, every 7.5°, sweeping 240° (from −15° to 225°).
- Each ray is a 3° wedge that starts on the same inner circle (the hub).
- The long rays on the upper left form the wing; the short rays round the bottom form the rising sun.

**Never redraw, re-space, recolour individual rays, rotate, stretch, outline or add gradients/shadows.** Always use the supplied files.

## 2. Logo files (`/logo`)

| File | Use |
|---|---|
| `ascentra-logo-horizontal-{ink,blue,white}` | Primary logo. Website nav at ≥ 40px tall, footer, documents, decks. |
| `ascentra-logo-stacked-{ink,blue,white}` | Square-ish spaces: hero, login screen, merch, event signage. |
| `ascentra-logo-header-{light,dark}` | **App/product header** at 24–40px tall (blue icon tile + wordmark). Replaces the current "SEO Agent" blue-square header. |
| `ascentra-mark-{ink,blue,white}` | Mark alone, ≥ 40px wide. Hero graphics, watermarks, loading states. |
| `ascentra-wordmark-{ink,white}` | Wordmark alone, where the mark already appears nearby. |

Every logo comes as SVG (use this on the web) and transparent PNG.

- **Ink** version on white/paper. **Blue** version on white only. **White** version on ink, Ascentra Blue or photography.
- **Clear space:** keep space equal to the wordmark's cap height ("A" height) clear on every side. For the mark alone: 25% of its height.
- **Minimum size:** horizontal logo 140px wide; mark 40px wide. Smaller than that, use the header lockup or the app icon.
- Don't set "ASCENTRA" as live text and call it the logo. Use the SVG.

## 3. App icon & favicon (`/icon`, `/favicon`)

- **App icon:** white mark on Ascentra Blue, rounded square (corner radius 22.5%). Alternates: white on ink, blue on white.
- **Favicon:** the same tile. At 16–32px the rays are drawn slightly heavier (same 33 rays and lengths) so they stay crisp in browser tabs; that's `favicon.svg`, `favicon.ico` and `favicon-16/32`.
- `apple-touch-icon.png` and `maskable-icon-512x512.png` are full-bleed squares: iOS and Android round the corners themselves.
- Paste `favicon/head-snippet.html` into the site `<head>`; copy the favicon files to the web root.

## 4. Colour (`tokens.css`)

| Token | Hex | Use |
|---|---|---|
| Ink | `#0A0F1F` | Primary text, dark surfaces, mono logo |
| **Ascentra Blue** | `#2E4BFF` | Primary buttons, links, active tabs, icon tile, chart lines |
| Blue Deep | `#2238D9` | Hover / pressed |
| Blue Tint | `#EEF1FF` | Selected states, chart area fill, info badges |
| Blue on Dark | `#8FA2FF` | Links and accents on ink |
| Paper | `#F6F7FB` | Page background |
| Line | `#E3E7F0` | Card borders, dividers, chart grid |
| Slate | `#4A5468` | Secondary text |
| Mist | `#5B6478` | Captions, timestamps, meta |
| Success | `#0B7A53` | Positive deltas (↗ +112%), "Verified" |
| Warning | `#B54708` | "High" severity tags |
| Danger | `#C2321A` | Errors, drops |

Ratio guide: about 70% white/paper, 20% ink, 10% blue. Blue is the only brand accent: no second accent colour and no gradients. All text pairs listed pass WCAG AA (4.5:1).

## 5. Typography

| Role | Font | Settings |
|---|---|---|
| Display & headings | **Sora** 600 | Letter-spacing −0.01em (H1 −0.02em). Sentence case. |
| UI & body | **Geist** 400 / 500 / 600 | 14–16px body, line-height 1.5 |
| Numbers, tables, code | **Geist Mono** 400 / 500 | Tabular figures for KPI values (optional) |
| Wordmark | Sora 600, uppercase, +0.14em tracking | Logo files only |

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
```

All three are free (SIL Open Font License) on Google Fonts.

## 6. Applying it to the product (rebrand checklist)

1. Header: swap the "SEO Agent" icon + text for `ascentra-logo-header-light.svg` (height 32px).
2. Page title and `<title>`: "Ascentra" (e.g. `Overview · techand.ai — Ascentra`).
3. Load the fonts and `tokens.css`. Body uses `--asc-font-ui`; H1/H2 and KPI values use `--asc-font-display`.
4. Page background `--asc-paper`; cards white with `--asc-shadow-card` and `--asc-radius-lg`.
5. Primary button ("Run an analysis"): `--asc-blue` fill, white text; hover `--asc-blue-deep`.
6. Links ("All reports →"): `--asc-blue`.
7. Charts: line `--asc-blue`, area fill `--asc-blue-tint`, grid `--asc-line`.
8. Deltas: up = `--asc-success`, down = `--asc-danger`; "High" tags = `--asc-warning`.
9. Favicon and social meta: `favicon/head-snippet.html`.
10. Share image: `social/ascentra-og-image.png` (1200×630).

## 7. Voice

Descriptor: **Enterprise-grade autonomous SEO.** Plain, specific and calm: say what changed and what to do next, as the current dashboard copy already does well.
