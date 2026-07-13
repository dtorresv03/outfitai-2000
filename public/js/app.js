/* ============================================
   OutfitAI 2000 - Frontend JavaScript
   ============================================ */

// Estado global
const state = {
  clothesFile: null,
  personFile: null,
  clothesBase64: null,
  personBase64: null,
  isGenerating: false,
};

// ---- Inicialización ----
document.addEventListener('DOMContentLoaded', () => {
  initStars();
  initClock();
  initVisitorCounter();
});

// Generar estrellas de fondo animadas
function initStars() {
  const container = document.getElementById('starsBg');
  for (let i = 0; i < 80; i++) {
    const star = document.createElement('div');
    star.style.cssText = `
      position: absolute;
      width: ${Math.random() * 3 + 0.5}px;
      height: ${Math.random() * 3 + 0.5}px;
      background: ${['#fff', '#ff66cc', '#00ffff', '#cc66ff', '#ffff00'][Math.floor(Math.random() * 5)]};
      border-radius: 50%;
      top: ${Math.random() * 100}%;
      left: ${Math.random() * 100}%;
      animation: twinkle ${Math.random() * 3 + 1}s ${Math.random() * 3}s infinite alternate;
      box-shadow: 0 0 ${Math.random() * 6 + 2}px currentColor;
    `;
    container.appendChild(star);
  }
}

// Reloj en tiempo real
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

// Contador de visitas (simulado + localStorage)
function initVisitorCounter() {
  let count = parseInt(localStorage.getItem('outfitai_visits') || '42069');
  count += Math.floor(Math.random() * 3) + 1;
  localStorage.setItem('outfitai_visits', count);
  document.getElementById('visitorCount').textContent = String(count).padStart(6, '0');
}

// ---- Navegación ----
function scrollToApp() {
  document.getElementById('appSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showInfo() {
  document.getElementById('infoModal').classList.add('active');
}

function closeInfo() {
  document.getElementById('infoModal').classList.remove('active');
}

function closeError() {
  document.getElementById('errorSection').style.display = 'none';
}

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
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    processFile(file, type);
  } else {
    showError('Solo se aceptan archivos de imagen (JPG, PNG, GIF, WebP)');
  }
}

function handleFileSelect(e, type) {
  const file = e.target.files[0];
  if (file) processFile(file, type);
}

// Procesar archivo de imagen
function processFile(file, type) {
  if (file.size > 10 * 1024 * 1024) {
    showError('La imagen es demasiado grande. Máximo 10MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;

    if (type === 'clothes') {
      state.clothesFile = file;
      state.clothesBase64 = base64;
      showPreview('clothes', base64);
    } else {
      state.personFile = file;
      state.personBase64 = base64;
      showPreview('person', base64);
    }

    checkGenerateReady();
  };
  reader.readAsDataURL(file);
}

// Mostrar preview de imagen
function showPreview(type, base64) {
  const dropZone = document.getElementById(`${type}DropZone`);
  const preview = document.getElementById(`${type}Preview`);
  const img = document.getElementById(`${type}Img`);

  dropZone.style.display = 'none';
  img.src = base64;
  preview.style.display = 'block';
}

// Quitar imagen
function removeImage(type) {
  const dropZone = document.getElementById(`${type}DropZone`);
  const preview = document.getElementById(`${type}Preview`);
  const input = document.getElementById(`${type}Input`);

  if (type === 'clothes') {
    state.clothesFile = null;
    state.clothesBase64 = null;
    // Ocultar detected items también
    document.getElementById('clothesDetected').style.display = 'none';
    document.getElementById('itemsTags').innerHTML = '';
  } else {
    state.personFile = null;
    state.personBase64 = null;
  }

  preview.style.display = 'none';
  dropZone.style.display = 'block';
  input.value = '';

  checkGenerateReady();
}

// Verificar si se puede generar
function checkGenerateReady() {
  const btn = document.getElementById('generateBtn');
  const hint = document.getElementById('generateHint');
  const ready = state.clothesBase64 && state.personBase64;

  btn.disabled = !ready;

  if (state.clothesBase64 && !state.personBase64) {
    hint.textContent = '📸 Ahora sube tu foto de cuerpo completo';
    hint.style.color = '#ffdd00';
  } else if (!state.clothesBase64 && state.personBase64) {
    hint.textContent = '👗 Ahora sube la foto de tus prendas';
    hint.style.color = '#ffdd00';
  } else if (ready) {
    hint.textContent = '¡Todo listo! Haz clic en el botón para generar ✨';
    hint.style.color = '#00ff88';
  } else {
    hint.textContent = 'Sube ambas fotos para activar la magia ✨';
    hint.style.color = '#00ffff';
  }
}

// ---- Generación de Outfits ----
async function generateOutfits() {
  if (state.isGenerating || !state.clothesBase64 || !state.personBase64) return;

  state.isGenerating = true;

  // Ocultar resultados anteriores y errores
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('errorSection').style.display = 'none';

  // Mostrar loading
  showLoading();

  try {
    const response = await fetch('/api/generate-outfits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clothesImage: state.clothesBase64,
        personImage: state.personBase64,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Error del servidor');
    }

    const data = await response.json();

    hideLoading();

    if (data.detectedItems && data.detectedItems.length > 0) {
      showDetectedItems(data.detectedItems);
    }

    if (data.outfits && data.outfits.length > 0) {
      showResults(data.outfits);
    } else {
      throw new Error('No se pudieron generar outfits. Intenta con fotos más claras.');
    }

  } catch (err) {
    hideLoading();
    showError(err.message || 'Error inesperado. Por favor intenta de nuevo.');
    console.error('Error:', err);
  } finally {
    state.isGenerating = false;
  }
}

// Loading steps
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
  }, 1500);
}

