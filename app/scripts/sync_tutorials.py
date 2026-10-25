#!/usr/bin/env python3
"""Bring the video course into the marketing site (app/web): the catalogue and every finished film.

  python3 app/scripts/sync_tutorials.py --catalogue <tutorials.json> --films <alaventra-video folder> [--videos] [--webm] [--refresh]

What it writes (paths relative to app/web):
  src/marketing/content/tutorials.ts       the catalogue block between the `<catalogue>` markers (series and tutorials, in order)
  src/marketing/content/tutorial-films.ts  generated: one entry per finished film (length, chapters with their kind, covers, captions,
                                           transcript, date)
  public/tutorials/covers/<slug>.webp      the film's cover, 960 px wide, and <slug>-1920.webp for sharp screens (needs Pillow)
  public/tutorials/covers/<slug>-card.webp the card picture: the cover's title block cropped at twice the size (no step or minute
                                           line), with <slug>-card-dark.webp, the same title redrawn on the dark page colour
                                           (needs Pillow and numpy)
  public/tutorials/captions/<slug>.vtt     the film's captions
  public/tutorials/video/<slug>.mp4        with --videos only: the film itself, for local preview (git-ignored; production plays
                                           the films from VITE_TUTORIALS_VIDEO_BASE, see app/README.md "Video tutorials")
  public/tutorials/video/<slug>.webm       with --webm (and ffmpeg): a VP9 copy, offered first, for browsers without H.264

The catalogue is the single truth for a finished film's written steps: they become the film's own step chapters (from the film's
script.json; without it, every chapter but Introduction, What comes next and What you get), so the cover's "4 steps", the chapter box
and the written steps always say the same. Plain-word rewordings of the catalogue (no acronyms on the page) live in
tutorial_wording.json next to this script; the words they replace stay in the search text, so a search for "CMS" still finds
"Connect your website builder". A film's own chapter titles are never reworded: they are burned into the picture.

A film is finished when its folder `<n-n-slug>_T/final/` holds the MP4, the cover PNG, the VTT and the chapters file. Run it again
whenever a new film is finished: it is idempotent and only adds or replaces files. --refresh re-exports only the films already on
the site (new covers, transcripts, steps) without publishing newly finished ones. No Pillow on the host? Run it in a container:

  docker run --rm -v "$PWD/app":/app -v "<films>":/films:ro -v "<catalogue dir>":/cat:ro python:3.12-slim sh -c \
    "apt-get update -qq && apt-get install -y -qq ffmpeg >/dev/null && pip install -q pillow numpy && \
     python /app/scripts/sync_tutorials.py --catalogue /cat/tutorials.json --films /films --videos --webm"
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import struct
import subprocess
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent / 'web'
CONTENT = WEB / 'src' / 'marketing' / 'content'
PUBLIC = WEB / 'public' / 'tutorials'
WORDING = Path(__file__).resolve().parent / 'tutorial_wording.json'
BEGIN, END = '// <catalogue>', '// </catalogue>'
COVER_WIDTH = 960
COVER_WIDTH_2X = 1920
# the site's page colours (web/src/index.css --page and --ink / --accent-text, light and dark): the card pictures sit on them
PAGE_LIGHT, INK_LIGHT, ACCENT_LIGHT = (246, 247, 251), (10, 15, 31), (46, 75, 255)
PAGE_DARK, INK_DARK, ACCENT_DARK = (10, 15, 31), (242, 244, 250), (143, 162, 255)
# chapters that are not steps when the film has no script.json to say so
NOT_STEPS = {'introduction': 'intro', 'what comes next': 'result', 'what you get': 'result'}
# the copy rules: no curly quotes, dashes or ellipses on the page
PLAIN = str.maketrans({'‘': "'", '’': "'", '“': '"', '”': '"', '—': ', ', '–': '-', '…': '.'})


def mp4_duration(path: Path) -> float:
    """Seconds, read from the movie header (moov/mvhd); no ffprobe needed."""
    with path.open('rb') as f:
        data = f.read()

    def boxes(buf: bytes, start: int, end: int):
        i = start
        while i + 8 <= end:
            size, kind = struct.unpack('>I4s', buf[i:i + 8])
            head = 8
            if size == 1:
                size = struct.unpack('>Q', buf[i + 8:i + 16])[0]
                head = 16
            elif size == 0:
                size = end - i
            yield kind, i + head, i + size
            i += size

    for kind, s, e in boxes(data, 0, len(data)):
        if kind == b'moov':
            for k2, s2, _ in boxes(data, s, e):
                if k2 == b'mvhd':
                    version = data[s2]
                    if version == 1:
                        scale, dur = struct.unpack('>IQ', data[s2 + 20:s2 + 32])
                    else:
                        scale, dur = struct.unpack('>II', data[s2 + 12:s2 + 20])
                    return dur / scale
    raise ValueError(f'no movie header in {path.name}')


def parse_chapters(text: str) -> list[tuple[int, str]]:
    out = []
    for line in text.splitlines():
        m = re.match(r'^\s*(?:(\d+):)?(\d+):(\d{2})\s+(.+?)\s*$', line)
        if m:
            h, mnt, sec, title = m.groups()
            out.append(((int(h or 0) * 3600) + int(mnt) * 60 + int(sec), title.translate(PLAIN)))
    return out


def chapter_kinds(script: Path) -> dict[str, str]:
    """chapter title -> intro / step / tip / result, from the scene ids of the film's script.json (title, step-n, tip, result)."""
    if not script.is_file():
        return {}
    kinds = {}
    for scene in json.loads(script.read_text(encoding='utf-8')).get('scenes', []):
        title = (scene.get('chapter') or '').translate(PLAIN).strip()
        sid = str(scene.get('id', ''))
        if not title:
            continue
        kinds[title] = ('intro' if sid in ('title', 'open') else 'step' if sid.startswith('step') else 'tip' if sid.startswith('tip')
                        else 'result' if sid in ('result', 'recap') else 'step')
    return kinds


