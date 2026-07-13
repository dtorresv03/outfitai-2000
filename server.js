/**
 * OutfitAI 2000 - Backend Server
 * Node.js + Express + OpenAI Vision API
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: '25mb' })); // Imágenes en base64 pueden ser grandes
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- OpenAI Client ----
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---- Rutas ----

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'OutfitAI 2000 is running ✨' });
});

// Generar outfits
app.post('/api/generate-outfits', async (req, res) => {
  const { clothesImage, personImage } = req.body;

  if (!clothesImage || !personImage) {
    return res.status(400).json({
      error: 'Se requieren ambas imágenes: prendas y foto personal.',
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'API key de OpenAI no configurada. Agrega OPENAI_API_KEY en el archivo .env',
    });
  }

  try {
    // Paso 1: Detectar prendas en la imagen
    const detectionResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analiza esta imagen de prendas de ropa. 
              Identifica CADA prenda individual que puedas ver.
              
              Responde SOLAMENTE con un JSON válido con este formato exacto:
              {
                "items": ["nombre prenda 1", "nombre prenda 2", ...]
              }
              
              Sé específico: incluye color, tipo y material si es visible.
              Ejemplos: "camiseta blanca de algodón", "jeans azul oscuro", "chaqueta de cuero negra", "zapatillas blancas Nike"
              
              Si no ves prendas claramente, devuelve: {"items": ["prenda no identificada"]}`,
            },
            {
              type: 'image_url',
              image_url: {
                url: clothesImage,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    let detectedItems = [];
    try {
      const detectionData = JSON.parse(detectionResponse.choices[0].message.content);
      detectedItems = detectionData.items || [];
    } catch (e) {
      detectedItems = ['prendas detectadas'];
    }

    // Paso 2: Generar combinaciones de outfits
    const outfitPrompt = `Eres un estilista de moda profesional y experto.

Tienes estas prendas disponibles:
${detectedItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

Has visto la foto de la persona. Basándote en las prendas disponibles y el estilo de la persona, crea 5 combinaciones de outfits completos y creativos.

Para cada outfit, usa SOLO las prendas de la lista. Puedes combinar cualquier cantidad de ellas.

Responde SOLAMENTE con un JSON válido con este formato exacto:
{
  "outfits": [
    {
      "name": "Nombre creativo del outfit",
      "pieces": ["prenda exacta de la lista", "otra prenda", "..."],
      "tip": "Consejo de estilo específico para lucir mejor este look"
    }
  ]
}

Reglas:
- Sé creativo con los nombres (ej: "Urban Goddess", "Office Rebel", "Weekend Warrior")
- Las prendas en "pieces" deben ser de la lista proporcionada
- Los tips deben ser concretos y útiles (accesorios sugeridos, cómo llevarlo, etc.)
- Crea al menos 5 outfits distintos con diferentes estilos (casual, formal, sporty, boho, etc.)
- Considera la coherencia de colores y estilos`;

    const outfitResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: outfitPrompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: personImage,
                detail: 'low',
              },
            },
            {
              type: 'image_url',
              image_url: {
                url: clothesImage,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    let outfits = [];
    try {
      const outfitData = JSON.parse(outfitResponse.choices[0].message.content);
      outfits = outfitData.outfits || [];
    } catch (e) {
      throw new Error('Error al procesar la respuesta de la IA');
    }

    if (outfits.length === 0) {
      throw new Error('La IA no pudo generar outfits. Intenta con fotos más claras.');
    }

    return res.json({
      success: true,
      detectedItems,
      outfits,
      totalCombinations: outfits.length,
    });

  } catch (err) {
    console.error('Error al generar outfits:', err);

    // Errores específicos de OpenAI
    if (err.status === 401) {
      return res.status(401).json({ error: 'API key de OpenAI inválida. Verifica tu configuración.' });
    }
    if (err.status === 429) {
      return res.status(429).json({ error: 'Límite de solicitudes alcanzado. Espera un momento.' });
    }
    if (err.status === 400) {
      return res.status(400).json({ error: 'Imagen no válida o demasiado grande. Intenta con otra.' });
    }

    return res.status(500).json({
      error: err.message || 'Error interno del servidor. Por favor intenta de nuevo.',
    });
  }
});

// Catch-all: servir el frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- Iniciar servidor ----
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   ✨ OutfitAI 2000 - Server Running ✨  ║
╠════════════════════════════════════════╣
║  URL: http://localhost:${PORT}             ║
║  API: http://localhost:${PORT}/api/health  ║
╚════════════════════════════════════════╝
  `);

  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  ADVERTENCIA: OPENAI_API_KEY no configurada en .env');
    console.warn('   Crea un archivo .env con: OPENAI_API_KEY=tu_api_key');
  }
});
