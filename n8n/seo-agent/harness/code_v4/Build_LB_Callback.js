// Callback payload per site (stage link_builder): the summary; the rows stay in n8n (the app reads them).
return $input.all().map(i => { const { html, ...rest } = i.json; return { json: rest }; });