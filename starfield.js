(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const EDGE = 64;
  const LAYER_PIXEL_LIMIT = 2_200_000;
  const colors = [
    {shine: '#d9f2ff', glow: '109, 177, 255'},
    {shine: '#b9f7f5', glow: '96, 231, 225'},
    {shine: '#fff1cc', glow: '255, 203, 127'},
    {shine: '#fce0fb', glow: '244, 132, 203'},
    {shine: '#e0d9fb', glow: '174, 137, 249'},
  ];
  const ribbons = [
    {
      path: x => .54 - .43 * x + .105 * Math.sin(x * 5.4 + .41),
      thickness: .105, count: 1_220, colors: [0, 1, 1, 4],
    },
    {
      path: x => .28 + .19 * Math.sin(x * 5.6 - .95) + .19 * x,
      thickness: .10, count: 1_070, colors: [4, 3, 0, 3],
    },
    {
      path: x => .775 - .10 * Math.cos(x * 6.2 - .30) + .06 * x,
      thickness: .14, count: 1_070, colors: [2, 0, 3, 2],
    },
  ];
  let field;
  let sprites;

  function seededRandom(seed) {
    return () => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed / 4_294_967_296;
    };
  }

  function layer(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
    return canvas;
  }

  function makeSprites() {
    return colors.map(({shine, glow}) => {
      const halo = layer(48, 48);
      const pen = halo.getContext('2d');
      const gradient = pen.createRadialGradient(24, 24, 0, 24, 24, 24);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(.115, shine);
      gradient.addColorStop(.24, `rgba(${glow}, .58)`);
      gradient.addColorStop(.55, `rgba(${glow}, .18)`);
      gradient.addColorStop(1, `rgba(${glow}, 0)`);
      pen.fillStyle = gradient;
      pen.fillRect(0, 0, 48, 48);
      return halo;
    });
  }

  function drawHalo(pen, color, x, y, size, alpha) {
    pen.globalAlpha = alpha;
    pen.drawImage(sprites[color], x - size / 2, y - size / 2, size, size);
  }

  function drawPoint(pen, color, x, y, size, alpha) {
    pen.globalAlpha = alpha;
    pen.fillStyle = colors[color].shine;
    pen.fillRect(x - size / 2, y - size / 2, size, size);
  }

  function drawNebula(pen, x, y, width, height, color, alpha) {
    pen.save();
    pen.translate(x, y);
    pen.scale(width, height);
    const glow = colors[color].glow;
    const gradient = pen.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, `rgba(${glow}, ${alpha})`);
    gradient.addColorStop(.45, `rgba(${glow}, ${alpha * .47})`);
    gradient.addColorStop(1, `rgba(${glow}, 0)`);
    pen.globalAlpha = 1;
    pen.fillStyle = gradient;
    pen.fillRect(-1, -1, 2, 2);
    pen.restore();
  }

  function ribbonY(ribbon, along) {
    return ribbon.path(along) + Math.sin(along * 16.5) * .022 + Math.sin(along * 34) * .009;
  }

  function createField(width, height) {
    const paddedWidth = width + EDGE * 2;
    const paddedHeight = height + EDGE * 2;
    const scale = Math.min(1, Math.sqrt(LAYER_PIXEL_LIMIT / (paddedWidth * paddedHeight)));
    const far = layer(paddedWidth * scale, paddedHeight * scale);
    const bands = layer(paddedWidth * scale, paddedHeight * scale);
    const farPen = far.getContext('2d');
    const bandPen = bands.getContext('2d');
    farPen.setTransform(scale, 0, 0, scale, 0, 0);
    bandPen.setTransform(scale, 0, 0, scale, 0, 0);
    const random = seededRandom(21431225);
    const density = Math.max(.45, Math.min(1.7, Math.sqrt(width * height / 1_296_000)));

    drawNebula(farPen, EDGE + width * .24, EDGE + height * .17, width * .49, height * .24, 4, .19);
    drawNebula(farPen, EDGE + width * .76, EDGE + height * .30, width * .45, height * .24, 1, .13);
    drawNebula(farPen, EDGE + width * .87, EDGE + height * .69, width * .38, height * .24, 3, .12);
    drawNebula(farPen, EDGE + width * .15, EDGE + height * .78, width * .34, height * .26, 2, .12);

    const farCount = Math.round(2_560 * density);
    for (let i = 0; i < farCount; i++) {
      const x = random() * paddedWidth;
      const y = random() * paddedHeight;
      const color = Math.floor(random() * colors.length);
      const size = .45 + random() ** 2.3 * 1.37;
      const alpha = .12 + random() ** 1.7 * .65;
      if (size > 1.32) drawHalo(farPen, color, x, y, size * 5.5, alpha);
      drawPoint(farPen, color, x, y, size, alpha * .9);
    }

    for (const ribbon of ribbons) {
      const count = Math.round(ribbon.count * density);
      for (let i = 0; i < count; i++) {
        const along = -.06 + random() * 1.12;
        const spread = (random() + random() + random() - 1.5) * ribbon.thickness;
        const x = EDGE + along * width;
        const y = EDGE + (ribbonY(ribbon, along) + spread) * height;
        const color = ribbon.colors[Math.floor(random() * ribbon.colors.length)];
        const size = .6 + random() ** 2.85 * 1.67;
        const center = 1 - Math.min(1, Math.abs(spread) / ribbon.thickness);
        const alpha = (.19 + random() ** 1.55 * .65) * (.50 + center * .50);
        if (size > 1.12) drawHalo(bandPen, color, x, y, size * 6.8, alpha * .89);
        drawPoint(bandPen, color, x, y, size, alpha * .86);
      }
    }

    const twinkles = Array.from({length: Math.round(91 * density)}, () => ({
      x: random(), y: random(), color: Math.floor(random() * colors.length),
      phase: random() * TAU, speed: .22 + random() * .52, size: 2.5 + random() ** 1.8 * 7.5,
    }));
    const flowing = ribbons.flatMap((ribbon, index) => {
      const direction = index === 1 ? -1 : 1;
      return Array.from({length: Math.round(38 * Math.min(1.2, density))}, () => ({
        ribbon, along: random(), offset: (random() + random() - 1) * ribbon.thickness * .72,
        speed: direction * (.017 + random() ** 1.55 * .031),
        color: ribbon.colors[Math.floor(random() * ribbon.colors.length)],
        phase: random() * TAU, size: 6 + random() ** 1.7 * 13,
      }));
    });
    return {width, height, paddedWidth, paddedHeight, far, bands, twinkles, flowing};
  }

  function drawFlare(pen, x, y, length, color, alpha) {
    pen.globalAlpha = alpha;
    pen.fillStyle = colors[color].shine;
    pen.beginPath();
    pen.moveTo(x, y - length);
    pen.lineTo(x + length * .08, y - length * .085);
    pen.lineTo(x + length * .62, y);
    pen.lineTo(x + length * .08, y + length * .085);
    pen.lineTo(x, y + length);
    pen.lineTo(x - length * .08, y + length * .085);
    pen.lineTo(x - length * .62, y);
    pen.lineTo(x - length * .08, y - length * .085);
    pen.closePath();
    pen.fill();
  }

  window.paintChristmasStarfield = function paintChristmasStarfield(ctx, width, height, seconds, yaw = 0, pitch = 0) {
    sprites ??= makeSprites();
    if (!field || width !== field.width || height !== field.height) field = createField(width, height);
    const turn = Math.sin(yaw);
    const farX = turn * 11 + Math.sin(seconds * .084) * 13;
    const farY = pitch * 40 + Math.sin(seconds * .103) * 12;
    const bandX = turn * 26 + Math.sin(seconds * .101 + .63) * 27;
    const bandY = pitch * 94 + Math.cos(seconds * .119) * 22;
    const shimmer = .89 + .095 * Math.sin(seconds * .28);

    ctx.save();
    ctx.globalAlpha = .90;
    ctx.drawImage(field.far, farX - EDGE, farY - EDGE, field.paddedWidth, field.paddedHeight);
    ctx.globalAlpha = shimmer;
    ctx.drawImage(field.bands, bandX - EDGE, bandY - EDGE, field.paddedWidth, field.paddedHeight);

    for (const fleck of field.flowing) {
      let along = fleck.along + seconds * fleck.speed;
      along -= Math.floor(along);
      const x = along * width + bandX;
      const sway = Math.sin(seconds * .62 + fleck.phase) * .012;
      const y = (ribbonY(fleck.ribbon, along) + fleck.offset + sway) * height + bandY;
      const edge = Math.min(1, along * 34, (1 - along) * 34);
      const pulse = .45 + .55 * Math.sin(seconds * 1.35 + fleck.phase) ** 2;
      drawHalo(ctx, fleck.color, x, y, fleck.size, edge * pulse * .92);
    }

    for (const star of field.twinkles) {
      const pulse = (.5 + .5 * Math.sin(star.phase + seconds * star.speed * TAU)) ** 4;
      const x = star.x * width + bandX * .66 + Math.sin(seconds * .17 + star.phase) * 13;
      const y = star.y * height + bandY * .7 - Math.cos(seconds * .14 + star.phase) * 9;
      const size = star.size * (.68 + pulse * .62);
      drawHalo(ctx, star.color, x, y, Math.min(43, size * 4.8), .17 + pulse * .73);
      if (pulse > .47) drawFlare(ctx, x, y, size * .91, star.color, (pulse - .18) * .92);
    }
    ctx.restore();
  };
})();
