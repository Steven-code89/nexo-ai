// Netlify Function — proxy al API de Anthropic para el chatbot demo.
// Objetivo: nunca exponer la API key y limitar el abuso
// (origen permitido, tamaño de payload, rate-limit básico por IP).

const ALLOWED_ORIGINS = [
  process.env.URL,               // URL principal del sitio (la pone Netlify)
  process.env.DEPLOY_PRIME_URL,  // URL del deploy actual / branch
  'https://nnexoai.netlify.app',
  'http://localhost:8888',
  'http://localhost:3000'
].filter(Boolean);

const MAX_MESSAGES = 20;
const MAX_TOTAL_CHARS = 6000;

// Rate-limit en memoria. Netlify reutiliza instancias "calientes" un rato,
// así que esto frena ráfagas desde una misma IP. No es infalible, pero es
// gratis y suficiente para un chatbot demo.
const RATE_LIMIT = { windowMs: 60000, max: 15 };
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { count: 0, reset: now + RATE_LIMIT.windowMs };
  if (now > rec.reset) { rec.count = 0; rec.reset = now + RATE_LIMIT.windowMs; }
  rec.count++;
  hits.set(ip, rec);
  if (hits.size > 500) {
    for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  }
  return rec.count > RATE_LIMIT.max;
}

const SYSTEM = `Eres Nexo, el asistente virtual de Nexo AI, empresa de tecnología e IA para pequeños negocios en Costa Rica.

SERVICIOS:
- Páginas web profesionales (desde $350)
- Software a medida (cotización personalizada)
- Chatbot de IA 24/7 (desde $150 instalación + $49/mes)
- Contenido redes sociales con IA (desde $99/mes)
- Automatización con IA (desde $39/mes)
- Email y seguimiento (desde $39/mes + $120 de instalación)
- Flujos de trabajo personalizados (cotización)

PROCESO: llamada gratis de 30 min -> propuesta 48h -> configuración -> soporte continuo.

PERSONALIDAD: amigable, directo, respuestas cortas (máx 3-4 líneas). Español por defecto, inglés si el usuario escribe en inglés. Cuando hables del trabajo de Nexo AI usa la primera persona del plural ("nosotros", "nuestro equipo"), nunca "yo" ni el nombre de una persona. Si muestran interés, invita a agendar la llamada gratis. Eres la demostración en vivo del producto.`;

exports.handler = async function (event) {
  const origin = event.headers.origin || '';
  const referer = event.headers.referer || '';
  const allowed = ALLOWED_ORIGINS.find(
    (o) => origin === o || referer === o || referer.startsWith(o + '/')
  );

  const baseHeaders = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    ...(allowed ? { 'Access-Control-Allow-Origin': allowed, Vary: 'Origin' } : {})
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { ...baseHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: baseHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!allowed) {
    return { statusCode: 403, headers: baseHeaders, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    (event.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    'unknown';
  if (rateLimited(ip)) {
    return { statusCode: 429, headers: baseHeaders, body: JSON.stringify({ error: 'Demasiadas solicitudes. Esperá un momento.' }) };
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: 'Invalid messages' }) };
  }

  let total = 0;
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) {
      return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: 'Invalid message format' }) };
    }
    total += m.content.length;
  }
  if (total > MAX_TOTAL_CHARS) {
    return { statusCode: 413, headers: baseHeaders, body: JSON.stringify({ error: 'Conversación demasiado larga' }) };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: SYSTEM,
        messages: messages.map((m) => ({ role: m.role, content: m.content }))
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error', response.status, JSON.stringify(data));
      return { statusCode: 502, headers: baseHeaders, body: JSON.stringify({ error: 'El asistente no está disponible ahora.' }) };
    }

    return { statusCode: 200, headers: baseHeaders, body: JSON.stringify({ content: data.content }) };
  } catch (err) {
    console.error('chat function failed', err);
    return { statusCode: 502, headers: baseHeaders, body: JSON.stringify({ error: 'API call failed' }) };
  }
};
