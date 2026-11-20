(() => {
  'use strict';

  const tokenPatterns = {
    comment: /\/\/[^\n]*|\/\*[\s\S]*?\*\//,
    string: /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/,
    keyword: /\b(?:const|let|function|return|if|else|for|of|continue|break|new|true|false|null)\b/,
    number: /(?:\b\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:e[+-]?\d+)?\b/,
  };

  const tokens = new RegExp(Object.entries(tokenPatterns)
    .map(([kind, pattern]) => `(?<${kind}>${pattern.source})`).join('|'), 'g');

  function highlightSource(text) {
    const copy = document.createElement('span');
    copy.className = 'source-code-copy';
    let offset = 0;
    for (const match of text.matchAll(tokens)) {
      if (match.index > offset) {
        copy.append(document.createTextNode(text.slice(offset, match.index)));
      }
      const kind = Object.keys(match.groups).find(key => match.groups[key] !== undefined);
      const span = document.createElement('span');
      span.className = `source-${kind}`;
      span.textContent = match[0];
      copy.append(span);
      offset = match.index + match[0].length;
    }
    if (offset < text.length) copy.append(document.createTextNode(text.slice(offset)));
    return copy;
  }

  window.renderSourceBackdrop = (...excerpts) => {
    const target = document.querySelector('[data-source-code]');
    if (!target) return;

    // Read the live definitions so the displayed code matches the running scene.
    const text = excerpts.map(excerpt => Function.prototype.toString.call(excerpt)).join('\n\n');
    const first = highlightSource(text);
    const loop = highlightSource(text);
    loop.setAttribute('aria-hidden', 'true');
    target.replaceChildren(first, loop);
  };
})();
