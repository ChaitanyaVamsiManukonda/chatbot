(async () => {
  // Test ingest and retrieval no-cost flow
  const ingest = require('./netlify/functions/ingest');
  const ai = require('./netlify/functions/ai-query');

  // Clear keys to enforce no-cost path
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  const docs = [
    { id: '1', title: 'Colors', text: 'Red blue and green are common colors. Red is warm.' },
    { id: '2', title: 'Fruits', text: 'Apples and oranges are fruits. Apples can be red or green.' }
  ];

  const ingestEvent = { httpMethod: 'POST', body: JSON.stringify({ docs }) };
  const ingestRes = await ingest.handler(ingestEvent, {});
  console.log('Ingest result:', ingestRes);

  const queryEvent = { httpMethod: 'POST', body: JSON.stringify({ api: 'openai', messages: [{ role: 'user', content: 'Tell me about red apples' }] }) };
  const queryRes = await ai.handler(queryEvent, {});
  console.log('Query result:', queryRes);
})();
