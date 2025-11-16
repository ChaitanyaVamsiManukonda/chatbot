(async () => {
  // Test ingest for media inputs without external transcription
  const ingest = require('./netlify/functions/ingest');

  // Ensure we don't call OpenAI during this test
  process.env.TRANSCRIBE_WITH_OPENAI = 'false';
  delete process.env.OPENAI_API_KEY;

  const docs = [
    { id: 't_text', title: 'Text Note', text: 'This is a simple text note to index.' },
    { id: 'a_inline', title: 'Inline Audio', audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=', meta: { type: 'audio', source: 'inline' } },
    { id: 'v_link', title: 'Video Link', videoUrl: 'https://example.com/video_sample.mp4', meta: { type: 'video', source_url: 'https://example.com/video_sample.mp4' } }
  ];

  const ingestEvent = { httpMethod: 'POST', body: JSON.stringify({ docs, mode: 'append' }) };
  const ingestRes = await ingest.handler(ingestEvent, {});
  console.log('Ingest media result:', ingestRes);
})();