def kind_of(title: str, kinds: dict[str, str]) -> str:
    return kinds.get(title) or NOT_STEPS.get(title.lower(), 'step')


def vtt_cues(text: str) -> list[tuple[float, str]]:
    """(start seconds, text) for every cue of a WebVTT file."""
    cues = []
    for block in re.split(r'\n\s*\n', text.replace('\r', '')):
        lines = [ln for ln in block.strip().split('\n') if ln.strip()]
        for i, ln in enumerate(lines):
            m = re.match(r'^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})\s+-->', ln)
            if m:
                h, mnt, sec, ms = m.groups()
                start = int(h or 0) * 3600 + int(mnt) * 60 + int(sec) + int(ms) / 1000
                body = ' '.join(x.strip() for x in lines[i + 1:])
                body = re.sub(r'<[^>]+>', '', body).translate(PLAIN)
                if body:
                    cues.append((start, body))
                break
    return cues


def transcript(cues: list[tuple[float, str]], marks: list[tuple[int, str]]) -> list[str]:
    """The narration as one paragraph per chapter (same order and length as the chapters)."""
    paras = [[] for _ in marks]
    for start, body in cues:
        k = 0
        for i, (s, _) in enumerate(marks):
            if start + 0.75 >= s:
                k = i
        if paras:
            paras[k].append(body)
    return [re.sub(r'\s+', ' ', ' '.join(p)).strip() for p in paras]


def ts(value) -> str:
    """A TypeScript literal (JSON is valid TS; single quotes for the house style where it is safe)."""
    if isinstance(value, str):
        if "'" not in value and '\\' not in value and '\n' not in value:
            return f"'{value}'"
        return json.dumps(value, ensure_ascii=False)
    return json.dumps(value, ensure_ascii=False)


def load_wording() -> list[tuple[str, str]]:
    if not WORDING.is_file():
        return []
    return [(r['from'], r['to']) for r in json.loads(WORDING.read_text(encoding='utf-8')).get('replace', [])]


def reword(text: str, rules: list[tuple[str, str]]) -> str:
    for a, b in rules:
        text = text.replace(a, b)
    return text


