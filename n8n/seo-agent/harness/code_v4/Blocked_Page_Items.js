// One item per blocked page for the retry (this node only runs when at least one page was blocked)
return ($input.first().json.blocked || []).map(x => ({ json: x }));
