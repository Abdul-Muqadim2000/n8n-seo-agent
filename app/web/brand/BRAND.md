# Alaventra — Brand Guide v1.0

Alaventra is enterprise-grade autonomous SEO. The name joins *ala* (Latin for wing) with *venture*: the wing of the mark, moving forward. This kit holds the logo system, icons, favicons, colours and type for the product and marketing site. Hand this file plus the folder to Claude (or any developer) to rebrand the app.

## 1. The mark

The mark is unchanged from the original artwork, rebuilt as clean vectors (99% pixel match with the source file).

- 33 rays radiating from one hub, every 7.5°, sweeping 240° (from −15° to 225°).
- Each ray is a 3° wedge that starts on the same inner circle (the hub).
- The long rays on the upper left form the wing; the short rays round the bottom form the rising sun.

**Never redraw, re-space, recolour individual rays, rotate, stretch, outline or add gradients/shadows.** Always use the supplied files.

## 2. Logo files (`/logo`)

| File | Use |
|---|---|
| `alaventra-logo-horizontal-{ink,blue,white}` | Primary logo. Website nav at ≥ 40px tall, footer, documents, decks. |
| `alaventra-logo-stacked-{ink,blue,white}` | Square-ish spaces: hero, login screen, merch, event signage. |
| `alaventra-logo-header-{light,dark}` | **App/product header** at 24–40px tall (blue icon tile + wordmark). Replaces the current "SEO Agent" blue-square header. |
| `alaventra-mark-{ink,blue,white}` | Mark alone, ≥ 40px wide. Hero graphics, watermarks, loading states. |
| `alaventra-wordmark-{ink,white}` | Wordmark alone, where the mark already appears nearby. |

Every logo comes as SVG (use this on the web) and transparent PNG.

- **Ink** version on white/paper. **Blue** version on white only. **White** version on ink, Alaventra Blue or photography.
- **Clear space:** keep space equal to the wordmark's cap height ("A" height) clear on every side. For the mark alone: 25% of its height.
- **Minimum size:** horizontal logo 140px wide; mark 40px wide. Smaller than that, use the header lockup or the app icon.
- Don't set "ALAVENTRA" as live text and call it the logo. Use the SVG.

## 3. App icon & favicon (`/icon`, `/favicon`)

- **App icon:** white mark on Alaventra Blue, rounded square (corner radius 22.5%). Alternates: white on ink, blue on white.
- **Favicon:** the same tile. At 16–32px the rays are drawn slightly heavier (same 33 rays and lengths) so they stay crisp in browser tabs; that's `favicon.svg`, `favicon.ico` and `favicon-16/32`.
- `apple-touch-icon.png` and `maskable-icon-512x512.png` are full-bleed squares: iOS and Android round the corners themselves.
- Paste `favicon/head-snippet.html` into the site `<head>`; copy the favicon files to the web root.

## 4. Colour (`tokens.css`)

| Token | Hex | Use |
|---|---|---|
| Ink | `#0A0F1F` | Primary text, dark surfaces, mono logo |
| **Alaventra Blue** | `#2E4BFF` | Primary buttons, links, active tabs, icon tile, chart lines |
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

1. Header: swap the "SEO Agent" icon + text for `alaventra-logo-header-light.svg` (height 32px).
2. Page title and `<title>`: "Alaventra" (e.g. `Overview · techand.ai — Alaventra`).
3. Load the fonts and `tokens.css`. Body uses `--alv-font-ui`; H1/H2 and KPI values use `--alv-font-display`.
4. Page background `--alv-paper`; cards white with `--alv-shadow-card` and `--alv-radius-lg`.
5. Primary button ("Run an analysis"): `--alv-blue` fill, white text; hover `--alv-blue-deep`.
6. Links ("All reports →"): `--alv-blue`.
7. Charts: line `--alv-blue`, area fill `--alv-blue-tint`, grid `--alv-line`.
8. Deltas: up = `--alv-success`, down = `--alv-danger`; "High" tags = `--alv-warning`.
9. Favicon and social meta: `favicon/head-snippet.html`.
10. Share image: `social/alaventra-og-image.png` (1200×630).

## 7. Voice

Descriptor: **Enterprise-grade autonomous SEO.** Plain, specific and calm: say what changed and what to do next, as the current dashboard copy already does well.
