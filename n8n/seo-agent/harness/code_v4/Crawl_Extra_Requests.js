// Extra DataForSEO On-Page reports for the finished crawl (each becomes one HTTP request)
const d = $input.first().json;
let id = d.crawl_task_id;   // R64: the pages answer has no id — the crawl's id is on Check Crawl / Save Task ID
try { id = id || $('Check Crawl').first().json.crawl_task_id; } catch (e) {}
try { id = id || $('Save Task ID').first().json.crawl_task_id; } catch (e) {}
const base = 'https://api.dataforseo.com/v3/on_page/';
return [
  { json: { ...d, extra: 'duplicate_title',       endpoint: base + 'duplicate_tags',  body: [{ id, type: 'duplicate_title', limit: 100 }] } },
  { json: { ...d, extra: 'duplicate_description', endpoint: base + 'duplicate_tags',  body: [{ id, type: 'duplicate_description', limit: 100 }] } },
  { json: { ...d, extra: 'non_indexable',         endpoint: base + 'non_indexable',   body: [{ id, limit: 200 }] } },
  { json: { ...d, extra: 'redirect_chains',       endpoint: base + 'redirect_chains', body: [{ id, limit: 100 }] } }
];
