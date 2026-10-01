// Copy of the report HTML named index.html for the PDF renderer (Gotenberg requires that exact file name)
const item = $input.first();
const doc = (item.binary || {}).data;
if (!doc) return [item];
return [{ json: item.json, binary: { data: doc, html: { ...doc, fileName: 'index.html', mimeType: 'text/html', fileExtension: 'html' } } }];