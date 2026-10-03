// Applies the saved theme before first paint (a file, not an inline script: the app's CSP allows scripts from 'self' only).
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
