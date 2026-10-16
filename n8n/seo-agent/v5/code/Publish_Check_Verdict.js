// B3-7 (2026-10-16): the answer of `POST /webhook/seo-publish-check`. It READS the verdict *Content QA* and *Originality Check* reached
// (the content run's own node code, unchanged) and states it in a form a script, the app or a CI job can act on in one line:
// `publishable` / `exit_code` (0 = publishable, 1 = not). It never changes the verdict — it only says, beside it, what this check could
// not look at and why (`not_checked`): a gate that skipped a test must never read as a gate that passed it.
const d = $input.first().json || {};
const v = d.content_qa || {};
const pc = d.publish_check || {};
const S = (x) => String(x == null ? '' : x);
const publishable = v.publishable === true && v.not_ready !== true;
const nc = [];
nc.push({ check: 'editor_review', reason: 'the editor\'s review is a model call; this check runs only the deterministic half of the gate (in a content run the review\'s high and medium remarks are further reasons)' });
if (!pc.sources_given) nc.push({ check: 'figures_against_sources', reason: 'no source text was sent (sources: [{ url, text }]), so a figure in a cited sentence could not be looked up in the page it cites' });
if (!pc.terms_given) nc.push({ check: 'topic_coverage', reason: 'no terms were sent (terms: [...]), so topic coverage was not measured and its 25 points were not at stake' });
else if (!pc.competitors_given) nc.push({ check: 'coverage_target', reason: 'no competitor page was sent, so coverage is the share of the terms sent, with no target read off the pages that rank' });
if (!pc.competitors_given) nc.push({ check: 'originality', reason: 'no competitor page was sent, so the draft could not be compared word for word with anyone' });
if (!pc.target_words_given) nc.push({ check: 'length', reason: 'no target_words was sent, so the page is measured against its own length (the length check cannot fail)' });
if (pc.domain_given && !pc.internal_links_given) nc.push({ check: 'internal_links_exist', reason: 'no internal_links list was sent, so the links to the site\'s own pages were trusted, not verified to exist' });
nc.push({ check: 'author_box', reason: 'the byline, author box and Person schema are added by the blog package from the business profile; they are not part of the Markdown sent' });
const R = v.readability || {};
const advice = [R.note, ...(Array.isArray(v.style_notes) ? v.style_notes : []), ...(Array.isArray(v.eeat_notes) ? v.eeat_notes : [])].filter(Boolean).slice(0, 12);
const reasons = Array.isArray(v.not_ready_reasons) && v.not_ready_reasons.length ? v.not_ready_reasons : (publishable ? [] : (v.warnings || []).slice(0, 6));
const body = {
  ok: true, publishable, verdict: publishable ? 'publishable' : 'not_publishable', exit_code: publishable ? 0 : 1,
  label: S(v.quality_label || (publishable ? 'passed the quality check' : 'did not pass the quality check — not ready to publish')),
  summary: publishable ? 'Publishable: the page passes every deterministic check of the content gate (score ' + v.content_score + ' of 100).'
    : 'Not publishable: ' + (reasons.length || 1) + ' reason(s) — ' + S(reasons[0] || 'the gate failed').slice(0, 220),
  reasons, content_score: v.content_score ?? null, score_bar: 80, score_breakdown: v.score_breakdown || null,
  warnings: v.warnings || [], advice,
  checks: {
    placeholders: { count: v.placeholder_count ?? 0, max: v.placeholder_max ?? null, open_brackets: v.open_brackets || [], note: S(v.placeholder_note) },
    length: { main_content_words: v.main_content_words ?? null, target_words: v.target_word_count ?? null, judged: !!pc.target_words_given },
    coverage: v.coverage || null,
    readability: { flesch: R.flesch ?? null, avg_sentence_words: R.avg_sentence_words ?? null, position: R.position || null, band: R.band || null, band_source: R.band_source || null, basis: S(R.basis), note: S(R.note) },
    intent: v.intent || null, ai_ready: v.ai_ready || null,
    figures: { unverified: v.unverified_figures || [], unverified_statistics: v.unverified_statistics || [], sources_sent: pc.sources_given || 0 },
    amounts: { masked: v.masked_amounts || [], flagged: v.flagged_amounts || [], sourced: v.sourced_amounts || [] },
    originality: v.originality || null,
    meta: { title_length: v.meta_title_length ?? null, description_length: v.meta_description_length ?? null },
    links: { internal: v.internal_links ?? 0, external: v.external_links ?? 0, sources_cited: v.sources_cited || [], weak_sources_unlinked: v.weak_sources_unlinked || [] },
    clean_language: { banned_phrases: v.banned_phrases || [] }
  },
  fixed_markdown: S(d.output), auto_fixes: v.auto_fixes || [], schema_types: v.schema_types || [],
  not_checked: nc,
  basis: 'the content gate of a content run (Content QA + Originality Check), the same node code, run once over the Markdown sent with no editing round left: what fails here is what a content run would deliver as "not ready to publish"',
  writes: 'none', cost_usd: 0
};
return [{ json: { body } }];
