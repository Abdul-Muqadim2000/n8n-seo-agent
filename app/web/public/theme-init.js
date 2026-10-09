// Applies the saved theme before first paint (a file, not an inline script: the app's CSP allows scripts from 'self' only).
// An explicit pick also sets the browser UI colour (theme-color) for both media variants; keep the colours in step with lib/theme.tsx.
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') {
    document.documentElement.setAttribute('data-theme', t);
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', t === 'dark' ? '#0A0F1F' : '#2E4BFF');
  }
} catch (e) {}
