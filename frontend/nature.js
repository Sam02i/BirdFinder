(() => {
  const layer = document.getElementById('nature-hotspots');
  const fact = document.getElementById('nature-fact');
  const mute = document.getElementById('nature-mute');
  const audio = new Audio('/static/assets/forest-ambience.mp3');
  audio.id = 'nature-audio';
  audio.hidden = true;
  layer.appendChild(audio);
  audio.preload = 'none';
  audio.volume = .45;
  let muted = false, visible = true, selection = 0;
  const facts = [
    ['Life in the shallows', 'Great egrets hunt in shallow water, looking for fish, frogs and other small aquatic animals.'],
    ['A patient hunter', 'A great egret may stand still or walk slowly before striking at prey with its long bill.'],
    ['More than fish', 'Great egrets also eat insects, amphibians and crustaceans. Wetlands offer a varied menu.']
  ];
  function stop() {
    selection++;
    audio.pause();
    audio.currentTime = 0;
  }
  async function discover(button, index) {
    layer.querySelectorAll('.discovered').forEach(el => el.classList.remove('discovered'));
    button.classList.add('discovered');
    const [title, description] = facts[index % facts.length];
    fact.innerHTML = `<p class="eyebrow">Egret facts</p><h2>${title}</h2><p>${description}</p><a class="fact-source" href="https://www.allaboutbirds.org/guide/Great_Egret/id" target="_blank" rel="noopener noreferrer">Source: Cornell Lab</a>`;
    if (muted || !visible || !audio.paused) return;
    const request = ++selection;
    try {
      await audio.play();
      if (request !== selection || muted || !visible) audio.pause();
    } catch {
      if (request === selection) fact.insertAdjacentHTML('beforeend', '<small>Unable to play the recording. Select a bird to retry.</small>');
    }
  }
  // Coordinates follow the uncropped photograph at all viewport sizes.
  const birds = [[7,9,11,12],[11,23,19,9],[16,44,18,8],[23,49,17,13],[41,41,18,10],[51,47,17,13],[68,55,11,10],[61,61,14,11]];
  birds.forEach((bounds, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'nature-hotspot bird';
    button.setAttribute('aria-label', `Select bird ${index + 1} for a fact and forest sounds`);
    const [x,y,w,h] = bounds;
    Object.assign(button.style, {left:`${x}%`,top:`${y}%`,width:`${w}%`,height:`${h}%`});
    button.addEventListener('click', () => discover(button, index));
    layer.appendChild(button);
  });
  mute.addEventListener('click', () => {
    muted = !muted;
    audio.muted = muted;
    if (muted) stop();
    mute.setAttribute('aria-pressed', String(muted));
    mute.querySelector('span').textContent = muted ? 'Sound off' : 'Sound on';
    mute.setAttribute('aria-label', muted ? 'Unmute forest sound' : 'Mute forest sound');
  });
  // No automatic restart when the visitor returns to the hero.
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .2;
    if (!visible) stop();
  }, {threshold: [0, .2], rootMargin: '-108px 0px 0px 0px'}).observe(document.querySelector('.wetland-hero'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
})();
