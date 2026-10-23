(() => {
  'use strict';
  const board = document.getElementById('mosaic');
  if (!board) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let waveTimers = [];
  function cancelWave() { waveTimers.forEach(clearTimeout); waveTimers = []; }
  // Grout centerlines measured in the original 1410 × 864 tile image.
  const xEdges = [0,56,109,170,229,288,346,403,459,514,569,624,678,728,787,841,897,953,1010,1062,1123,1181,1239,1297,1354,1410];
  const yEdges = [0,65,125,184,244,302,360,418,477,534,592,652,712,774,836,864];
  const cols = xEdges.length - 1, rows = yEdges.length - 1, tiles = [];
  let scale = 1, offsetX = 0, offsetY = 0;
  let hitEdges = [...xEdges];
  let lastTile = null, direction = 1;
  let width = 0, height = 0, previous = null, frame = 0, point = null;
  const fragment = document.createDocumentFragment();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.innerHTML = '<div class="flipper"><div class="face front"></div><div class="edge"></div><div class="face back"></div></div>';
      tile.setAttribute('aria-hidden', 'true');
      tile.addEventListener('transitionend', () => tile.classList.remove('moving'));
      fragment.appendChild(tile);
      tiles.push({ element: tile, x, y, revealed: false });
    }
  }
  board.appendChild(fragment);
  function layout() {
    if (width === board.clientWidth && height === board.clientHeight) return;
    width = board.clientWidth;
    height = board.clientHeight;
    const oldExtensions = new Map(tiles.filter(tile => tile.extension).map(tile => [tile.key, tile.revealed]));
    tiles.splice(cols * rows).forEach(tile => tile.element.remove());
    // Keep both images aligned, preserving their proportions like object-fit: cover.
    scale = (matchMedia('(max-width: 700px)').matches ? Math.max : Math.min)(width / 1410, height / 864);
    const imageWidth = 1410 * scale, imageHeight = 864 * scale;
    offsetX = (width - imageWidth) / 2; offsetY = (height - imageHeight) / 2;
    tiles.forEach(({ element, x, y }) => {
      const left = offsetX + xEdges[x] * scale, top = offsetY + yEdges[y] * scale;
      Object.assign(element.style, { left: `${left}px`, top: `${top}px`, width: `${(xEdges[x + 1] - xEdges[x]) * scale + .2}px`, height: `${(yEdges[y + 1] - yEdges[y]) * scale + .2}px` });
      element.querySelectorAll('.face').forEach(face => {
        face.style.backgroundSize = `${imageWidth}px ${imageHeight}px`;
        face.style.backgroundPosition = `${offsetX - left}px ${offsetY - top}px`;
      });
    });
    // Continue the grout lines into both margins using real tiles from the plain mosaic.
    hitEdges = [...xEdges];
    function extend(side) {
      let edge = side < 0 ? 0 : 1410;
      let column = side < 0 ? cols - 1 : 0;
      let index = 0;
      while (side < 0 ? offsetX + edge * scale > 0 : offsetX + edge * scale < width) {
        const tileWidth = xEdges[column + 1] - xEdges[column];
        const start = side < 0 ? edge - tileWidth : edge;
        hitEdges.push(start, start + tileWidth);
        for (let y = 0; y < rows; y++) {
          const element = document.createElement('div');
          const key = `${side}:${index}:${y}`;
          const revealed = oldExtensions.get(key) ?? tiles[y * cols].revealed;
          element.className = `tile extension${revealed ? ' revealed' : ''}`;
          element.setAttribute('aria-hidden', 'true');
          element.innerHTML = '<div class="flipper"><div class="face front"></div><div class="face back"></div></div>';
          Object.assign(element.style, {left: `${offsetX + start * scale}px`, top: `${offsetY + yEdges[y] * scale}px`, width: `${tileWidth * scale + .2}px`, height: `${(yEdges[y + 1] - yEdges[y]) * scale + .2}px`});
          element.querySelectorAll('.face').forEach(face => {
            face.style.backgroundSize = `${imageWidth}px ${imageHeight}px`;
            face.style.backgroundPosition = `${-xEdges[column] * scale}px ${-yEdges[y] * scale}px`;
          });
          element.addEventListener('transitionend', () => element.classList.remove('moving'));
          board.appendChild(element);
          tiles.push({element, y, key, revealed, extension: true, start, end: start + tileWidth});
        }
        edge += side * tileWidth;
        column = (column + side + cols) % cols;
        index++;
      }
    }
    extend(-1); extend(1);
    previous = null; lastTile = null;
  }
  function reveal(tile, value = true) {
    if (tile.revealed === value) return;
    tile.revealed = value;
    tile.element.classList.add('moving');
    tile.element.classList.toggle('revealed', value);
  }
  function brush(px, py) {
    const sx = (px - offsetX) / scale, sy = (py - offsetY) / scale;
    const x = xEdges.findIndex((edge, i) => i < cols && sx >= edge && sx < xEdges[i + 1]);
    const y = yEdges.findIndex((edge, i) => i < rows && sy >= edge && sy < yEdges[i + 1]);
    const tile = y < 0 ? null : x >= 0 ? tiles[y * cols + x] : tiles.find(tile => tile.extension && tile.y === y && sx >= tile.start && sx < tile.end);
    if (tile) {
      if (tile === lastTile) return;
      lastTile = tile;
      tile.element.style.setProperty('--flip-angle', `${direction * 180}deg`);
      reveal(tile, !tile.revealed);
    }
  }
  function paint() {
    frame = 0;
    if (!point) return;
    const from = previous || point;
    const dx = point.x - from.x, dy = point.y - from.y;
    if (dy) direction = dy > 0 ? 1 : -1;
    // Visit only cells crossed by the pointer, including fast diagonal drags.
    const cuts = [0, 1];
    if (dx) hitEdges.forEach(edge => {
      const t = (offsetX + edge * scale - from.x) / dx;
      if (t > 0 && t < 1) cuts.push(t);
    });
    if (dy) yEdges.forEach(edge => {
      const t = (offsetY + edge * scale - from.y) / dy;
      if (t > 0 && t < 1) cuts.push(t);
    });
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const t = (cuts[i - 1] + cuts[i]) / 2;
      brush(from.x + dx * t, from.y + dy * t);
    }
    brush(point.x, point.y);
    previous = point;
  }
  function move(event) {
    cancelWave();
    // Touch moves belong to native page scrolling; tapping still flips a tile.
    if (event.pointerType === 'touch' && event.type === 'pointermove') return;
    const rect = board.getBoundingClientRect();
    point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (!frame) frame = requestAnimationFrame(paint);
  }
  board.addEventListener('pointermove', move);
  board.addEventListener('pointerdown', event => { previous = null; lastTile = null; move(event); });
  board.addEventListener('pointerleave', () => { previous = null; lastTile = null; point = null; });
  board.addEventListener('pointercancel', () => { previous = null; lastTile = null; point = null; });
  function showAll(value) {
    cancelWave();
    previous = null; lastTile = null;
    for (let row = 0; row < rows; row++) {
      const flipRow = () => tiles.filter(tile => tile.y === row).forEach(tile => reveal(tile, value));
      if (reducedMotion) flipRow();
      else waveTimers.push(setTimeout(flipRow, row * 35));
    }
  }
  document.getElementById('mosaic-reveal').addEventListener('click', () => showAll(true));
  document.getElementById('mosaic-reset').addEventListener('click', () => showAll(false));
  board.addEventListener('keydown', event => {
    cancelWave();
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tiles.forEach(tile => reveal(tile)); }
    if (event.key === 'Escape') { tiles.forEach(tile => reveal(tile, false)); previous = null; }
  });
  new ResizeObserver(layout).observe(board);
  layout();
  if (reducedMotion) showAll(true);
  else {
    // One introductory ripple after both faces load; never bind animation to scrolling.
    Promise.all(['/static/assets/mosaic.png', '/static/assets/bird.png'].map(src => {
      const image = new Image(); image.src = src; return image.decode();
    })).then(() => {
      waveTimers.push(setTimeout(() => showAll(true), 900));
    }).catch(() => {});
  }
})();
