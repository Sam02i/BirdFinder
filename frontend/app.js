const content = document.getElementById('content');
const route = location.pathname.replace(/\/$/, '') || '/';
document.title = `${({'/':'Home','/bird':'Photo ID','/audio':'Sound ID','/about':'About','/collection':'Collection'})[route] || 'Bird ID'} · BirdFinder`;
document.querySelectorAll('nav a').forEach(link => {
  if (link.getAttribute('href') === route) link.setAttribute('aria-current', 'page');
});
const escapeText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function uploadForm(kind) {
  const photo = kind === 'image';
  return `<form id="identify-form" data-kind="${kind}">
    <div class="panel-heading"><h2>${photo ? 'Upload a photograph' : 'Upload a recording'}</h2></div>
    <label class="dropzone" for="file">
      <strong>${photo ? 'Choose a bird photograph' : 'Choose a bird call'}</strong>
      <span class="dropzone-note">Drag and drop, or browse your files</span>
      <span class="browse-chip">${photo ? 'Browse photos' : 'Browse recordings'}</span>
      <input class="file-input" id="file" name="file" type="file" accept="${photo ? 'image/jpeg,image/png,image/webp' : '.mp3,audio/mpeg,audio/mp3,.wav,audio/wav,.flac,audio/flac,.ogg,audio/ogg,.m4a,audio/mp4'}" aria-label="${photo ? 'Choose a bird photograph' : 'Choose a bird call'}" required>
    </label>
    <p id="file-name" class="file-name" hidden></p>
    <p class="hint">${photo ? 'JPEG, PNG or WebP · up to 25 MB' : 'MP3, WAV, FLAC, OGG or M4A · up to 25 MB<br>3 seconds minimum · first 30 seconds analyzed'}</p>
    <button class="primary" type="submit"><span>${photo ? 'Identify bird' : 'Identify call'}</span></button>
    <p class="upload-tip">${photo ? 'Use a sharp photo with one bird clearly visible.' : 'Use a recording with a distinct bird call and minimal background noise.'}</p>
    <p id="message" class="message" role="status" aria-live="polite"></p>
  </form>`;
}

function discoveryPage(kind) {
  const photo = kind === 'image';
  return `<section class="discovery-page">
    <div class="discovery-heading"><p class="eyebrow">${photo ? 'Visual identification' : 'Acoustic identification'}</p>
      <h1>${photo ? 'Photo identification' : 'Sound identification'}</h1>
      <p class="intro">${photo ? 'Upload a photograph to compare possible species.' : 'Upload a bird call to compare possible species.'}</p>
    </div>
    <div class="discovery-layout">
      <div class="preview-column">
        <figure class="nature-card">
          <div class="side-media">
            <img id="side-image" src="/static/${photo ? 'assets/garden-birds.jpeg' : 'species/Pycnonotus_cafer.jpg'}" alt="${photo ? 'Two blue tits perched among pink blossoms' : 'Red-vented bulbul perched on a branch'}">
            ${photo ? '' : '<div id="audio-preview" class="audio-preview" hidden><span id="audio-caption">Selected recording</span><audio id="preview" controls></audio></div>'}
          </div>
          <figcaption id="media-caption">${photo ? 'Sample photograph · replaced by your upload' : 'Sample species photograph'}</figcaption>
        </figure>
        <div id="results" class="results" aria-live="polite"></div>
      </div>
      <section class="identify-panel" aria-label="${photo ? 'Identify a bird photograph' : 'Identify a bird call'}">${uploadForm(kind)}</section>
    </div>
  </section>`;
}

