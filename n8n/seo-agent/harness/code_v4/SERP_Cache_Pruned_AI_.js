// R-E7: a Data Table update / delete answers with every row it changed; only the count goes on.
const n = $input.all().filter(i => i.json && !i.json.error && i.json.id != null).length;
return [{ json: { changed: n } }];