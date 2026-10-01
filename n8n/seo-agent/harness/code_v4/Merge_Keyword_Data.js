const prev = $('Parse Analysis').first().json;
let res = {}; try { res = $('Keyword Data').first().json || {}; } catch (e) { res = $input.first().json || {}; }
let site_authority = null;
try { const m = $('Site Authority').first().json?.tasks?.[0]?.result?.[0]?.items?.[0]?.metrics?.organic; if (m) site_authority = { organic_keywords: m.count ?? 0, top3: (m.pos_1 || 0) + (m.pos_2_3 || 0), top10: (m.pos_1 || 0) + (m.pos_2_3 || 0) + (m.pos_4_10 || 0), est_monthly_traffic: Math.round(m.etv || 0) }; } catch (e) {}
const item = res.tasks?.[0]?.result?.[0]?.items?.[0] || null;

const info = item?.keyword_info || {};
const props = item?.keyword_properties || {};
const intent = item?.search_intent_info || {};
const links = item?.avg_backlinks_info || {};
const trend = info.search_volume_trend || {};

// Difficulty ko aam alfaaz mein
const kd = props.keyword_difficulty;
const kdLabel = kd == null ? 'Unknown'
  : kd < 30 ? 'Easy'
  : kd < 50 ? 'Medium'
  : kd < 70 ? 'Hard'
  : 'Very Hard';

const keyword_data = item ? {
  search_volume: info.search_volume ?? null,
  cpc: info.cpc ?? null,
  ads_competition: info.competition_level ?? null,
  keyword_difficulty: kd ?? null,
  difficulty_label: kdLabel,
  google_intent: intent.main_intent ?? null,
  trend_yearly_pct: trend.yearly ?? null,
  trend_quarterly_pct: trend.quarterly ?? null,
  monthly_trend: (info.monthly_searches || [])
    .slice(0, 12)
    .map(m => ({ month: `${m.year}-${String(m.month).padStart(2, '0')}`, searches: m.search_volume })),
  competitor_backlink_strength: {
    avg_referring_domains: links.referring_domains != null ? Math.round(links.referring_domains) : null,
    avg_backlinks: links.backlinks != null ? Math.round(links.backlinks) : null,
    avg_dofollow: links.dofollow != null ? Math.round(links.dofollow) : null
  }
} : {
  note: 'Keyword data not available for this keyword/country'
};

// Competitors ka lamba content aage AI ko nahi chahiye, sirf summary
const competitors_summary = (prev.competitors || []).map(c => ({
  rank: c.rank,
  domain: c.domain,
  url: c.url,
  title: c.title,
  word_count: c.word_count,
  headings: c.headings
}));

return [{
  json: {
    ...prev,
    competitors: undefined,
    competitors_summary,
    keyword_data,
    site_authority
  }
}];