async function connectForm() {
  const form = document.getElementById('identify-form');
  const fileInput = document.getElementById('file');
  const photo = form.dataset.kind === 'image';
  const sideImage = document.getElementById('side-image');
  const originalImage = sideImage.src;
  const originalAlt = sideImage.alt;
  const preview = photo ? sideImage : document.getElementById('preview');
  const audioPreview = document.getElementById('audio-preview');
  const caption = document.getElementById('media-caption');
  const message = document.getElementById('message');
  const results = document.getElementById('results');
  const button = form.querySelector('button');
  let previewURL;
  let ready = true;
  function say(text, error = false) {
    message.textContent = text;
    message.classList.toggle('error', error);
    message.setAttribute('role', error ? 'alert' : 'status');
  }
  fileInput.addEventListener('change', () => {
    if (previewURL) URL.revokeObjectURL(previewURL);
    results.replaceChildren();
    const filename = document.getElementById('file-name');
    filename.hidden = true;
    filename.textContent = '';
    if (!photo) { preview.pause(); preview.removeAttribute('src'); preview.load(); audioPreview.hidden = true; }
    sideImage.src = originalImage;
    sideImage.alt = originalAlt;
    sideImage.hidden = false;
    sideImage.classList.remove('uploaded');
    caption.textContent = photo ? 'Sample photograph · replaced by your upload' : 'Sample species photograph';
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      say('Choose a file smaller than 25 MB.', true);
      fileInput.value = '';
      return;
    }
    filename.textContent = file.name;
    filename.hidden = false;
    previewURL = URL.createObjectURL(file);
    preview.src = previewURL;
    if (photo) {
      sideImage.classList.add('uploaded');
      sideImage.alt = 'Uploaded bird photograph';
      caption.textContent = file.name;
    } else {
      sideImage.hidden = true;
      audioPreview.hidden = false;
      document.getElementById('audio-caption').textContent = file.name;
      caption.textContent = 'Selected recording';
    }
    if (ready) say('');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!fileInput.files[0] || !ready) return;
    button.disabled = true;
    form.classList.add('is-loading');
    form.setAttribute('aria-busy', 'true');
    button.querySelector('span').textContent = 'Identifying…';
    fileInput.disabled = true;
    results.replaceChildren();
    say('Analyzing recording…');
    if (form.dataset.kind === 'image') say('Analyzing photo…');
    const data = new FormData();
    data.append('file', fileInput.files[0]);
    try {
      const response = await fetch(`/api/predict/${form.dataset.kind}`, {method:'POST', body:data});
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Unable to identify this file. Please try again.');
      const predictions = [...result.predictions].sort((a, b) => b.score - a.score);
      const top = predictions[0];
      if (!top) throw new Error('No species match was returned. Please try another file.');
      results.innerHTML = `<article class="bird-summary">
        <div class="match-heading"><p class="eyebrow">Closest species match</p><span class="confidence-badge">${(top.score * 100).toFixed(1)}% confidence</span></div>
        <h2><strong>${escapeText(top.name)}</strong></h2>
        <p class="scientific-name">${escapeText(top.scientific_name)}</p>
        <div class="confidence-meter" role="meter" aria-label="Model confidence" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.max(0, Math.min(100, top.score * 100))}"><span style="width:${Math.max(0, Math.min(100, top.score * 100))}%"></span></div><dl class="bird-facts"><div><dt>Model confidence</dt><dd>${(top.score * 100).toFixed(1)}%</dd></div><div><dt>Identified from</dt><dd>${photo ? 'Photograph' : 'Bird call'}</dd></div></dl>
        <p class="results-note">Model confidence is a comparison score, not a confirmed identification.</p><a class="result-collection-link" href="/collection">Explore supported species ↗</a>
      </article>
      ${predictions.length > 1 ? `<details class="other-matches"><summary>Compare ${predictions.length - 1} other possible matches</summary>${predictions.slice(1).map(item => `<div class="result"><div class="result-line"><span>${escapeText(item.name)}</span><span>${(item.score * 100).toFixed(1)}%</span></div><small>${escapeText(item.scientific_name)}</small><div class="bar" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, item.score * 100))}%"></span></div></div>`).join('')}</details>` : ''}`;
      say('Analysis complete. Review the ranked matches below the preview.');
      if (!photo) {
        // Audio has no photograph; show the matching species from the collection.
        try {
          const catalogResponse = await fetch('/api/species');
          if (catalogResponse.ok) {
            const birds = await catalogResponse.json();
            const bird = birds.find(item => item.species === top.species);
            if (bird?.image) {
              sideImage.src = bird.image;
              sideImage.alt = top.name;
              sideImage.hidden = false;
              caption.textContent = `${top.name} / Collection photograph`;
            }
          }
        } catch { /* The prediction and audio player still work without a catalog image. */ }
      }
    } catch (error) {
      say(error.message === 'Failed to fetch' ? 'Cannot reach the server. Please try again.' : error.message, true);
    } finally {
      form.classList.remove('is-loading');
      form.removeAttribute('aria-busy');
      button.querySelector('span').textContent = photo ? 'Identify bird' : 'Identify call';
      button.disabled = !ready;
      fileInput.disabled = false;
    }
  });
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('Status unavailable');
    const info = await response.json();
    const model = info[form.dataset.kind === 'image' ? 'vision' : 'audio'];
    ready = model.available;
    if (!ready) { button.disabled = true; say('Identification is temporarily unavailable. Please try again later.', true); }
  } catch {
    say('Unable to connect. Check your connection and reload the page.', true);
  }
}

