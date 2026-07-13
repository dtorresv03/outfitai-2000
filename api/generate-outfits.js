/**
 * OutfitAI 2000 - Vercel Serverless Function
 * Acepta multiples fotos de prendas + foto personal
 */

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  const { clothesImages, personImage } = req.body;

  // Soporte para una sola imagen o array
  const clothesArr = Array.isArray(clothesImages)
    ? clothesImages
    : clothesImages ? [clothesImages] : [];

  if (clothesArr.length === 0 || !personImage) {
    return res.status(400).json({ error: 'Se requieren las fotos de prendas y la foto personal.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'API key de OpenAI no configurada en Vercel.' });
  }

  try {
    // ---- Paso 1: Detectar prendas en todas las imagenes ----
    const clothesContent = [
      {
        type: 'text',
        text: `Analiza estas ${clothesArr.length} imagen(es) de prendas de ropa.
Identifica CADA prenda individual que puedas ver en todas las imagenes.

Responde SOLAMENTE con un JSON valido con este formato:
{"items": ["nombre prenda 1", "nombre prenda 2"]}

Se especifico con color, tipo y material si es visible.
Ejemplos: "camiseta blanca de algodon", "jeans azul oscuro", "chaqueta de cuero negra"`,
      },
      ...clothesArr.map(img => ({
        type: 'image_url',
        image_url: { url: img, detail: 'high' },
      })),
    ];

    const detectionResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: clothesContent }],
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    let detectedItems = [];
    try {
      const parsed = JSON.parse(detectionResponse.choices[0].message.content);
      detectedItems = parsed.items || [];
    } catch {
      detectedItems = ['prendas detectadas'];
    }

    // ---- Paso 2: Generar combinaciones de outfits ----
    const outfitContent = [
      {
        type: 'text',
        text: `Eres un estilista de moda profesional con mucha experiencia.

Prendas disponibles (identificadas de las fotos):
${detectedItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

Mirando la foto de la persona y las prendas, crea 6 combinaciones de outfits creativos usando SOLO las prendas de la lista.

Responde SOLAMENTE con un JSON valido:
{
  "outfits": [
    {
      "name": "Nombre creativo en espanol",
      "pieces": ["prenda exacta de la lista", "otra prenda"],
      "tip": "Consejo practico de estilo para este look"
    }
  ]
}

Reglas importantes:
- Nombres creativos y motivadores (ej: "Reina Urbana", "Vibes de Verano", "Chic Total")
- Las prendas en pieces DEBEN ser de la lista proporcionada
- Tips utiles y especificos
- Crea 6 outfits con estilos variados: casual, elegante, sport, bohemio, noche, trabajo
- Considera coherencia de colores y estilos
- Si hay pocas prendas, repite algunas en distintas combinaciones`,
      },
      {
        type: 'image_url',
        image_url: { url: personImage, detail: 'low' },
      },
      ...clothesArr.map(img => ({
        type: 'image_url',
        image_url: { url: img, detail: 'high' },
      })),
    ];

    const outfitResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: outfitContent }],
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    });

    let outfits = [];
    try {
      const parsed = JSON.parse(outfitResponse.choices[0].message.content);
      outfits = parsed.outfits || [];
    } catch {
      throw new Error('Error al procesar la respuesta de la IA');
    }

    if (outfits.length === 0) {
      throw new Error('No se pudieron generar outfits. Intenta con fotos mas claras.');
    }

    return res.status(200).json({ success: true, detectedItems, outfits });

  } catch (err) {
    console.error('Error OpenAI:', err);

    if (err.status === 401) return res.status(401).json({ error: 'API key de OpenAI invalida.' });
    if (err.status === 429) return res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.' });
    if (err.status === 400) return res.status(400).json({ error: 'Una imagen no es valida. Intenta con fotos mas claras.' });

    return res.status(500).json({ error: err.message || 'Error interno. Por favor intenta de nuevo.' });
  }
};
