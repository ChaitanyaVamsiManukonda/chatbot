const fetch = require('node-fetch');
const { buildIndex, loadIndex } = require('../../lib/retrieval');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function transcribeBuffer(buffer, filename) {
  // Use OpenAI transcription if enabled
  if (!(process.env.TRANSCRIBE_WITH_OPENAI === 'true') || !process.env.OPENAI_API_KEY) return null;
  try {
    const tmpDir = os.tmpdir();
    const tmpPath = path.join(tmpDir, filename);
    fs.writeFileSync(tmpPath, buffer);
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(tmpPath));
    form.append('model', 'whisper-1');

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      console.error('Transcription API error:', resp.status, t);
      return null;
    }
    const j = await resp.json();
    return j.text || null;
  } catch (e) {
    console.error('Transcription failed:', e.message);
    return null;
  }
}

exports.handler = async function(event, context) {
  // Expect JSON body: { docs: [{id,title,text,audioBase64,audioUrl,videoUrl,type}], mode: 'replace' | 'append' }
  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.docs || !Array.isArray(body.docs)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'docs array required' }) };
    }

    const mode = body.mode || 'append';
    let allDocs = [];

    if (mode === 'append') {
      const existingIndex = await loadIndex();
      if (existingIndex && existingIndex.docs) {
        // preserve existing docs and their metadata
        allDocs = existingIndex.docs.map(d => ({ id: d.id, title: d.title, text: d.text, meta: d.meta || null }));
      }
    }

    const newDocs = [];
    for (let i = 0; i < body.docs.length; i++) {
      const d = body.docs[i] || {};
      const id = d.id || `doc_${Date.now()}_${i}`;
      const title = d.title || '';
      let text = (d.text && String(d.text).trim()) || null;
      const meta = d.meta || { type: d.type || 'text', source_url: d.source || d.url || d.source_url || null };

      // If audio was provided inline as base64, try to transcribe (if enabled)
      if (!text && d.audioBase64) {
        try {
          const buffer = Buffer.from(d.audioBase64, 'base64');
          const filename = `ingest_${id}.webm`;
          const tr = await transcribeBuffer(buffer, filename);
          if (tr) {
            text = tr;
            meta.type = 'audio';
            meta.source = 'inline_audio_base64';
          }
        } catch (e) {
          console.error('Failed to process audioBase64 for doc', id, e.message);
        }
      }

      // If an audio or video URL was provided, fetch and attempt transcription if enabled
      if (!text && (d.audioUrl || d.videoUrl || meta.source_url)) {
        const url = d.audioUrl || d.videoUrl || meta.source_url;
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const arrayBuffer = await resp.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const filename = path.basename(url.split('?')[0]) || `ingest_${id}`;
            const tr = await transcribeBuffer(buffer, filename);
            if (tr) {
              text = tr;
              meta.type = d.audioUrl ? 'audio' : 'video';
              meta.source = url;
            } else {
              // no transcription: preserve source url for manual review
              meta.type = d.audioUrl ? 'audio' : 'video';
              meta.source = url;
            }
          } else {
            console.warn('Failed to fetch source URL for doc', id, url, resp.status);
            meta.source = url;
          }
        } catch (e) {
          console.error('Error fetching source URL for doc', id, e.message);
          meta.source = url;
        }
      }

      // Ensure we have a text field (even empty) to index; prefer transcript or provided text
      if (!text) text = '';

      newDocs.push({ id, title, text, meta });
    }

    allDocs = allDocs.concat(newDocs);

    const index = await buildIndex(allDocs);
    return { statusCode: 200, body: JSON.stringify({ ok: true, indexed: newDocs.length, total: allDocs.length, mode, indexPath: index ? '../../data/index.json' : null }) };
  } catch (err) {
    console.error('Ingest error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
