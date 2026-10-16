// R82 (2026-10-16, monitor_cost.count_chain): the two free token counts are taken; hand Site Brief's own items back
// to the pipeline, unchanged and in order, so nothing downstream sees the counter (the R17 resume pattern).
return $('Site Brief').all();
