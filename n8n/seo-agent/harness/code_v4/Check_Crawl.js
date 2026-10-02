const base = $('Save Task ID').first().json;
const res = $input.first().json;
const result = res.tasks?.[0]?.result?.[0] || null;

// Hifazat: 25 minute se zyada na chale
const __maxPolls = Math.min(50, 25 + Math.ceil(Math.max(0, (base.crawl_max_pages || 200) - 200) / 40) + (base.crawl_js ? 10 : 0));   // bigger / JavaScript crawls get more time (v4.5)
if ($runIndex > __maxPolls) {
  throw new Error('Site crawl took too long for ' + base.domain);
}

const progress = result?.crawl_progress || 'unknown';
const status = result?.crawl_status || {};

return [{
  json: {
    ...base,
    crawl_finished: progress === 'finished',
    crawl_progress: progress,
    pages_crawled: status.pages_crawled ?? 0,
    pages_in_queue: status.pages_in_queue ?? 0,
    crawl_summary: result
  }
}];