async function collection() {
  content.innerHTML = `<section class="page collection-page"><div class="catalog-head"><div><p class="eyebrow">The collection</p><h1>Species collection</h1><p class="intro" id="catalog-summary">Loading species…</p><a class="photo-credit" href="/static/photo-credits.html">Photo credits</a></div><input id="search" class="search" type="search" placeholder="Search birds" aria-label="Search species"></div><div id="catalog" class="catalog" aria-busy="true">${Array.from({length:8}, () => '<div class="catalog-skeleton" aria-hidden="true"><div></div><span></span><span></span></div>').join('')}</div><div id="empty" class="empty" role="status" hidden></div></section>`;
  try {
    const response = await fetch('/api/species');
    if (!response.ok) throw new Error('Could not load the collection. Please try again.');
    const birds = await response.json();
    document.getElementById('catalog').removeAttribute('aria-busy');
    document.getElementById('catalog-summary').textContent = `${birds.length} species. Labels indicate available identification methods.`;
    function render() {
      const query = document.getElementById('search').value.toLowerCase().trim();
      const filtered = birds.filter(bird => `${bird.name} ${bird.scientific_name}`.toLowerCase().includes(query));
      document.getElementById('catalog').innerHTML = filtered.map(bird => `<article class="bird-card">
        ${bird.image ? `<img src="${escapeText(bird.image + '?v=review13')}" alt="${escapeText(bird.name)}" loading="lazy">` : '<div class="photo-placeholder">Photograph unavailable</div>'}
        <div class="card-content"><h2>${escapeText(bird.name)}</h2><p><i>${escapeText(bird.scientific_name)}</i></p>${bird.photo?'<span class="tag">Photo</span>':''}${bird.audio?'<span class="tag">Audio</span>':''}</div></article>`).join('');
      const empty = document.getElementById('empty');
      empty.hidden = filtered.length > 0;
      empty.innerHTML = '<h2>No matching birds</h2><p>Try a common or scientific name, or return to the full collection.</p><button class="state-action" type="button">Clear search</button>';
      empty.querySelector('button').onclick = () => { document.getElementById('search').value = ''; render(); document.getElementById('search').focus(); };
      document.querySelectorAll('#catalog img').forEach(image => {
        image.addEventListener('error', () => {
          const fallback = document.createElement('div');
          fallback.className = 'photo-placeholder';
          fallback.textContent = 'Photograph unavailable';
          image.replaceWith(fallback);
        }, {once: true});
      });
    }
    document.getElementById('search').addEventListener('input', render);
    render();
  } catch (error) {
    document.getElementById('catalog-summary').textContent = 'The collection is temporarily unavailable.';
    const catalog = document.getElementById('catalog');
    catalog.replaceChildren();
    catalog.removeAttribute('aria-busy');
    const empty = document.getElementById('empty');
    empty.hidden = false;
    empty.innerHTML = '<h2>Unable to load the birds</h2><p>Check your connection and try again.</p><button class="state-action" type="button">Try again</button>';
    empty.querySelector('button').onclick = collection;
  }
}