function hideLoading() {
  clearInterval(loadingInterval);
  document.getElementById('progressBar').style.width = '100%';
  setTimeout(() => {
    document.getElementById('loadingSection').style.display = 'none';
    document.getElementById('progressBar').style.width = '0%';
  }, 300);
}

// Mostrar prendas detectadas
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

// Mostrar resultados
function showResults(outfits) {
  const section = document.getElementById('resultsSection');
  const grid = document.getElementById('outfitsGrid');

  grid.innerHTML = '';

  const vibes = ['💅 Casual Chic', '🔥 Power Look', '🌸 Soft Girl', '✨ Y2K Vibes', '🖤 Dark Mode', '🌈 Colorful'];
  const ratingEmojis = ['⭐⭐⭐⭐⭐', '⭐⭐⭐⭐✨', '✨✨✨✨✨', '💎💎💎💎💎', '🔥🔥🔥🔥🔥'];
  const pieceIcons = {
    'camiseta': '👕', 'camisa': '👔', 'top': '🎽', 'blusa': '👗',
    'pantalón': '👖', 'pantalones': '👖', 'jeans': '👖', 'shorts': '🩳',
    'falda': '👗', 'vestido': '👗', 'chaqueta': '🧥', 'abrigo': '🧥',
    'zapatos': '👟', 'zapatillas': '👟', 'botas': '👢', 'tacones': '👠',
    'bolso': '👜', 'accesorios': '💍', 'cinturón': '⌚', 'gorra': '🧢',
    'suéter': '🧶', 'jersey': '🧶', 'hoodie': '🧥', 'chaleco': '🦺',
  };

  outfits.forEach((outfit, index) => {
    const card = document.createElement('div');
    card.className = 'outfit-card';

    const vibe = vibes[index % vibes.length];
    const rating = ratingEmojis[index % ratingEmojis.length];

    const piecesHTML = (outfit.pieces || []).map(piece => {
      const pieceLower = piece.toLowerCase();
      let icon = '✨';
      for (const [key, val] of Object.entries(pieceIcons)) {
        if (pieceLower.includes(key)) { icon = val; break; }
      }
      return `
        <div class="outfit-piece">
          <span class="piece-icon">${icon}</span>
          <span>${piece}</span>
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="outfit-card-header">
        <span class="outfit-number">LOOK #${String(index + 1).padStart(2, '0')}</span>
        <span class="outfit-vibe">${vibe}</span>
      </div>
      <div class="outfit-card-body">
        <div class="outfit-name">${outfit.name || `Outfit ${index + 1}`}</div>
        <div class="outfit-pieces">${piecesHTML}</div>
        ${outfit.tip ? `
          <div class="outfit-tip">
            <div class="tip-label">💡 TIP DE ESTILO:</div>
            <div class="tip-text">${outfit.tip}</div>
          </div>
        ` : ''}
        <div class="outfit-rating">${rating}</div>
      </div>
    `;

    grid.appendChild(card);
  });

  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Mostrar error
function showError(message) {
  document.getElementById('errorMsg').textContent = message;
  document.getElementById('errorSection').style.display = 'block';
  document.getElementById('errorSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Resetear todo
function resetAll() {
  removeImage('clothes');
  removeImage('person');
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('errorSection').style.display = 'none';
  document.getElementById('loadingSection').style.display = 'none';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}
