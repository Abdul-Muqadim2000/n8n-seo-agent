// The pages to check for our link: URLs on the prospect's site named in the reply, and the page we pitched.
const r = $('Reply Input').first().json;
return r.ok && r.urls.length ? r.urls.map(url => ({ json: { url } })) : [{ json: { skip: true } }];