if (route === '/') {
  document.body.classList.add('homepage');
  content.innerHTML = `<section class="mosaic-opening" aria-labelledby="mosaic-title">
      <div class="mosaic-canvas">
        <div id="mosaic" tabindex="0" role="group" aria-label="Interactive bird mosaic. Move over tiles or tap to flip them. Press Enter to reveal the bird, Escape to reset."></div>
        <div class="mosaic-intro"><p class="eyebrow">BirdFinder / A closer look</p><h1 id="mosaic-title">Look a little<br> <em>closer.</em></h1><p>A glimpse. A call. A bird to discover.</p></div>
      </div>
      <div class="mosaic-caption"><p>Move across the tiles to uncover the bird.<span> On touch screens, tap a tile.</span></p><div><button type="button" id="mosaic-reveal">Reveal bird</button><button type="button" id="mosaic-reset">Start again</button></div></div>
    </section>    <section class="home-explore" id="explore">
      <div class="section-heading"><p class="eyebrow">Identification</p><h2>Which bird<br><em>was that?</em></h2><p>Start with a photo you took or a call you recorded. Find possible matches for your sighting.</p></div>
      <div class="feature-grid">
        <a class="feature-card photo-feature" href="/bird"><div class="feature-image"><img src="/static/assets/garden-birds.jpeg" alt="Two blue tits among pink blossoms" loading="lazy"><span class="image-label">Photograph</span></div><div class="feature-copy"><h3>A bird you saw</h3><p>Upload a clear photo to see possible species. A visible beak, wings and plumage help narrow the match.</p><span class="home-link-action">Upload a photo</span></div></a>
        <a class="feature-card sound-feature" href="/audio"><div class="feature-image"><img src="/static/species/Pycnonotus_cafer.jpg" alt="Red-vented bulbul perched on a branch" loading="lazy"><span class="image-label">Bird call</span></div><div class="feature-copy"><h3>A bird you heard</h3><p>Upload a bird call to explore possible matches. Choose a clip with little wind or background noise.</p><span class="home-link-action">Upload a recording</span></div></a>
      </div>
    </section>
    <footer class="home-ending" aria-label="Explore BirdFinder">
      <div class="ending-brand"><a href="/" class="ending-wordmark">BirdFinder<span>.</span></a><p>A name for the bird that caught your attention.</p></div>
      <nav aria-label="Explore"><a href="/bird">Photo ID</a><a href="/audio">Sound ID</a><a href="/collection">Collection</a><a href="/about">About BirdFinder</a></nav>
    </footer>`;
  const mosaicScript = document.createElement('script');
  mosaicScript.src = '/static/mosaic.js?v=edges14';
  document.body.appendChild(mosaicScript);
} else if (route === '/bird' || route === '/audio') {
  content.innerHTML = discoveryPage(route === '/bird' ? 'image' : 'audio');
  connectForm();
} else if (route === '/collection') {
  collection();
} else {
  content.innerHTML = `<section class="page about-page"><div class="discovery-heading"><p class="eyebrow">About</p><h1>About BirdFinder</h1><p class="intro">Compare bird photos and recordings with supported species.</p></div><div class="about-layout"><figure class="nature-card"><img src="/static/species/Passer_domesticus.jpg" alt="House sparrow among leafy branches"><figcaption>House sparrow · Passer domesticus</figcaption></figure><div class="about-sections"><section><h2>Photo and audio identification</h2><p>Photo identification compares visible features. Sound identification compares patterns in a recording. Results show up to five possible species, ranked by model confidence.</p></section><section><h2>Supported species and accuracy</h2><p>Identification is limited to the species listed in the collection. Blurred photos, overlapping calls and background noise can affect results. Birds outside the collection may still receive a high-scoring match. Treat results as suggestions, not confirmed identifications.</p></section><section><h2>Your uploads</h2><p>Photos are processed in memory. Recordings are held temporarily and removed after analysis. Uploads are not added to the training data or saved to a personal collection.</p></section><a href="/collection">View supported species</a> · <a href="/static/photo-credits.html">Photo credits</a></div></div></section>`;
}
