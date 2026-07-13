/**
 * OutfitAI 2000 - Vercel Serverless Function
 * Esta funcion se ejecuta en la nube cuando el usuario pide generar outfits
 */

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const { clothesImage, personImage } = req.body;

  if (!clothesImage || !personImage) {
    return res.status(400).json({
      error: 'Se requieren ambas imagenes: prendas y foto personal.',
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'API key de OpenAI no configurada.',
    });
  }

  try {
    // Paso 1: Detectar prendas
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

Responde SOLAMENTE con un JSON valido con este formato exacto:
{"items": ["nombre prenda 1", "nombre prenda 2"]}

Se especifico: incluye color, tipo y material si es visible.
Ejemplos: "camiseta blanca de algodon", "jeans azul oscuro", "chaqueta de cuero negra"

Si no ves prendas claramente, devuelve: {"items": ["prenda no identificada"]}`,
            },
            {
              type: 'image_url',
              image_url: { url: clothesImage, detail: 'high' },
            },
          ],
        },
      ],
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    let detectedItems = [];
    try {
      const parsed = JSON.parse(detectionResponse.choices[0].message.content);
      detectedItems = parsed.items || [];
    } catch {
      detectedItems = ['prendas detectadas'];
    }

    // Paso 2: Generar combinaciones
    const outfitResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Eres un estilista de moda profesional.

Prendas disponibles:
${detectedItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

Mirando la foto de la persona y las prendas, crea 5 combinaciones de outfits completos y creativos usando SOLO las prendas de la lista.

Responde SOLAMENTE con un JSON valido con este formato:
{
  "outfits": [
    {
      "name": "Nombre creativo del outfit en espanol",
      "pieces": ["prenda exacta de la lista", "otra prenda"],
      "tip": "Consejo de estilo especifico para lucir mejor este look"
    }
  ]
}

Reglas:
- Nombres creativos (ej: "Reina Urbana", "Vibes de Verano", "Poder Total")
- Las prendas en pieces deben ser de la lista
- Tips concretos y utiles
- Crea 5 outfits con estilos variados (casual, elegante, sport, bohemio, etc.)
- Considera coherencia de colores`,
            },
            {
              type: 'image_url',
              image_url: { url: personImage, detail: 'low' },
            },
            {
              type: 'image_url',
              image_url: { url: clothesImage, detail: 'high' },
            },
          ],
        },
      ],
      max_tokens: 2000,
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
      throw new Error('La IA no pudo generar outfits. Intenta con fotos mas claras.');
    }

    return res.json({ success: true, detectedItems, outfits });

  } catch (err) {
    console.error('Error:', err);

    if (err.status === 401) return res.status(401).json({ error: 'API key invalida.' });
    if (err.status === 429) return res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento.' });
    if (err.status === 400) return res.status(400).json({ error: 'Imagen no valida. Intenta con otra foto.' });

    return res.status(500).json({ error: err.message || 'Error interno. Intenta de nuevo.' });
  }
};
