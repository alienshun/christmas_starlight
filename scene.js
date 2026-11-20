(() => {
  'use strict';

  const scene = document.querySelector('#christmas-scene');
  const canvas = document.querySelector('#winter-scene');
  const ctx = canvas.getContext('2d');
  const star = document.querySelector('#tree-star');
  const finale = document.querySelector('#finale');
  const replay = document.querySelector('#replay');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;
  const REVEAL_AT = 12_000;
  const HOLD_FOR = 1_150;
  const PITCH_LIMIT = .105;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function seededRandom(seed) {
    return function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function ease(from, to, value) {
    const t = clamp((value - from) / (to - from), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function makeCanvas(width, height) {
    const layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;
    return layer;
  }

  function makeGlow(color, middleAlpha) {
    const layer = makeCanvas(48, 48);
    const pen = layer.getContext('2d');
    const gradient = pen.createRadialGradient(24, 24, 0, 24, 24, 24);
    gradient.addColorStop(0, `rgba(${color}, 1)`);
    gradient.addColorStop(.14, `rgba(${color}, ${middleAlpha})`);
    gradient.addColorStop(.37, `rgba(${color}, .19)`);
    gradient.addColorStop(1, `rgba(${color}, 0)`);
    pen.fillStyle = gradient;
    pen.fillRect(0, 0, 48, 48);
    return layer;
  }

  function glow(sprite, x, y, radius, opacity) {
    ctx.globalAlpha = opacity;
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  }

  const glows = {
    ice: makeGlow('204, 230, 255', .79),
    gold: makeGlow('255, 222, 160', .8),
    green: makeGlow('176, 244, 220', .71),
    rose: makeGlow('255, 182, 203', .69),
  };
  const random = seededRandom(1225);
  const snow = Array.from({length: 645}, () => ({
    x: random(), y: random(), depth: random(), phase: random() * TAU,
    size: random(), brightness: random(), drift: random(),
  }));
  const snowOnGround = Array.from({length: 1_140}, () => ({
    x: random() + random() - 1, y: random() ** 1.22,
    size: random(), phase: random() * TAU, brightness: random(),
  }));
  const garland = Array.from({length: 1_610}, () => ({
    u: random(), offset: random() + random() - 1, lift: random() + random() - 1,
    size: random(), tint: random(), phase: random() * TAU,
  }));
  const stardust = Array.from({length: 760}, () => ({
    x: random(), y: random(), depth: random(), phase: random() * TAU,
    size: random(), tint: random(), rise: 8 + random() * 13,
    offsetX: 0, offsetY: 0, vx: 0, vy: 0,
  }));
  const meteors = [
    {x: .05, y: .065, dx: .36, dy: .245, period: 8.4, offset: 4.1, life: 1.86, rgb: '192, 226, 255', color: 'ice'},
    {x: .98, y: .12, dx: -.30, dy: .205, period: 10.8, offset: 9.3, life: 1.72, rgb: '255, 174, 220', color: 'rose'},
    {x: .72, y: .045, dx: .24, dy: .172, period: 10.1, offset: 8.9, life: 1.52, rgb: '255, 224, 167', color: 'gold'},
  ];
  const meteorRandom = seededRandom(5719);
  const meteorDust = Array.from({length: 36}, () => ({
    lag: meteorRandom(), spread: meteorRandom() + meteorRandom() - 1,
    glow: meteorRandom(), size: meteorRandom(),
  }));
  const trail = [];
  const wind = {
    x: 0, y: 0, dx: 0, dy: 0, strength: 0,
    sampledAt: -Infinity, movedAt: -Infinity, emittedAt: -Infinity,
  };
  const camera = {yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0};
  const starFacets = [
    '#ffe8ab', '#af762d', '#f8d288', '#986d36', '#d8a857',
    '#ffedb5', '#bc8642', '#f2d290', '#ba8745', '#fff2c3',
  ];
  const starOutline = starFacets.map((_, i) => {
    const angle = i * Math.PI / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? 1 : .43;
    return {x: Math.cos(angle) * radius, y: Math.sin(angle) * radius};
  });

  let layout;
  let spruce;
  let renderedView;
  let pointer = null;
  let frame = 0;
  let previousFrame = null;
  let startedAt = 0;
  let hiddenSince = null;
  let hideTimer = 0;
  let inFinale = false;
  let ready = false;
  let hold = null;

  function measureScene() {
    const width = scene.clientWidth;
    const height = scene.clientHeight;
    if (!width || !height) return;
    const density = Math.min(window.devicePixelRatio || 1, width * height > 1_400_000 ? 1.5 : 2);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    ctx.setTransform(density, 0, 0, density, 0, 0);

    const treeHeight = Math.min(height * .727, width * 1.16, 870);
    const treeWidth = treeHeight * .84;
    const center = width * .5;
    const ground = height * (width < 600 && height > width ? .802 : .878);
    const radius = Math.max(13, Math.min(39, treeHeight * .056));
    const tree = {x: center - treeWidth / 2, y: ground - treeHeight, width: treeWidth, height: treeHeight};
    const topper = {x: center, y: tree.y + treeHeight * .01 - radius * .55, radius};
    const stardustCount = clamp(Math.round(180 + width * height / 2_650), 280, stardust.length);
    layout = {width, height, density, center, ground, tree, topper, stardustCount};
    refreshSpruce(performance.now(), false);

    star.style.setProperty('--star-x', `${topper.x}px`);
    star.style.setProperty('--star-y', `${topper.y}px`);
    star.style.setProperty('--star-size', `${Math.max(48, radius * 2.5)}px`);
    scheduleFrame();
  }

  function cameraInMotion() {
    return Math.abs(camera.targetYaw - camera.yaw) > .0015 ||
      Math.abs(camera.targetPitch - camera.pitch) > .0005;
  }

  function updateCamera(delta, still) {
    if (camera.yaw === camera.targetYaw && camera.pitch === camera.targetPitch) return;
    const easing = still ? 1 : 1 - Math.exp(-Math.max(8, delta) / 39);
    camera.yaw += (camera.targetYaw - camera.yaw) * easing;
    camera.pitch += (camera.targetPitch - camera.pitch) * easing;
    if (!cameraInMotion()) {
      camera.yaw = camera.targetYaw;
      camera.pitch = camera.targetPitch;
    }
    scene.style.setProperty('--source-x', `${-Math.sin(camera.yaw) * 24}px`);
    scene.style.setProperty('--source-y', `${camera.pitch * 120}px`);
  }

  function refreshSpruce(now, moving) {
    const {tree, density} = layout;
    const pixels = Math.min(density, moving ? 1 : 1.75);
    const view = renderedView;
    const resized = !view || Math.abs(view.height - tree.height) > 10;
    if (!resized && view.moving === moving && view.pixels === pixels &&
        Math.abs(view.yaw - camera.yaw) < (moving ? .023 : .001) &&
        Math.abs(view.pitch - camera.pitch) < (moving ? .004 : .0005)) return;
    if (!resized && moving && now - view.time < 34) return;

    spruce = window.renderSpruce(tree.width, tree.height, pixels, camera.yaw, camera.pitch, moving, spruce?.canvas);
    renderedView = {yaw: camera.yaw, pitch: camera.pitch, height: tree.height, pixels, moving, time: now};
  }

  function drawSnow(seconds, near) {
    const {width, height} = layout;
    const start = near ? (width < 600 ? 340 : 530) : 0;
    const end = width < 600 ? (near ? 427 : 340) : (near ? snow.length : 530);
    ctx.fillStyle = near ? '#e7f3ff' : '#c8dcf5';
    for (let i = start; i < end; i++) {
      const flake = snow[i];
      const speed = (near ? 24 : 9) + flake.depth ** 2 * (near ? 36 : 19);
      const bend = Math.sin(flake.phase + seconds * .33) * (6 + 22 * flake.drift);
      const parallax = Math.sin(camera.yaw) * (near ? 38 : 12) * (.45 + flake.depth);
      const x = (flake.x * width + width + bend + parallax + seconds * (2.5 + 1.5 * flake.drift)) % width;
      const y = (flake.y * (height + 30) + seconds * speed) % (height + 30) - 15 - camera.pitch * (near ? 140 : 42);
      const size = .4 + flake.size ** 3 * (near ? 2.55 : 1.16);
      const opacity = (.22 + flake.brightness * .58) * (near ? .95 : .56);
      if (near || flake.size > .75) {
        glow(glows.ice, x, y, size * (near ? 3.5 : 2.65), opacity);
      } else {
        ctx.globalAlpha = opacity;
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function glint(x, y, length, opacity) {
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#fff2d7';
    ctx.beginPath();
    ctx.moveTo(x - length, y);
    ctx.lineTo(x - length * .14, y - length * .14);
    ctx.lineTo(x, y - length * 1.35);
    ctx.lineTo(x + length * .14, y - length * .14);
    ctx.lineTo(x + length, y);
    ctx.lineTo(x + length * .14, y + length * .14);
    ctx.lineTo(x, y + length * 1.35);
    ctx.lineTo(x - length * .14, y + length * .14);
    ctx.closePath();
    ctx.fill();
  }

  function drawStardust(seconds, delta, now, foreground) {
    const {width, height, stardustCount} = layout;
    const span = height + 36;
    const parallax = 32 * Math.sin(camera.yaw);
    const gust = delta && now - wind.movedAt < 850
      ? wind.strength * Math.exp(-(now - wind.movedAt) / 180)
      : 0;
    const reach = width < 600 ? 114 : 165;
    const damping = Math.exp(-delta * 3.9);
    for (let i = 0; i < stardustCount; i++) {
      const dust = stardust[i];
      if ((dust.depth > .52) !== foreground) continue;

      const drift = Math.sin(dust.phase + seconds * .37) * (8 + dust.depth * 25);
      const baseX = dust.x * width + drift + dust.depth * parallax;
      const baseY = ((dust.y * span - seconds * dust.rise) % span + span) % span - 18;
      const dx = baseX + dust.offsetX - wind.x;
      const dy = baseY + dust.offsetY - wind.y;
      const withinReach = gust && Math.abs(dx) < reach && Math.abs(dy) < reach;
      const distance = withinReach ? Math.hypot(dx, dy) : reach;
      const breeze = withinReach ? gust * Math.max(0, 1 - distance / reach) ** 1.55 : 0;
      if (delta && (breeze || dust.vx || dust.vy)) {
        const inverse = 1 / Math.max(distance, 8);
        dust.vx = (dust.vx + ((wind.dx * 380 + 190 * dx * inverse) * breeze - dust.offsetX * 9) * delta) * damping;
        dust.vy = (dust.vy + ((wind.dy * 380 + 190 * dy * inverse) * breeze - dust.offsetY * 9) * delta) * damping;
        dust.offsetX += dust.vx * delta;
        dust.offsetY += dust.vy * delta;
      }

      const x = baseX + (delta ? dust.offsetX : 0);
      const y = baseY + (delta ? dust.offsetY : 0);
      const flicker = (.5 + .5 * Math.sin(dust.phase + seconds * (1 + dust.size * 2))) ** 2.7;
      const opacity = clamp((.13 + flicker * .74) * (.45 + dust.depth * .5) + breeze * .87, 0, 1);
      const size = 1.65 + dust.size ** 3 * (foreground ? 5.9 : 3.6) + breeze * 3.5;
      const sprite = dust.tint < .20 ? glows.rose : dust.tint < .36 ? glows.ice : glows.gold;
      glow(sprite, x, y, size, opacity);
      if (foreground && dust.size > .93 && flicker + breeze > .59) {
        glint(x, y, 1.1 + flicker * 2.7 + breeze * 1.1, opacity * .69);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPointerTrail(now) {
    while (trail.length && now - trail[0].bornAt > 760) trail.shift();
    for (const spark of trail) {
      const age = (now - spark.bornAt) / 760;
      const x = spark.x + spark.vx * age;
      const y = spark.y + spark.vy * age - age * age * 19;
      const alpha = spark.alpha * (1 - age) ** 1.7;
      glow(spark.rose ? glows.rose : glows.gold, x, y, spark.radius * (1 - age * .47), alpha);
      if (spark.radius > 5 && age < .68) glint(x, y, 1.9, alpha * .76);
    }
    ctx.globalAlpha = 1;
  }

  function drawMeteors(seconds) {
    const {width, height} = layout;
    const scale = clamp(Math.min(width, height) / 650, .48, 1.3);
    const parallaxX = Math.sin(camera.yaw) * 19;
    ctx.lineCap = 'round';
    for (const meteor of meteors) {
      const progress = ((seconds + meteor.offset) % meteor.period) / meteor.life;
      if (progress <= 0 || progress >= 1) continue;
      const brightness = ease(0, .17, progress) * (1 - ease(.58, 1, progress));
      const tail = Math.max(0, progress - .26);
      const headX = (meteor.x + meteor.dx * progress) * width + parallaxX;
      const headY = (meteor.y + meteor.dy * progress) * height - camera.pitch * 41;
      const tailX = (meteor.x + meteor.dx * tail) * width + parallaxX;
      const tailY = (meteor.y + meteor.dy * tail) * height - camera.pitch * 41;

      const tint = ctx.createLinearGradient(tailX, tailY, headX, headY);
      tint.addColorStop(0, `rgba(${meteor.rgb}, 0)`);
      tint.addColorStop(.74, `rgba(${meteor.rgb}, .32)`);
      tint.addColorStop(1, `rgba(${meteor.rgb}, .92)`);
      ctx.strokeStyle = tint;
      ctx.globalAlpha = brightness;
      ctx.lineWidth = 1.7 * scale;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.stroke();

      for (const mote of meteorDust) {
        const behind = progress - mote.lag * .36;
        if (behind < 0) continue;
        const spread = mote.spread * (2 + mote.lag * 35) * scale;
        const x = (meteor.x + meteor.dx * behind) * width + parallaxX + spread * .57;
        const y = (meteor.y + meteor.dy * behind) * height - camera.pitch * 41 + spread;
        const alpha = brightness * (1 - mote.lag * .72) * (.32 + mote.glow * .66);
        glow(glows[meteor.color], x, y, (1.5 + mote.size ** 3 * 5.2) * scale, alpha);
      }
      glow(glows[meteor.color], headX, headY, 16 * scale, brightness * .96);
      glint(headX, headY, 4.2 * scale, brightness);
    }
    ctx.globalAlpha = 1;
  }

  function drawGround(seconds) {
    const {width, height, center, ground, tree} = layout;
    ctx.save();
    ctx.translate(center, ground + 5);
    ctx.scale(tree.width * .79, tree.height * .101);
    const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    haze.addColorStop(0, '#b4ccdf63');
    haze.addColorStop(.25, '#7c9ebf34');
    haze.addColorStop(.66, '#7092bd13');
    haze.addColorStop(1, '#6085b500');
    ctx.fillStyle = haze;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.scale(.32, .41);
    const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    shadow.addColorStop(0, '#060b15df');
    shadow.addColorStop(1, '#060b1500');
    ctx.fillStyle = shadow;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();

    ctx.fillStyle = '#c4ddf8';
    const count = width < 600 ? 670 : snowOnGround.length;
    for (let i = 0; i < count; i++) {
      const bit = snowOnGround[i];
      const x = center + bit.x * width * (.80 - .30 * bit.y) + Math.sin(bit.phase + seconds * .43) * 8;
      const y = ground + height * (.095 - bit.y * (width < 600 ? .33 : .42)) + Math.sin(bit.phase + seconds * .61) * 8;
      const twinkle = .56 + .44 * Math.sin(bit.phase + seconds * (.35 + bit.brightness * 1.39));
      const opacity = (.48 + .52 * bit.brightness) * (1 - bit.y * .71) * twinkle;
      const size = (.37 + bit.size ** 3 * 1.57) * (1 - .47 * bit.y);
      if (bit.size > .58) glow(glows.ice, x, y, size * 4.3, opacity);
      else {
        ctx.globalAlpha = opacity * .84;
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Draw the helix in two passes so the branches occlude its back half.
  function drawGarland(seconds, progress, front) {
    const {width, center, tree} = layout;
    const count = width < 600 ? 1_130 : garland.length;
    const scale = Math.max(.54, Math.min(1.45, tree.height / 565));
    ctx.fillStyle = '#fff1ca';
    for (let i = 0; i < count; i++) {
      const grain = garland[i];
      const u = (grain.u + seconds * (.019 + grain.offset * .009)) % 1;
      const angle = u * TAU * 2.71 + 1.67 + seconds * .53 - camera.yaw;
      const depth = Math.cos(angle);
      if ((depth > -.15) !== front) continue;

      const arrival = ease(u - .095, u + .014, progress);
      const comet = Math.exp(-((u - progress) ** 2) / .0021);
      const twinkle = .71 + .29 * Math.sin(grain.phase + seconds * (2 + grain.size * 2));
      const concentrated = grain.tint > .36;
      const travel = .82 + .18 * Math.sin(seconds * 2.3 - u * TAU * 2.1);
      const brightness = concentrated ? .73 : .28;
      const opacity = arrival * twinkle * (brightness * travel + (1 - brightness) * comet) * (front ? 1 : .72);
      if (opacity < .033) continue;

      const spread = (1 - u) * .440 + .067;
      const x = center + Math.sin(angle) * tree.width * spread
        + grain.offset * (9 + 33 * (1 - u)) * scale;
      const heightSpread = (concentrated ? .57 : 1.45) * (4 + 13 * (1 - u));
      const y = tree.y + tree.height * (.902 - u * .825 + depth * (.054 + camera.pitch * .48) * (1.19 - u))
        + grain.lift * heightSpread * scale;
      const size = scale * (.5 + grain.size ** 2 * 1.65) * (1 + comet * .42);
      if (grain.tint > .57) {
        glow(grain.tint > .90 ? glows.ice : glows.gold, x, y, size * 3.55, opacity);
      } else {
        ctx.globalAlpha = opacity;
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawBranchLights(seconds, progress) {
    const {tree} = layout;
    const scale = Math.max(.52, Math.min(1.32, tree.height / 540));
    for (const [i, light] of spruce.lights.entries()) {
      const phase = light.phase ?? i * 1.713;
      const twinkle = (.55 + .45 * Math.sin(phase + seconds * (1.3 + (i % 15) * .12))) ** 2.3;
      const lit = .24 + .76 * ease(1 - light.y - .18, 1 - light.y + .11, progress);
      const x = tree.x + light.x * tree.width;
      const y = tree.y + light.y * tree.height;
      const size = (1.65 + light.size ** 2.7 * 7.8) * scale;
      glow(glows[light.type] || glows.gold, x, y, size, lit * (.18 + twinkle * .82) * (light.visibility ?? 1));
    }
    ctx.globalAlpha = 1;
  }

  function drawTopper(seconds, charge, held) {
    const {x, y, radius} = layout.topper;
    const shimmer = .5 + .5 * Math.sin(seconds * 1.8);
    const pulse = ready && !motion.matches ? ((seconds - REVEAL_AT / 1_000) % 4.8) / 1.1 : 1;
    glow(glows.gold, x, y, radius * (2.2 + charge * .65 + held * .45),
      .26 + charge * (.12 + shimmer * .16) + held * .24);
    if (pulse < 1 && !held) {
      ctx.globalAlpha = (1 - pulse) ** 2 * .36;
      ctx.beginPath();
      ctx.arc(x, y, radius * (1.03 + pulse * .94), 0, TAU);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ffe4aa';
      ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const angle = i * TAU / 7 + .21;
        const distance = radius * (1 + pulse * (1.07 + .28 * (i % 3)));
        const alpha = (1 - pulse) ** 1.75 * (.4 + (i % 3) * .18);
        const gx = x + Math.cos(angle) * distance;
        const gy = y + Math.sin(angle) * distance;
        glow(i % 3 === 1 ? glows.rose : glows.gold, gx, gy, 4 + 3 * (i % 3), alpha);
        if (i % 2 === 0) glint(gx, gy, (1 - pulse) * 3.7 + 1, alpha);
      }
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(radius, radius);
    for (let i = 0; i < starOutline.length; i++) {
      const a = starOutline[i];
      const b = starOutline[(i + 1) % starOutline.length];
      ctx.beginPath();
      ctx.moveTo(-.022, .038);
      ctx.lineTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.closePath();
      ctx.fillStyle = starFacets[i];
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(starOutline[0].x, starOutline[0].y);
    for (const point of starOutline.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = .8 / radius;
    ctx.strokeStyle = '#ffe4aacc';
    ctx.stroke();
    if (held) {
      ctx.beginPath();
      ctx.arc(0, 0, 1.3, -Math.PI / 2, -Math.PI / 2 + TAU * held);
      ctx.lineWidth = 1.5 / radius;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#fff0bf';
      ctx.stroke();
    }
    ctx.restore();
  }

  function scheduleFrame() {
    if (!frame && !inFinale && layout && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function draw(now) {
    frame = 0;
    if (inFinale || document.hidden) return;
    const elapsed = now - startedAt;
    const still = motion.matches;
    const delta = previousFrame === null ? 16 : clamp(now - previousFrame, 0, 47);
    previousFrame = now;
    updateCamera(delta, still);
    refreshSpruce(now, Boolean(pointer?.dragging || cameraInMotion()));
    const seconds = still ? 12.9 : elapsed / 1_000;
    const progress = still ? 1 : ease(.35, 10.4, seconds);
    const charge = still ? 1 : ease(9.45, 12, seconds);
    if (!ready && (still || elapsed >= REVEAL_AT)) {
      ready = true;
      star.disabled = false;
    }
    const held = hold ? Math.min(1, (now - hold.since) / HOLD_FOR) : 0;
    const {width, height, tree} = layout;
    ctx.clearRect(0, 0, width, height);
    window.paintChristmasStarfield?.(ctx, width, height, seconds, camera.yaw, camera.pitch);
    if (!still) drawMeteors(seconds);
    drawSnow(seconds, false);
    drawGround(seconds);
    drawStardust(seconds, still ? 0 : delta / 1_000, now, false);
    drawGarland(seconds, progress, false);
    ctx.drawImage(spruce.canvas, tree.x, tree.y, tree.width, tree.height);
    drawBranchLights(seconds, progress);
    drawGarland(seconds, progress, true);
    drawTopper(seconds, charge, held);
    drawSnow(seconds, true);
    drawStardust(seconds, still ? 0 : delta / 1_000, now, true);
    if (!still) drawPointerTrail(now);
    if (held >= 1) openFinale();
    else if (!still || hold) scheduleFrame();
  }

  function beginHold(input) {
    if (!ready || hold || inFinale) return;
    hold = {input, since: performance.now()};
    scheduleFrame();
  }

  function cancelHold() {
    if (!hold) return;
    hold = null;
    scheduleFrame();
  }

  function trackWind(event, dragging) {
    if (motion.matches) return;
    const now = performance.now();
    const x = event.clientX;
    const y = event.clientY;
    const recent = now - wind.sampledAt < 190;
    const dx = recent ? x - wind.x : (event.movementX || 0);
    const dy = recent ? y - wind.y : (event.movementY || 0);
    const distance = Math.hypot(dx, dy);
    wind.x = x;
    wind.y = y;
    wind.sampledAt = now;
    if (distance < .5) return;

    wind.dx = dx / distance;
    wind.dy = dy / distance;
    wind.strength = clamp(distance / (dragging ? 16 : 23), .25, 1);
    wind.movedAt = now;
    if (now - wind.emittedAt < (dragging ? 25 : 42)) return;
    wind.emittedAt = now;
    const count = dragging ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const lag = (i + .25 + random() * .35) / count;
      trail.push({
        x: x - dx * lag + (random() - .5) * 8,
        y: y - dy * lag + (random() - .5) * 8,
        vx: -wind.dx * 23 + (random() - .5) * 31,
        vy: -wind.dy * 19 + (random() - .5) * 27,
        radius: 2.25 + random() ** 1.55 * 5,
        alpha: .35 + random() * .46,
        rose: random() < .31,
        bornAt: now,
      });
    }
    if (trail.length > 78) trail.splice(0, trail.length - 78);
  }

  function startPointer(event) {
    if (event.button !== 0 || !event.isPrimary || pointer || inFinale) return;
    const element = event.currentTarget || event.target;
    pointer = {
      id: event.pointerId, element, x: event.clientX, y: event.clientY,
      threshold: event.pointerType === 'touch' ? 9 : 6, dragging: false,
    };
    element.setPointerCapture(event.pointerId);
    if (element === star) beginHold(event.pointerId);
    else cancelHold();
  }

  function movePointer(event) {
    if (event.isPrimary === false || inFinale) return;
    const active = pointer?.id === event.pointerId;
    if (event.pointerType !== 'touch' || active) trackWind(event, active && pointer.dragging);
    if (!active) return;

    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.dragging) {
      if (Math.hypot(dx, dy) < pointer.threshold) return;
      pointer.dragging = true;
      scene.classList.add('is-dragging');
      cancelHold();
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    camera.targetYaw += dx * TAU / Math.max(425, layout.width * .62);
    camera.targetPitch = clamp(camera.targetPitch - dy * .001, -PITCH_LIMIT, PITCH_LIMIT);
    scheduleFrame();
  }

  function releasePointer() {
    if (!pointer) return;
    const {element, id} = pointer;
    pointer = null;
    scene.classList.remove('is-dragging');
    if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    if (hold?.input === id) cancelHold();
    scheduleFrame();
  }

  function openFinale() {
    inFinale = true;
    cancelHold();
    releasePointer();
    trail.length = 0;
    scene.inert = true;
    scene.classList.add('is-leaving');
    finale.hidden = false;
    window.showChristmasFinale();
    finale.focus({preventScroll: true});
    hideTimer = setTimeout(() => { scene.hidden = true; }, motion.matches ? 0 : 1_140);
  }

  function startScene() {
    clearTimeout(hideTimer);
    finale.hidden = true;
    scene.hidden = false;
    scene.inert = false;
    scene.classList.remove('is-leaving');
    inFinale = false;
    ready = false;
    star.disabled = true;
    camera.yaw = camera.targetYaw = 0;
    camera.pitch = camera.targetPitch = 0;
    scene.style.setProperty('--source-x', '0px');
    scene.style.setProperty('--source-y', '0px');
    previousFrame = null;
    wind.movedAt = -Infinity;
    wind.sampledAt = -Infinity;
    wind.emittedAt = -Infinity;
    wind.strength = 0;
    for (const dust of stardust) dust.offsetX = dust.offsetY = dust.vx = dust.vy = 0;
    measureScene();
    startedAt = performance.now();
    hiddenSince = document.hidden ? startedAt : null;
  }

  for (const element of [canvas, star]) {
    element.addEventListener('pointerdown', startPointer);
    element.addEventListener('pointermove', movePointer);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      element.addEventListener(name, event => {
        if (pointer?.id === event.pointerId) releasePointer();
      });
    }
  }
  scene.addEventListener('keydown', event => {
    if (event.target !== scene) return;
    switch (event.key) {
      case 'ArrowLeft': camera.targetYaw -= Math.PI / 12; break;
      case 'ArrowRight': camera.targetYaw += Math.PI / 12; break;
      case 'ArrowUp': camera.targetPitch += .035; break;
      case 'ArrowDown': camera.targetPitch -= .035; break;
      default: return;
    }
    camera.targetPitch = clamp(camera.targetPitch, -PITCH_LIMIT, PITCH_LIMIT);
    event.preventDefault();
    scheduleFrame();
  });
  star.addEventListener('contextmenu', event => event.preventDefault());
  star.addEventListener('keydown', event => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (!event.repeat) beginHold(event.key);
  });
  star.addEventListener('keyup', event => {
    if (hold?.input !== event.key) return;
    event.preventDefault();
    cancelHold();
  });
  // A screen reader can activate a button directly, without sending down/up events.
  star.addEventListener('click', event => {
    if (event.detail === 0 && ready && !hold && !inFinale) openFinale();
  });
  star.addEventListener('blur', cancelHold);
  window.addEventListener('blur', () => {
    releasePointer();
    cancelHold();
  });
  window.addEventListener('resize', measureScene);
  motion.addEventListener('change', scheduleFrame);
  document.addEventListener('visibilitychange', () => {
    if (inFinale) return;
    const now = performance.now();
    if (document.hidden) {
      hiddenSince = now;
      releasePointer();
      cancelHold();
    } else {
      if (hiddenSince !== null) startedAt += now - hiddenSince;
      hiddenSince = null;
      previousFrame = null;
      scheduleFrame();
    }
  });
  replay.addEventListener('click', () => {
    startScene();
    scene.focus({preventScroll: true});
  });

  window.renderSourceBackdrop(makeCanvas, makeGlow, drawGarland, drawStardust);
  startScene();
})();
