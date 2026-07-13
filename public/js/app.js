/* ============================================
   OutfitAI 2000 - Frontend JavaScript
   ============================================ */

// Estado global
const state = {
  clothesFiles: [],       // array de { base64, name }
  personBase64: null,
  isGenerating: false,
};

// ---- Inicializacion ----
document.addEventListener('DOMContentLoaded', () => {
  initStars();
  initClock();
  initVisitorCounter();
});

function initStars() {
  const container = document.getElementById('starsBg');
  for (let i = 0; i < 80; i++) {
    const star = document.createElement('div');
    star.style.cssText = `
      position: absolute;
      width: ${Math.random() * 3 + 0.5}px;
      height: ${Math.random() * 3 + 0.5}px;
      background: ${['#fff','#ff66cc','#00ffff','#cc66ff','#ffff00'][Math.floor(Math.random()*5)]};
      border-radius: 50%;
      top: ${Math.random() * 100}%;
      left: ${Math.random() * 100}%;
      animation: twinkle ${Math.random() * 3 + 1}s ${Math.random() * 3}s infinite alternate;
      box-shadow: 0 0 ${Math.random() * 6 + 2}px currentColor;
    `;
    container.appendChild(star);
  }
}

function initClock() {
  const update = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('timeDisplay').textContent = `${h}:${m}`;
  };
  update();
  setInterval(update, 60000);
}

function initVisitorCounter() {
  let count = parseInt(localStorage.getItem('outfitai_visits') || '42069');
  count += Math.floor(Math.random() * 3) + 1;
  localStorage.setItem('outfitai_visits', count);
  document.getElementById('visitorCount').textContent = String(count).padStart(6, '0');
}

// ---- Navegacion ----
function scrollToApp() {
  document.getElementById('appSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function showInfo() { document.getElementById('infoModal').classList.add('active'); }
function closeInfo() { document.getElementById('infoModal').classList.remove('active'); }
function closeError() { document.getElementById('errorSection').style.display = 'none'; }

// ---- Drag & Drop ----
function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('dragover');
}
function handleDragLeave(e) {
  e.currentTarget.classList.remove('dragover');
}
function handleDrop(e, type) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (files.length === 0) { showError('Solo se aceptan archivos de imagen (JPG, PNG, etc.)'); return; }
  if (type === 'clothes') {
    files.forEach(f => processClothesFile(f));
  } else {
    processPersonFile(files[0]);
  }
}

function handleFileSelect(e, type) {
  const files = Array.from(e.target.files);
  if (type === 'clothes') {
    files.forEach(f => processClothesFile(f));
  } else {
    processPersonFile(files[0]);
  }
  e.target.value = ''; // reset para poder volver a seleccionar
}

// ---- Procesar fotos de PRENDAS (multiples) ----
function processClothesFile(file) {
  if (file.size > 10 * 1024 * 1024) { showError(`"${file.name}" es demasiado grande. Max 10MB.`); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    state.clothesFiles.push({ base64: e.target.result, name: file.name });
    renderClothesPreviews();
    checkGenerateReady();
  };
  reader.readAsDataURL(file);
}

function renderClothesPreviews() {
  const container = document.getElementById('clothesPreviews');
  const dropZone = document.getElementById('clothesDropZone');

  container.innerHTML = '';

  if (state.clothesFiles.length === 0) {
    dropZone.style.display = 'block';
    return;
  }

  // Ocultar dropzone cuando hay fotos, mostrar mini version para agregar mas
  dropZone.style.display = 'none';

  // Grid de previews
  const grid = document.createElement('div');
  grid.className = 'clothes-grid';

  state.clothesFiles.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'clothes-thumb';
    card.innerHTML = `
      <img src="${item.base64}" alt="prenda ${index+1}" class="thumb-img" />
      <button class="thumb-remove" onclick="removeClothesImage(${index})">✖</button>
    `;
    grid.appendChild(card);
  });

  // Boton para agregar mas
  const addBtn = document.createElement('div');
  addBtn.className = 'clothes-thumb clothes-add-btn';
  addBtn.innerHTML = `<span style="font-size:2rem">➕</span><span style="font-size:12px;font-family:'VT323',monospace">Agregar mas</span>`;
  addBtn.onclick = () => document.getElementById('clothesInput').click();
  grid.appendChild(addBtn);

  container.appendChild(grid);
}

