// F-ENG (2026-10-20): the dispatcher watchdog's record, one seo_cache row (`catchup:watchdog:SEOagentCycleDsp`, exact columns): when it looked,
// what it found and when it last alerted (the alarm is rate-limited from it). A test run never reaches this node.
return [{ json: $('Dispatcher Watchdog').first().json.state_row }];
