exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  console.log('Key found, length:', ANTHROPIC_KEY.length);

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const SYSTEM = `Eres Nexo, el asistente virtual de Nexo AI, empresa de tecnología e IA para pequeños negocios en Costa Rica.

SERVICIOS:
- Páginas web profesionales (desde $350)
- Software a medida (desde $500)
- Chatbot de IA 24/7 (desde $150 instalación + $49/mes)
- Contenido redes sociales con IA (desde $99/mes)
- Automatización de correos (desde $120 + $39/mes)
- Flujos de trabajo personalizados (cotización)

PLANES MENSUALES:
- Inicial $99/mes: 1 automatización, soporte correo
- Crecimiento $249/mes: 3 automatizaciones, chatbot, soporte prioritario
- Empresarial $449/mes: todo ilimitado, desarrollo web incluido

PROCESO: llamada gratis 20min → propuesta 48h → configuración → soporte continuo.

PERSONALIDAD: amigable, directo, respuestas cortas (máx 3-4 líneas). Español por defecto, inglés si el usuario escribe en inglés. Si muestran interés, invita a agendar la llamada gratis. Eres la demostración en vivo del producto.`;

  try {
    console.log('Calling Anthropic API...');
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
        messages: body.messages
      })
    });

    console.log('Anthropic status:', response.status);
    const data = await response.json();
    console.log('Anthropic response type:', data.type, 'error:', data.error);

    if (data.error) {
      console.error('Anthropic error:', JSON.stringify(data.error));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: [{ text: 'Error de API: ' + data.error.message }] })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch(err) {
    console.error('Fetch error:', err.message, err.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API call failed', detail: err.message })
    };
  }
};
