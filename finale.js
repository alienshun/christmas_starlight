(() => {
  const finale = document.querySelector('#finale');
  const chart = document.querySelector('#asterism-canvas');
  const caption = document.querySelector('#asterism-caption');
  const prism = document.querySelector('#spectral-star-btn');
  const coordinates = document.querySelector('#coords-secret-btn');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ctx = chart.getContext('2d');
  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  function smoothstep(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  const CONSTELLATION_STROKES = {
    A: [[[0.06, 1], [0.50, 0], [0.94, 1]], [[0.24, 0.64], [0.76, 0.64]]],
    L: [[[0.16, 0], [0.16, 1], [0.88, 1]]],
    I: [[[0.26, 0], [0.74, 0]], [[0.50, 0], [0.50, 1]], [[0.26, 1], [0.74, 1]]],
    E: [[[0.86, 0], [0.16, 0], [0.16, 1], [0.86, 1]], [[0.16, 0.50], [0.72, 0.50]]],
    N: [[[0.12, 1], [0.12, 0], [0.88, 1], [0.88, 0]]],
    S: [[[0.86, 0.14], [0.58, 0], [0.22, 0.08], [0.14, 0.30], [0.48, 0.50], [0.86, 0.68], [0.78, 0.92], [0.42, 1], [0.12, 0.86]]],
    H: [[[0.14, 0], [0.14, 1]], [[0.86, 0], [0.86, 1]], [[0.14, 0.50], [0.86, 0.50]]],
    U: [[[0.14, 0], [0.14, 0.72], [0.32, 0.95], [0.68, 0.95], [0.86, 0.72], [0.86, 0]]],
    T: [[[0.08, 0], [0.92, 0]], [[0.50, 0], [0.50, 1]]],
    o: [[[0.50, 0.34], [0.80, 0.44], [0.90, 0.67], [0.80, 0.90], [0.50, 1], [0.20, 0.90], [0.10, 0.67], [0.20, 0.44], [0.50, 0.34]]],
    C: [[[0.88, 0.16], [0.56, 0], [0.20, 0.16], [0.10, 0.50], [0.20, 0.84], [0.56, 1], [0.88, 0.84]]],
    Y: [[[0.10, 0], [0.50, 0.48], [0.90, 0]], [[0.50, 0.48], [0.50, 1]]],
    M: [[[0.08, 1], [0.08, 0], [0.50, 0.56], [0.92, 0], [0.92, 1]]]
  };

  const signature = Array.from('ALIENSHUN', (character) => ({
    character,
    color: '224, 210, 182',
    phase: Math.random() * TAU,
  }));
  const dedication = [
    ['T', 0.96, 0.22, '214, 178, 120'],
    ['o', 0.78, 0.95, '214, 178, 120'],
    ['C', 0.94, 0.36, '94, 200, 229'],
    ['Y', 0.94, 0.36, '242, 201, 107'],
    ['M', 1.04, 0, '224, 112, 154'],
  ].map(([character, width, gap, color]) => ({
    character, width, gap, color, phase: Math.random() * TAU,
  }));
  const tints = ['236, 234, 226', '216, 228, 250', '238, 218, 182'];
  const background = Array.from({ length: 68 }, (_, index) => {
    const magnitude = Math.pow(Math.random(), 2.2);
    return {
      x: 0.02 + Math.random() * 0.96,
      y: 0.08 + Math.random() * 0.84,
      radius: 0.4 + magnitude * 0.85,
      opacity: 0.1 + magnitude * 0.34,
      phase: Math.random() * TAU,
      speed: 0.42 + Math.random() * 0.72,
      tint: tints[index % tints.length],
    };
  });

  let width = 0;
  let height = 0;
  let coordinateClicks = 0;
  let spectral = false;
  let spectrumProgress = 0;
  let frame = 0;
  let lastTime = 0;

  function positionGlyph(glyph, left, top, width, height) {
    glyph.strokes = CONSTELLATION_STROKES[glyph.character].map((stroke) =>
      stroke.map(([x, y]) => [left + x * width, top + y * height])
    );
    const nodes = new Map();
    for (const [x, y] of glyph.strokes.flat()) {
      const key = `${Math.round(x * 2)},${Math.round(y * 2)}`;
      if (!nodes.has(key)) {
        nodes.set(key, {
          x, y,
          radius: 0.95 + Math.abs(Math.sin(x * 13.7 + y * 7.3)) * 0.38,
          phase: (x * 0.17 + y * 0.23) % TAU,
        });
      }
    }
    glyph.nodes = [...nodes.values()];
  }

  function resizeChart() {
    const bounds = chart.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.floor(bounds.width);
    height = chart.clientHeight;
    chart.width = Math.max(1, Math.round(width * pixelRatio));
    chart.height = Math.max(1, Math.round(height * pixelRatio));
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const margin = width * 0.085;
    const slotWidth = (width - margin * 2) / signature.length;
    const glyphWidth = slotWidth * 0.62;
    const glyphHeight = clamp(glyphWidth * 1.45, 22, height * 0.44);
    const top = (height - glyphHeight) * 0.5;
    signature.forEach((glyph, index) => {
      const left = margin + index * slotWidth + (slotWidth - glyphWidth) * 0.5;
      positionGlyph(glyph, left, top, glyphWidth, glyphHeight);
    });

    const unitWidth = glyphHeight * 0.66;
    const total = dedication.reduce((sum, glyph) => sum + glyph.width + glyph.gap, 0);
    let left = (width - total * unitWidth) * 0.5;
    dedication.forEach((glyph) => {
      positionGlyph(glyph, left, top, glyph.width * unitWidth, glyphHeight);
      left += (glyph.width + glyph.gap) * unitWidth;
    });
  }

  function paintPoint(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  function paintConstellation(glyphs, opacity, isSignature, seconds) {
    if (opacity <= 0.005) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.8;
    for (const glyph of glyphs) {
      ctx.strokeStyle = `rgba(${glyph.color}, ${opacity * (isSignature ? 0.38 : 0.56)})`;
      for (const stroke of glyph.strokes) {
        ctx.beginPath();
        ctx.moveTo(...stroke[0]);
        for (const point of stroke.slice(1)) ctx.lineTo(...point);
        ctx.stroke();
      }

      for (const node of glyph.nodes) {
        const twinkle = 0.78 + 0.22 * Math.sin(glyph.phase + node.phase + seconds * 0.66);
        const haloRadius = isSignature ? 4.8 : 5.4;
        const haloOpacity = opacity * twinkle * (isSignature ? 0.28 : 0.42);
        const halo = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, haloRadius);
        halo.addColorStop(0, `rgba(${glyph.color}, ${haloOpacity})`);
        halo.addColorStop(1, `rgba(${glyph.color}, 0)`);
        paintPoint(node.x, node.y, haloRadius, halo);
        const bodyColor = isSignature ? '244, 238, 224' : glyph.color;
        const bodyOpacity = opacity * twinkle * (isSignature ? 0.76 : 0.9);
        paintPoint(node.x, node.y, node.radius, `rgba(${bodyColor}, ${bodyOpacity})`);
      }
    }
  }

  function paint(time) {
    frame = 0;
    if (finale.hidden) return;
    const elapsed = lastTime ? clamp((time - lastTime) / 1000, 0, 0.05) : 0;
    lastTime = time;
    const seconds = reducedMotion.matches ? 0 : time / 1000;
    if (reducedMotion.matches) {
      spectrumProgress = Number(spectral);
    } else if (spectral) {
      spectrumProgress = Math.min(1, spectrumProgress + elapsed * 0.72);
    } else {
      spectrumProgress = Math.max(0, spectrumProgress - elapsed * 0.72);
    }
    ctx.clearRect(0, 0, width, height);
    for (const star of background) {
      const alpha = star.opacity * (0.7 + 0.3 * Math.sin(star.phase + seconds * star.speed));
      paintPoint(star.x * width, star.y * height, star.radius, `rgba(${star.tint}, ${alpha})`);
    }
    paintConstellation(signature, smoothstep((0.46 - spectrumProgress) / 0.46), true, seconds);
    paintConstellation(dedication, smoothstep((spectrumProgress - 0.54) / 0.46), false, seconds);
    if (!reducedMotion.matches) frame = requestAnimationFrame(paint);
  }

  function setSpectral(on) {
    spectral = on;
    finale.classList.toggle('spectral-active', spectral);
    prism.setAttribute('aria-pressed', String(spectral));
    caption.textContent = spectral ? 'ultraviolet plate · λ 365 nm' : 'λ 490 nm · 580 nm · extra-spectral';
    chart.setAttribute('aria-label', spectral ? '青色、金色和玫红色星点连成 To CYM' : '金色星点连成 ALIENSHUN');
    if (reducedMotion.matches && !finale.hidden) paint(performance.now());
  }

  prism.addEventListener('click', () => setSpectral(!spectral));
  coordinates.addEventListener('click', () => {
    coordinateClicks += 1;
    if (coordinateClicks === 3) {
      coordinateClicks = 0;
      setSpectral(!spectral);
    }
  });

  window.addEventListener('resize', () => {
    if (finale.hidden) return;
    resizeChart();
    if (reducedMotion.matches) paint(performance.now());
  });
  reducedMotion.addEventListener('change', () => {
    if (finale.hidden) return;
    cancelAnimationFrame(frame);
    lastTime = 0;
    paint(performance.now());
  });

  window.showChristmasFinale = () => {
    cancelAnimationFrame(frame);
    lastTime = 0;
    spectrumProgress = 0;
    coordinateClicks = 0;
    resizeChart();
    setSpectral(false);
    if (!reducedMotion.matches) paint(performance.now());
  };
})();