def catalogue_block(cat: dict, steps: dict[str, list[str]], rules: list[tuple[str, str]]) -> str:
    lines = [BEGIN, '// generated from the course catalogue by app/scripts/sync_tutorials.py (edit the catalogue, then run it again)',
             'export const tutorialSeries: TutorialSeries[] = [']
    for s in cat['series']:
        lines.append('  {')
        lines.append(f"    id: {ts(s['id'])},")
        lines.append(f"    title: {ts(reword(s['title'], rules))},")
        lines.append(f"    summary: {ts(reword(s['summary'], rules))},")
        lines.append('    tutorials: [')
        for t in s['tutorials']:
            film_steps = steps.get(t['slug'])
            chapters = film_steps or [reword(c, rules) for c in t['chapters']]
            fields = {'title': reword(t['title'], rules), 'summary': reword(t['summary'], rules)}
            # the words a rewording replaced stay searchable
            pairs = [(t['title'], fields['title']), (t['summary'], fields['summary'])]
            if not film_steps:
                pairs += list(zip(t['chapters'], chapters))
            aka = sorted({w for orig, new in pairs if orig != new
                          for w in re.findall(r"[A-Za-z0-9][\w'-]+", orig) if w.lower() not in new.lower()})
            lines.append('      {')
            lines.append(f"        id: {ts(t['id'])},")
            lines.append(f"        slug: {ts(t['slug'])},")
            lines.append(f"        title: {ts(fields['title'])},")
            lines.append(f"        summary: {ts(fields['summary'])},")
            lines.append(f"        level: {ts(t['level'])},")
            lines.append(f"        audience: [{', '.join(ts(a) for a in t['audience'])}],")
            lines.append(f"        minutes: {int(t['minutes'])},")
            lines.append(f"        start: {ts(t.get('start', ''))},")
            lines.append('        chapters: [')
            for c in chapters:
                lines.append(f'          {ts(c)},')
            lines.append('        ],')
            if aka:
                lines.append(f"        aka: [{', '.join(ts(w) for w in aka)}],")
            lines.append('      },')
        lines.append('    ],')
        lines.append('  },')
    lines.append('];')
    lines.append('')
    lines.append(f"export const quickTips: string[] = [{', '.join(ts(reword(q, rules)) for q in cat.get('quickTips', []))}];")
    lines.append(END)
    return '\n'.join(lines)


def need_pillow():
    try:
        from PIL import Image  # type: ignore  # noqa: F401
        import numpy  # type: ignore  # noqa: F401
    except ImportError:
        sys.exit('Pillow and numpy are needed for the WebP covers (pip install pillow numpy), or run this script in the container '
                 'shown in its help.')


def write_cover(src: Path, slug: str) -> None:
    from PIL import Image  # type: ignore
    covers = PUBLIC / 'covers'
    covers.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = im.convert('RGB')
        for width, name, quality in ((COVER_WIDTH, f'{slug}.webp', 82), (COVER_WIDTH_2X, f'{slug}-1920.webp', 70)):
            h = round(im.height * width / im.width)
            out = im if im.width == width else im.resize((width, h), Image.LANCZOS)
            out.save(covers / name, 'WEBP', quality=quality, method=6)
        light, dark = card_covers(im)
        light.save(covers / f'{slug}-card.webp', 'WEBP', quality=84, method=6)
        dark.save(covers / f'{slug}-card-dark.webp', 'WEBP', quality=84, method=6)


