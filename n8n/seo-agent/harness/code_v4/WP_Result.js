// Normalised result of the draft creation (inspect it in the execution; nothing else depends on it).
const r = $input.first().json || {};
const src = $('Build WP Draft').first().json;
const ok = !!r.id && !r.error && !r.code;
return [{ json: { ok, post_id: r.id || null, link: r.link || null, status: r.status || null, slug: r.slug || null, edit_link: ok ? src.wordpress_url + '/wp-admin/post.php?post=' + r.id + '&action=edit' : null,
  error: ok ? null : String((r.error && (r.error.message || r.error)) || r.message || r.code || 'no post id returned').slice(0, 300), keyword: src.keyword, ladder_id: src.ladder_id, request_id: src.request_id } }];