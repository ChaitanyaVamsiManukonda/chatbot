(async () => {
  // Test voice transcript training flow
  const ingest = require('./netlify/functions/ingest');
  const ai = require('./netlify/functions/ai-query');

  // Clear keys to enforce no-cost retrieval path
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  console.log('\n=== Voice Transcript Training Flow Test ===\n');

  // Step 1: Start with initial docs
  console.log('Step 1: Ingest initial documents');
  const initialDocs = [
    { id: '1', title: 'Python Basics', text: 'Python is a high-level programming language. It is easy to learn and powerful.' },
    { id: '2', title: 'JavaScript', text: 'JavaScript is the language of the web. It runs in browsers and on servers.' }
  ];

  const ingestRes1 = await ingest.handler({ httpMethod: 'POST', body: JSON.stringify({ docs: initialDocs, mode: 'replace' }) }, {});
  const ingestData1 = JSON.parse(ingestRes1.body);
  console.log(`✓ Initial index created: ${ingestData1.indexed} docs indexed, total: ${ingestData1.total}`);

  // Step 2: Simulate user voice recording + transcript
  const voiceTranscripts = [
    'I want to build web applications with Node.js and Express framework',
    'Show me how to connect Python to a database using SQLAlchemy',
    'Tell me about REST APIs and how to implement them'
  ];

  for (let i = 0; i < voiceTranscripts.length; i++) {
    console.log(`\nStep ${i + 2}: Training with voice transcript ${i + 1}`);
    const transcript = voiceTranscripts[i];
    console.log(`  Transcript: "${transcript}"`);

    // Add transcript as training document
    const trainingDoc = {
      id: `voice_${Date.now()}_${i}`,
      title: `Voice Training ${i + 1}`,
      text: transcript
    };

    const ingestRes = await ingest.handler({ httpMethod: 'POST', body: JSON.stringify({ docs: [trainingDoc], mode: 'append' }) }, {});
    const ingestData = JSON.parse(ingestRes.body);
    console.log(`  ✓ Transcript trained: ${ingestData.indexed} doc added, total in index: ${ingestData.total}`);
  }

  // Step 3: Query and verify retrieval uses trained transcripts
  console.log('\n\nStep 5: Query to verify trained data is in index');
  const testQuery = 'How do I use Node.js with Express?';
  console.log(`  Query: "${testQuery}"`);

  const queryEvent = { httpMethod: 'POST', body: JSON.stringify({ api: 'openai', messages: [{ role: 'user', content: testQuery }] }) };
  const queryRes = await ai.handler(queryEvent, {});
  const queryData = JSON.parse(queryRes.body);

  if (queryData.retrieved && queryData.retrieved.length > 0) {
    console.log(`  ✓ Retrieved ${queryData.retrieved.length} relevant documents:`);
    queryData.retrieved.forEach((doc, idx) => {
      console.log(`    [${idx + 1}] ${doc.title}: "${doc.text.substring(0, 60)}..." (score: ${doc.score.toFixed(2)})`);
    });
  }

  console.log('\n=== Test Complete ===\n');
})();