function removeClothesImage(index) {
  state.clothesFiles.splice(index, 1);
  renderClothesPreviews();
  if (state.clothesFiles.length === 0) {
    document.getElementById('clothesDropZone').style.display = 'block';
    document.getElementById('clothesDetected').style.display = 'none';
    document.getElementById('itemsTags').innerHTML = '';
  }
  checkGenerateReady();
}

// ---- Procesar foto PERSONAL ----
function processPersonFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { showError('La imagen es demasiado grande. Max 10MB.'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    state.personBase64 = e.target.result;
    showPersonPreview(e.target.result);
    checkGenerateReady();
  };
  reader.readAsDataURL(file);
}

function showPersonPreview(base64) {
  document.getElementById('personDropZone').style.display = 'none';
  document.getElementById('personImg').src = base64;
  document.getElementById('personPreview').style.display = 'block';
}

function removeImage(type) {
  if (type === 'person') {
    state.personBase64 = null;
    document.getElementById('personPreview').style.display = 'none';
    document.getElementById('personDropZone').style.display = 'block';
    document.getElementById('personInput').value = '';
  }
  checkGenerateReady();
}

// ---- Check boton generar ----
function checkGenerateReady() {
  const btn = document.getElementById('generateBtn');
  const hint = document.getElementById('generateHint');
  const hasClothes = state.clothesFiles.length > 0;
  const hasPerson = !!state.personBase64;
  const ready = hasClothes && hasPerson;

  btn.disabled = !ready;

  if (hasClothes && !hasPerson) {
    hint.textContent = `📸 Ahora sube tu foto de cuerpo completo (tienes ${state.clothesFiles.length} foto(s) de prendas)`;
    hint.style.color = '#ffdd00';
  } else if (!hasClothes && hasPerson) {
    hint.textContent = '👗 Ahora sube fotos de tus prendas';
    hint.style.color = '#ffdd00';
  } else if (ready) {
    hint.textContent = `¡Todo listo! ${state.clothesFiles.length} foto(s) de prendas + tu foto ✨`;
    hint.style.color = '#00ff88';
  } else {
    hint.textContent = 'Sube ambas fotos para activar la magia ✨';
    hint.style.color = '#00ffff';
  }
}

// ---- Generacion de Outfits ----
async function generateOutfits() {
  if (state.isGenerating || state.clothesFiles.length === 0 || !state.personBase64) return;

  state.isGenerating = true;
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('errorSection').style.display = 'none';
  showLoading();

  try {
    const response = await fetch('/api/generate-outfits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clothesImages: state.clothesFiles.map(f => f.base64),
        personImage: state.personBase64,
      }),
    });

    // Leer el texto primero para diagnosticar si no es JSON
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('El servidor no respondio correctamente. Verifica que la API key de OpenAI este configurada en Vercel.');
    }

    if (!response.ok) {
      throw new Error(data.error || 'Error del servidor');
    }

    hideLoading();

    if (data.detectedItems && data.detectedItems.length > 0) {
      showDetectedItems(data.detectedItems);
    }

    if (data.outfits && data.outfits.length > 0) {
      showResults(data.outfits);
    } else {
      throw new Error('No se pudieron generar outfits. Intenta con fotos mas claras.');
    }

  } catch (err) {
    hideLoading();
    showError(err.message || 'Error inesperado. Por favor intenta de nuevo.');
    console.error('Error:', err);
  } finally {
    state.isGenerating = false;
  }
}

// ---- Loading ----
const loadingSteps = [
  { text: 'Escaneando tus prendas con IA...', progress: 15 },
  { text: 'Identificando colores y estilos...', progress: 35 },
  { text: 'Analizando tu figura y estilo...', progress: 55 },
  { text: 'Calculando combinaciones perfectas...', progress: 75 },
  { text: 'Generando recomendaciones de estilo...', progress: 90 },
  { text: '¡Casi listo! Preparando tus looks...', progress: 98 },
];

let loadingInterval = null;

