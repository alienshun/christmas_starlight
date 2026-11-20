(() => {
  'use strict';

  const turn = Math.PI * 2;
  const needleColors = [
    '#0b251d', '#12382a', '#194737', '#255a40', '#326d4f',
    '#478763', '#5e9e7c', '#7db497', '#9bc9ae',
  ];

  function seededRandom(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function trunkCenter(y) {
    return Math.sin(y * 11) * Math.sin(y * Math.PI) * .007;
  }

  // The view keeps the leader anchored while rotating the tree around its trunk.
  function makeCamera(width, height, yaw, pitch) {
    const cosine = Math.cos(yaw);
    const sine = Math.sin(yaw);
    const tilt = Math.max(-.105, Math.min(.105, pitch));
    return {
      width, height,
      depth(point) { return point.x * sine + point.z * cosine; },
      project(point) {
        const x = point.x * cosine - point.z * sine;
        const z = point.x * sine + point.z * cosine;
        // Keep foreground twigs inside the canvas when looking down at the lowest whorl.
        const tiltWeight = 1 - Math.max(0, (point.y - .65) * 1.9);
        return {
          x: (.5 + x * (1 + z * .18)) * width,
          y: (point.y + z * (.106 + tilt * tiltWeight)) * height,
          z,
        };
      },
    };
  }

  function branchesForTree(random) {
    const branches = [];
    const levels = 23;
    for (let level = 0; level < levels; level++) {
      const age = level / (levels - 1);
      const y = .047 + age * .795;
      const branchCount = 6 + Math.round(age * 5);
      const twist = random() * turn;
      for (let index = 0; index < branchCount; index++) {
        const angle = twist + index / branchCount * turn + (random() - .5) * .42;
        const opening = Math.cos(angle * 3 + age * 8) * .028;
        const reach = (.028 + age ** .84 * .403 + opening * age) * (.77 + random() * .34);
        const rootY = y + (random() - .5) * (.012 + age * .026);
        const lift = .004 + random() * .018;
        const droop = age * (.031 + random() * .039);
        branches.push({
          age, angle, rootY, reach, lift, droop,
          depth: Math.sin(angle) * reach * .58,
          hue: random(),
        });
      }

      // Younger shoots fill the gaps between whorls and cover the trunk
      // where needles face the camera.
      for (let shoot = 0; shoot < 3; shoot++) {
        const angle = Math.PI * (.24 + random() * .52);
        const reach = (.025 + age * .28) * (.55 + random() * .46);
        branches.push({
          age, angle, reach,
          rootY: y - .018 + (random() - .5) * (.018 + age * .018),
          lift: .005 + random() * .02,
          droop: age * (.014 + random() * .044),
          depth: Math.sin(angle) * reach * .58,
          hue: random() * .84,
          young: true,
        });
      }
    }
    return branches.sort((first, second) => first.depth - second.depth);
  }

  function rearShoots(branches) {
    const random = seededRandom(47122);
    return branches.filter(branch => branch.young && branch.age > .09 && random() < .82).map(branch => {
      const angle = branch.angle + Math.PI + (random() - .5) * .65;
      const reach = branch.reach * (.68 + random() * .29);
      return {
        ...branch, angle, reach,
        rootY: branch.rootY + (random() - .62) * .019,
        depth: Math.sin(angle) * reach * .58,
      };
    });
  }

  function branchPoint(branch, along) {
    const reach = branch.reach * along;
    const y = branch.rootY + branch.droop * along * (1.3 - .44 * along) - branch.lift * along ** 3;
    return {
      x: trunkCenter(branch.rootY) + Math.cos(branch.angle) * reach,
      y,
      z: Math.sin(branch.angle) * reach,
    };
  }

  function drawTrunk(pen, camera, random) {
    const {width, height} = camera;
    const bottom = camera.project({x: trunkCenter(.986), y: .986, z: 0});
    const middle = camera.project({x: trunkCenter(.59), y: .59, z: 0});
    const thickness = width * .016;
    const bark = pen.createLinearGradient(bottom.x - thickness, 0, bottom.x + thickness, 0);
    bark.addColorStop(0, '#131b16');
    bark.addColorStop(.36, '#323226');
    bark.addColorStop(.6, '#3e372b');
    bark.addColorStop(1, '#222720');
    pen.fillStyle = bark;
    pen.beginPath();
    pen.moveTo(width * .5, height * .011);
    pen.quadraticCurveTo(middle.x + thickness * .52, middle.y, bottom.x + thickness, bottom.y);
    pen.quadraticCurveTo(bottom.x + thickness * .15, bottom.y + height * .007, bottom.x - thickness, bottom.y);
    pen.quadraticCurveTo(middle.x - thickness * .44, middle.y, width * .5, height * .011);
    pen.fill();

    for (let index = 0; index < 24; index++) {
      const x = bottom.x + (random() - .5) * thickness * 1.68;
      const y = bottom.y - random() * height * .09;
      pen.lineWidth = .35 + random() * .66;
      pen.strokeStyle = index % 3 ? '#171e18' : '#66523b';
      pen.beginPath();
      pen.moveTo(x, y);
      pen.lineTo(x + (random() - .51) * thickness * .23, y - (1 + random() * 6) * height / 500);
      pen.stroke();
    }
  }

  const spriteLengths = [7, 13, 23, 39, 65];
  const spriteScale = 3;
  const spritePadding = 5;
  const spriteHeight = 12;
  const spriteVariants = 3;
  const atlas = new Map();

  // The needles form a tapered brush texture aligned to each projected twig.
  // A handful of cached variations replaces drawing every needle every frame.
  function twigSprite(lengthBand, shade, variant) {
    const key = (lengthBand * needleColors.length + shade) * spriteVariants + variant;
    if (atlas.has(key)) return atlas.get(key);
    const length = spriteLengths[lengthBand];
    const canvas = document.createElement('canvas');
    canvas.width = (length + spritePadding * 2) * spriteScale;
    canvas.height = spriteHeight * spriteScale;
    const pen = canvas.getContext('2d');
    pen.setTransform(spriteScale, 0, 0, spriteScale, spritePadding * spriteScale, spriteHeight * spriteScale / 2);
    pen.lineCap = 'round';
    pen.lineWidth = .82;

    const random = seededRandom(1240 + 13 * lengthBand + variant);
    const count = Math.max(5, Math.min(17, Math.round(length * .35)));
    const needles = needleColors.map(() => []);
    for (let station = 0; station < count; station++) {
      const along = (station + .2 + random() * .55) / count;
      const spread = .24 + .76 * (1 - along) ** .48;
      for (let needle = 0; needle < 8; needle++) {
        const side = needle % 2 ? -1 : 1;
        const angle = side * (.43 + random() * 1.38);
        const x = along * length;
        const y = (random() - .5) * spread * 1.65;
        const ray = spread * (1.05 + random() * 3.25);
        const tone = Math.min(needleColors.length - 1, shade + Math.floor(along * 1.6 + random() ** 2 * 3.05));
        needles[tone].push(x, y, x + Math.cos(angle) * ray, y + Math.sin(angle) * ray);
      }
    }

    for (let tone = shade; tone < needles.length; tone++) {
      const lines = needles[tone];
      if (!lines.length) continue;
      pen.globalAlpha = tone > 6 ? .59 : .87;
      pen.strokeStyle = needleColors[tone];
      pen.beginPath();
      for (let line = 0; line < lines.length; line += 4) {
        pen.moveTo(lines[line], lines[line + 1]);
        pen.lineTo(lines[line + 2], lines[line + 3]);
      }
      pen.stroke();
    }
    atlas.set(key, canvas);
    return canvas;
  }

  function modelTwig(branch, angle, along, reach, slope, random) {
    const root = branchPoint(branch, along);
    const tip = {x: root.x + Math.cos(angle) * reach, y: root.y + slope, z: root.z + Math.sin(angle) * reach};
    const radialPosition = Math.hypot(root.x, root.z) / (.024 + branch.reach);
    const recess = Math.max(0, .7 - radialPosition) * 2.3;
    return {
      root, tip,
      baseShade: .05 + branch.hue * 2.24 - recess - root.y * .78 + random() * 1.35,
      spread: .71 + branch.age * .63 + reach * 3.15,
      variant: Math.floor(random() * spriteVariants),
    };
  }

  function modelBranches(renderBranches) {
    const random = seededRandom(80149);
    for (const branch of renderBranches) {
      branch.root = branchPoint(branch, 0);
      branch.middle = branchPoint(branch, .52);
      branch.tip = branchPoint(branch, 1);
      branch.twigs = [];
      const pairs = 6 + Math.round(branch.age * 10);
      for (let pair = 0; pair < pairs; pair++) {
        for (const side of [-1, 1]) {
          const along = .13 + (pair + random() * .67) / pairs * .86;
          const full = .0047 + branch.reach * (.15 + random() * .32);
          const reach = full * (.48 + .7 * Math.sin(along * Math.PI)) * (1 - along * .57);
          const angle = branch.angle + side * (.38 + random() * .77);
          const slope = (random() - .42) * (reach * .16 + .018);
          branch.twigs.push(modelTwig(branch, angle, along, reach, slope, random));
        }
      }
      branch.twigs.push(modelTwig(branch, branch.angle, .86, branch.reach * .165, -.008, random));
    }
  }

  function drawTwig(pen, twig, camera, density, detail) {
    const root = camera.project(twig.root);
    const tip = camera.project(twig.tip);
    const dx = tip.x - root.x;
    const dy = tip.y - root.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nominalLength = length / detail;
    const band = nominalLength < 9 ? 0 : nominalLength < 17 ? 1 : nominalLength < 30 ? 2 : nominalLength < 52 ? 3 : 4;
    const shade = Math.max(0, Math.min(6, Math.round(twig.baseShade + (1 - root.x / camera.width) * 2.32 + root.z * 1.56)));
    const texture = twigSprite(band, shade, twig.variant);
    const along = density / (spriteScale * spriteLengths[band]);
    const lateral = density * detail * twig.spread / (spriteScale * length);
    const a = dx * along;
    const b = dy * along;
    const c = -dy * lateral;
    const d = dx * lateral;
    const padding = spritePadding * spriteScale;
    const halfHeight = spriteHeight * spriteScale / 2;
    pen.setTransform(a, b, c, d, root.x * density - a * padding - c * halfHeight,
      root.y * density - b * padding - d * halfHeight);
    pen.drawImage(texture, 0, 0);
  }

  function drawBranch(pen, branch, depth, camera, density, detail) {
    const start = camera.project(branch.root);
    const middle = camera.project(branch.middle);
    const tip = camera.project(branch.tip);
    pen.setTransform(density, 0, 0, density, 0, 0);
    pen.globalAlpha = .78;
    pen.strokeStyle = depth < 0 ? '#17231b' : '#2b3326';
    pen.lineWidth = (.38 + branch.age * 1.24) * detail;
    pen.beginPath();
    pen.moveTo(start.x, start.y);
    pen.quadraticCurveTo(middle.x, middle.y, tip.x, tip.y);
    pen.stroke();
    pen.globalAlpha = 1;

    for (const twig of branch.twigs) drawTwig(pen, twig, camera, density, detail);
  }

  function drawLeader(pen, width, height, random) {
    // This single upright shoot meets the topper above the first whorl.
    const x = width * .5;
    const scale = height / 530;
    for (let index = 0; index < 135; index++) {
      const age = random();
      const y = height * (.013 + age * .071);
      const side = index % 2 ? 1 : -1;
      pen.lineWidth = Math.max(.42, .58 * scale);
      pen.strokeStyle = needleColors[3 + Math.floor(random() * 4)];
      pen.beginPath();
      pen.moveTo(x + side * age * .5 * scale, y);
      pen.lineTo(x + side * (1 + random() * 7 * age) * scale, y + (random() - .3) * 4 * scale);
      pen.stroke();
    }
  }

  function placeDecorations(branches, random) {
    const lights = [];
    const ornaments = [];
    for (const branch of branches) {
      if (branch.depth < -.015 && Math.abs(Math.cos(branch.angle)) < .8) continue;
      const along = .32 + random() * .57;
      const point = branchPoint(branch, along);
      if (random() < .82) {
        const color = random();
        lights.push({
          point,
          type: color < .49 ? 'gold' : color < .72 ? 'ice' : 'green',
          phase: random() * turn,
          size: .34 + random() * .66,
        });
      }
      if (branch.age > .28 && branch.depth > -.008 && along > .56 && random() < .19) {
        ornaments.push({point, size: .68 + random() * .51, red: random() < .69});
      }
    }
    return {lights, ornaments};
  }

  function placeRearOrnaments(branches) {
    const random = seededRandom(25_122);
    return branches.filter(branch => branch.age > .32 && branch.depth < -.038 && random() < .18)
      .map(branch => ({
        point: branchPoint(branch, .63 + random() * .29),
        size: .65 + random() * .48,
        red: random() < .67,
      }));
  }

  function projectLights(camera, lamps) {
    return lamps.map(({point, size, type, phase}) => {
      const {x, y, z} = camera.project(point);
      const visibility = Math.max(.06, Math.min(1, 1.25 + z * 13));
      return {x: x / camera.width, y: y / camera.height, size, type, phase, visibility};
    });
  }

  function drawOrnament(pen, ornament, camera) {
    const {size, red, point} = ornament;
    const tip = camera.project(point);
    const x = tip.x;
    const radius = size * camera.height * .0072 * (1 + tip.z * .18);
    const y = tip.y + radius * 2.2;
    pen.strokeStyle = '#b69a578c';
    pen.lineWidth = Math.max(.35, radius * .11);
    pen.beginPath();
    pen.moveTo(x + radius * .2, tip.y);
    pen.quadraticCurveTo(x - radius * .13, tip.y + radius * .62, x, y - radius);
    pen.stroke();

    const glass = pen.createRadialGradient(x - radius * .28, y - radius * .35, 0, x, y, radius);
    glass.addColorStop(0, red ? '#c77562' : '#e4bc75');
    glass.addColorStop(.38, red ? '#86352f' : '#b37936');
    glass.addColorStop(.81, red ? '#461d23' : '#6d492b');
    glass.addColorStop(1, red ? '#251c21' : '#352b21');
    pen.fillStyle = glass;
    pen.beginPath();
    pen.arc(x, y, radius, 0, turn);
    pen.fill();
    pen.fillStyle = '#d5b379';
    pen.fillRect(x - radius * .23, y - radius * 1.06, radius * .46, radius * .23);
  }

  const random = seededRandom(20251225);
  const tree = branchesForTree(random);
  const {lights: lamps, ornaments} = placeDecorations(tree, random);
  ornaments.push(...placeRearOrnaments(tree));
  const undergrowth = rearShoots(tree);
  modelBranches(tree);
  modelBranches(undergrowth);
  tree.push(...undergrowth);

  window.renderSpruce = (width, height, density = 1, yaw = 0, pitch = 0, moving = false, backingCanvas) => {
    const canvas = backingCanvas || document.createElement('canvas');
    const pixelWidth = Math.max(1, Math.round(width * density));
    const pixelHeight = Math.max(1, Math.round(height * density));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const pen = canvas.getContext('2d');
    pen.setTransform(1, 0, 0, 1, 0, 0);
    pen.clearRect(0, 0, pixelWidth, pixelHeight);
    pen.lineCap = 'round';
    pen.imageSmoothingQuality = moving ? 'low' : 'medium';

    const camera = makeCamera(width, height, yaw, pitch);
    const detail = Math.max(.52, height / 530);
    const layers = tree.map(branch => ({branch, depth: camera.depth(branch.tip) * .58}));
    for (const ornament of ornaments) layers.push({ornament, depth: camera.depth(ornament.point)});
    layers.sort((first, second) => first.depth - second.depth);
    const barkRandom = seededRandom(9714);
    let trunk = false;
    for (const layer of layers) {
      if (!trunk && layer.depth >= 0) {
        pen.setTransform(density, 0, 0, density, 0, 0);
        drawTrunk(pen, camera, barkRandom);
        drawLeader(pen, width, height, barkRandom);
        trunk = true;
      }
      if (layer.branch) {
        drawBranch(pen, layer.branch, layer.depth, camera, density, detail);
      } else {
        pen.setTransform(density, 0, 0, density, 0, 0);
        drawOrnament(pen, layer.ornament, camera);
      }
    }
    return {canvas, lights: projectLights(camera, lamps)};
  };
})();
