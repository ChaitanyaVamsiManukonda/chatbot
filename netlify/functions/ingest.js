const { buildIndex } = require('../../lib/retrieval');
const fs = require('fs');

exports.handler = async function(event, context) {
  // Expect JSON body: { docs: [{id,title,text}] }
  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.docs || !Array.isArray(body.docs)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'docs array required' }) };
    }
    const docs = body.docs.map((d, i) => ({ id: d.id || String(i), title: d.title || '', text: d.text || '' }));
    const index = buildIndex(docs);
    return { statusCode: 200, body: JSON.stringify({ ok: true, indexed: docs.length, indexPath: index ? '../../data/index.json' : null }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