function showLoading() {
  document.getElementById('loadingSection').style.display = 'block';
  document.getElementById('loadingSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
  let step = 0;
  const progressBar = document.getElementById('progressBar');
  const loadingText = document.getElementById('loadingText');
  loadingInterval = setInterval(() => {
    if (step < loadingSteps.length) {
      progressBar.style.width = `${loadingSteps[step].progress}%`;
      loadingText.textContent = loadingSteps[step].text;
      step++;
    }
  }, 2000);
}

function hideLoading() {
  clearInterval(loadingInterval);
  document.getElementById('progressBar').style.width = '100%';
  setTimeout(() => {
    document.getElementById('loadingSection').style.display = 'none';
    document.getElementById('progressBar').style.width = '0%';
  }, 300);
}

// ---- Mostrar prendas detectadas ----
function showDetectedItems(items) {
  const detected = document.getElementById('clothesDetected');
  const tags = document.getElementById('itemsTags');
  tags.innerHTML = '';
  items.forEach(item => {
    const tag = document.createElement('span');
    tag.className = 'item-tag';
    tag.textContent = item;
    tags.appendChild(tag);
  });
  detected.style.display = 'block';
}

// ---- Mostrar resultados ----
function showResults(outfits) {
  const section = document.getElementById('resultsSection');
  const grid = document.getElementById('outfitsGrid');
  grid.innerHTML = '';

  const vibes = ['💅 Casual Chic','🔥 Power Look','🌸 Soft Girl','✨ Y2K Vibes','🖤 Dark Mode','🌈 Colorful'];
  const ratings = ['⭐⭐⭐⭐⭐','⭐⭐⭐⭐✨','✨✨✨✨✨','💎💎💎💎💎','🔥🔥🔥🔥🔥'];
  const pieceIcons = {
    'camiseta':'👕','camisa':'👔','top':'🎽','blusa':'👗',
    'pantalón':'👖','pantalones':'👖','jeans':'👖','shorts':'🩳',
    'falda':'👗','vestido':'👗','chaqueta':'🧥','abrigo':'🧥',
    'zapatos':'👟','zapatillas':'👟','botas':'👢','tacones':'👠',
    'bolso':'👜','accesorios':'💍','cinturón':'⌚','gorra':'🧢',
    'suéter':'🧶','jersey':'🧶','hoodie':'🧥','chaleco':'🦺',
  };

  outfits.forEach((outfit, index) => {
    const card = document.createElement('div');
    card.className = 'outfit-card';

    const piecesHTML = (outfit.pieces || []).map(piece => {
      const lower = piece.toLowerCase();
      let icon = '✨';
      for (const [key, val] of Object.entries(pieceIcons)) {
        if (lower.includes(key)) { icon = val; break; }
      }
      return `<div class="outfit-piece"><span class="piece-icon">${icon}</span><span>${piece}</span></div>`;
    }).join('');

    card.innerHTML = `
      <div class="outfit-card-header">
        <span class="outfit-number">LOOK #${String(index+1).padStart(2,'0')}</span>
        <span class="outfit-vibe">${vibes[index % vibes.length]}</span>
      </div>
      <div class="outfit-card-body">
        <div class="outfit-name">${outfit.name || `Outfit ${index+1}`}</div>
        <div class="outfit-pieces">${piecesHTML}</div>
        ${outfit.tip ? `
          <div class="outfit-tip">
            <div class="tip-label">💡 TIP DE ESTILO:</div>
            <div class="tip-text">${outfit.tip}</div>
          </div>` : ''}
        <div class="outfit-rating">${ratings[index % ratings.length]}</div>
      </div>
    `;
    grid.appendChild(card);
  });

  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- Error ----
function showError(message) {
  document.getElementById('errorMsg').textContent = message;
  document.getElementById('errorSection').style.display = 'block';
  document.getElementById('errorSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---- Reset ----
function resetAll() {
  state.clothesFiles = [];
  state.personBase64 = null;
  renderClothesPreviews();
  document.getElementById('clothesDropZone').style.display = 'block';
  document.getElementById('clothesDetected').style.display = 'none';
  document.getElementById('itemsTags').innerHTML = '';
  document.getElementById('personPreview').style.display = 'none';
  document.getElementById('personDropZone').style.display = 'block';
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('errorSection').style.display = 'none';
  document.getElementById('loadingSection').style.display = 'none';
  checkGenerateReady();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