def card_covers(im):
    """The card picture, light and dark: the cover's title block (series line and title) cropped to 16:9 at twice its size, without
    the step / minute line, the product window or the logo, redrawn on the site's page colour. The cover is the films' title card:
    text on a light background on the left, so every pixel there is the background with some text colour over it; that colour and
    its strength are recovered against the background of the same row, then laid over the light or the dark page colour."""
    import numpy as np  # type: ignore
    from PIL import Image  # type: ignore

    a = np.asarray(im.convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    s = w / 1920
    left = int(940 * s)  # the product window starts right of this
    bg = np.median(a[:, : int(40 * s), :], axis=1)  # per-row background
    diff = np.abs(a[:, :left, :] - bg[:, None, :]).sum(axis=2)
    ink = diff > 60
    rows = np.where(ink.any(axis=1))[0]
    bands: list[list[int]] = []
    for r in rows:
        if bands and r - bands[-1][1] <= int(14 * s):
            bands[-1][1] = int(r)
        else:
            bands.append([int(r), int(r)])
    if not bands:
        raise ValueError('no title on the cover')
    content = bands
    last = bands[-1]
    if len(bands) > 2 and last[1] - last[0] < 70 * s:
        # the last line is the "4 steps · About 1 minute" line (small, grey): leave it out
        px = a[last[0]:last[1] + 1, :left][ink[last[0]:last[1] + 1]]
        if len(px) and float(np.mean(px.max(axis=1) - px.min(axis=1))) < 60:
            content = bands[:-1]
    top, bot = content[0][0], content[-1][1]
    cols = np.where(ink[top:bot + 1].any(axis=0))[0]
    x0, x1 = int(cols[0]), int(cols[-1])
    cw, ch = x1 - x0 + 1, bot - top + 1

    # colour-to-alpha against the row background, inside the title block only
    pad = int(6 * s)
    y0, y1, xa, xb = max(0, top - pad), min(h, bot + pad + 1), max(0, x0 - pad), min(left, x1 + pad + 1)
    region = a[y0:y1, xa:xb]
    b = bg[y0:y1, None, :]
    # strength from lightness (the text is darker than the background; the frame's compression noise is cut off below 10%), and
    # the colour from the hue: blue where the pixel leans blue, the title's ink everywhere else
    lum = region @ np.array([0.299, 0.587, 0.114], np.float32)
    blum = b[..., 0] * 0.299 + b[..., 1] * 0.587 + b[..., 2] * 0.114
    lean = (region[..., 2] - region[..., 0]) - (b[..., 2] - b[..., 0])
    blue_px = lean > 28
    ink_l = 15.0
    blue_l = float(np.dot(np.array(ACCENT_LIGHT, np.float32), [0.299, 0.587, 0.114]))
    strength = (blum - lum) / np.where(blue_px, blum - blue_l, blum - ink_l)
    alpha = np.clip((strength - 0.1) / 0.85, 0, 1)
    blue = blue_px[..., None]

    # the crop: half the cover's width (so the title is twice as large on a card), grown only if the block needs it
    cwin = max(int(COVER_WIDTH * s), int(cw + 120 * s), int((ch + 110 * s) * 16 / 9))
    hwin = round(cwin * 9 / 16)
    ox, oy = (cwin - cw) // 2, (hwin - ch) // 2

    def draw(page, ink_rgb, accent_rgb):
        canvas = np.empty((hwin, cwin, 3), np.float32)
        canvas[:] = page
        col = np.where(blue, np.array(accent_rgb, np.float32), np.array(ink_rgb, np.float32))
        at = alpha[..., None]
        px, py = ox - (x0 - xa), oy - (top - y0)
        sub = canvas[py:py + region.shape[0], px:px + region.shape[1]]
        sub[:] = at * col + (1 - at) * sub
        out = Image.fromarray(np.clip(canvas + 0.5, 0, 255).astype(np.uint8))
        return out.resize((COVER_WIDTH, round(COVER_WIDTH * 9 / 16)), Image.LANCZOS) if cwin != COVER_WIDTH else out

    return draw(PAGE_LIGHT, INK_LIGHT, ACCENT_LIGHT), draw(PAGE_DARK, INK_DARK, ACCENT_DARK)


def write_webm(mp4: Path, dest: Path) -> bool:
    ff = shutil.which('ffmpeg')
    if not ff:
        print('  no ffmpeg here: WebM copies skipped')
        return False
    if dest.is_file() and dest.stat().st_mtime >= mp4.stat().st_mtime:
        return True
    tmp = dest.with_suffix('.part.webm')
    subprocess.run([ff, '-y', '-loglevel', 'error', '-i', str(mp4), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1',
                    '-deadline', 'good', '-cpu-used', '4', '-c:a', 'libopus', '-b:a', '96k', str(tmp)], check=True)
    tmp.replace(dest)
    return True


def published_slugs() -> set[str]:
    films = CONTENT / 'tutorial-films.ts'
    if not films.is_file():
        return set()
    return set(re.findall(r"^  '([a-z0-9-]+)': \{", films.read_text(encoding='utf-8'), re.M))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--catalogue', required=True, type=Path, help='tutorials.json of the video project')
    ap.add_argument('--films', required=True, type=Path, help='the folder holding <n-n-slug>_T/final/')
    ap.add_argument('--videos', action='store_true', help='also copy the MP4s into public/tutorials/video/ (local preview, git-ignored)')
    ap.add_argument('--webm', action='store_true', help='also encode a VP9 WebM of each film into public/tutorials/video/ (needs ffmpeg)')
    ap.add_argument('--refresh', action='store_true', help='only the films already on the site: re-export them, publish no new film')
    ap.add_argument('--skip-covers', action='store_true', help='do not write the WebP covers (no Pillow here; make them another way)')
    args = ap.parse_args()
    if not args.skip_covers:
        need_pillow()

    cat = json.loads(args.catalogue.read_text(encoding='utf-8'))
    by_id = {t['id']: t for s in cat['series'] for t in s['tutorials']}
    rules = load_wording()
    keep = published_slugs() if args.refresh else None

    films, steps = {}, {}
    for folder in sorted(args.films.glob('*_T'), key=lambda p: [int(x) if x.isdigit() else x for x in re.split(r'(\d+)', p.name)]):
        m = re.match(r'^(\d+)-(\d+)-(.+)_T$', folder.name)
        final = folder / 'final'
        if not m or not final.is_dir():
            continue
        tid = f'{int(m.group(1))}.{int(m.group(2))}'
        t = by_id.get(tid)
        if not t:
            print(f'  skipped {folder.name}: no tutorial {tid} in the catalogue')
            continue
        slug = t['slug']
        if keep is not None and slug not in keep:
            continue
        stem = folder.name
        mp4, cover = final / f'{stem}_16x9.mp4', final / f'{stem}_16x9_cover.png'
        vtt, chapters = final / f'{stem}.vtt', final / f'{stem}_chapters.txt'
        missing = [p.name for p in (mp4, cover, vtt, chapters) if not p.is_file()]
        if missing:
            print(f'  not finished {folder.name}: missing {", ".join(missing)}')
            continue
        duration = mp4_duration(mp4)
        marks = parse_chapters(chapters.read_text(encoding='utf-8'))
        kinds = chapter_kinds(folder / 'script.json')
        if not args.skip_covers:
            write_cover(cover, slug)
        (PUBLIC / 'captions').mkdir(parents=True, exist_ok=True)
        shutil.copyfile(vtt, PUBLIC / 'captions' / f'{slug}.vtt')
        video_dir = PUBLIC / 'video'
        if args.videos or args.webm:
            video_dir.mkdir(parents=True, exist_ok=True)
        if args.videos:
            shutil.copyfile(mp4, video_dir / f'{slug}.mp4')
        webm = write_webm(mp4, video_dir / f'{slug}.webm') if args.webm else (video_dir / f'{slug}.webm').is_file()
        chapter_list = [{'start': s, 'title': title, 'kind': kind_of(title, kinds)} for s, title in marks]
        film_steps = [c['title'] for c in chapter_list if c['kind'] == 'step']
        if film_steps:
            steps[slug] = film_steps
            if film_steps != t['chapters']:
                print(f'  {tid}: written steps now follow the film ({len(t["chapters"])} in the catalogue, {len(film_steps)} in the film)')
        films[slug] = {
            'durationSeconds': round(duration),
            'published': dt.date.fromtimestamp(mp4.stat().st_mtime).isoformat(),
            'cover': f'/tutorials/covers/{slug}.webp',
            'webm': webm,
            'captions': f'/tutorials/captions/{slug}.vtt',
            'chapters': chapter_list,
            'transcript': transcript(vtt_cues(vtt.read_text(encoding='utf-8')), marks),
        }
        print(f'  film {tid} {slug}: {duration:.1f} s, {len(marks)} chapters, {len(film_steps)} steps{", webm" if webm else ""}')

    reg = CONTENT / 'tutorials.ts'
    src = reg.read_text(encoding='utf-8')
    a, b = src.find(BEGIN), src.find(END)
    if a < 0 or b < 0:
        sys.exit(f'{reg} has no {BEGIN} ... {END} block')
    reg.write_text(src[:a] + catalogue_block(cat, steps, rules) + src[b + len(END):], encoding='utf-8')
    print(f'catalogue: {len(cat["series"])} series, {len(by_id)} tutorials, {len(rules)} rewordings')

    out = ['// Generated by app/scripts/sync_tutorials.py from the finished films: do not edit by hand. One entry per tutorial whose film',
           '// is finished (served from VITE_TUTORIALS_VIDEO_BASE as <slug>.mp4, and <slug>.webm when `webm`); every other tutorial shows',
           '// its written steps and "the video is on its way". Covers: <cover>, <cover>-1920.webp, <cover>-card.webp, <cover>-card-dark.webp.',
           "import type { TutorialFilm } from './tutorials';", '', 'export const tutorialFilms: Record<string, TutorialFilm> = {']
    for slug, f in films.items():
        out.append(f'  {ts(slug)}: {{')
        out.append(f"    durationSeconds: {f['durationSeconds']},")
        out.append(f"    published: {ts(f['published'])},")
        out.append(f"    cover: {ts(f['cover'])},")
        if f['webm']:
            out.append('    webm: true,')
        out.append(f"    captions: {ts(f['captions'])},")
        out.append('    chapters: [')
        for c in f['chapters']:
            out.append(f"      {{ start: {c['start']}, title: {ts(c['title'])}, kind: {ts(c['kind'])} }},")
        out.append('    ],')
        out.append('    transcript: [')
        for p in f['transcript']:
            out.append(f'      {ts(p)},')
        out.append('    ],')
        out.append('  },')
    out.append('};')
    (CONTENT / 'tutorial-films.ts').write_text('\n'.join(out) + '\n', encoding='utf-8')
    print(f'films: {len(films)} finished')


if __name__ == '__main__':
    main()
