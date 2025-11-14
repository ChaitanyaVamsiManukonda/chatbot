const { buildIndex, loadIndex } = require('../../lib/retrieval');
const fs = require('fs');

exports.handler = async function(event, context) {
  // Expect JSON body: { docs: [{id,title,text}], mode: 'replace' | 'append' }
  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.docs || !Array.isArray(body.docs)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'docs array required' }) };
    }
    
    const mode = body.mode || 'append'; // default: append new docs to existing index
    let allDocs = [];

    // If append mode, load existing docs first
    if (mode === 'append') {
      const existingIndex = loadIndex();
      if (existingIndex && existingIndex.docs) {
        allDocs = existingIndex.docs.map(d => ({ id: d.id, title: d.title, text: d.text }));
      }
    }

    // Add new docs
    const newDocs = body.docs.map((d, i) => ({ id: d.id || `doc_${Date.now()}_${i}`, title: d.title || '', text: d.text || '' }));
    allDocs = allDocs.concat(newDocs);

    const index = buildIndex(allDocs);
    return { statusCode: 200, body: JSON.stringify({ ok: true, indexed: newDocs.length, total: allDocs.length, mode, indexPath: index ? '../../data/index.json' : null }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
