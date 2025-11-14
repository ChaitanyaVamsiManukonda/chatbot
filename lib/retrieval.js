const fs = require('fs');
const path = require('path');

// Simple TF-IDF retriever
// Index format saved to data/index.json:
// { docs: [{id,title,text,tf,termsCount}], df: {term: docFreq}, idf: {term: idf}, N }

const DATA_DIR = path.join(__dirname, '..', 'data');
const INDEX_PATH = path.join(DATA_DIR, 'index.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
}

function tokenize(text) {
  if (!text) return [];
  return ('' + text).toLowerCase().match(/\b[a-z0-9']+\b/g) || [];
}

const STOPWORDS = new Set([
  'the','is','in','and','to','a','of','that','it','on','for','as','with','this','was','are','but','be','by','or','an','have','not','from','at'
]);

function buildIndex(docs) {
  // docs: [{id,title,text}]
  const N = docs.length;
  const df = {}; // document frequency
  const indexedDocs = docs.map(d => {
    const terms = tokenize(d.text + ' ' + (d.title || ''))
      .filter(t => !STOPWORDS.has(t));
    const tf = {};
    terms.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
    // count unique terms for df
    const unique = new Set(terms);
    unique.forEach(t => { df[t] = (df[t] || 0) + 1; });
    return { id: d.id, title: d.title || '', text: d.text, tf, termsCount: terms.length };
  });
  const idf = {};
  Object.keys(df).forEach(t => {
    idf[t] = Math.log((N + 1) / (df[t] + 1)) + 1; // smoothed idf
  });

  const index = { docs: indexedDocs, df, idf, N };
  ensureDataDir();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');
  return index;
}

function loadIndex() {
  try {
    const raw = fs.readFileSync(INDEX_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function scoreDoc(queryTokens, index, doc) {
  // compute simple TF-IDF cosine similarity
  const qtf = {};
  queryTokens.forEach(t => { qtf[t] = (qtf[t] || 0) + 1; });
  // build vectors for terms present in either q or doc
  let dot = 0;
  let qnorm = 0;
  let dnorm = 0;
  const idf = index.idf || {};
  const allTerms = new Set([...Object.keys(qtf), ...Object.keys(doc.tf || {})]);
  allTerms.forEach(t => {
    if (STOPWORDS.has(t)) return;
    const qv = (qtf[t] || 0) * (idf[t] || 1);
    const dv = (doc.tf[t] || 0) * (idf[t] || 1);
    dot += qv * dv;
    qnorm += qv * qv;
    dnorm += dv * dv;
  });
  if (qnorm === 0 || dnorm === 0) return 0;
  return dot / (Math.sqrt(qnorm) * Math.sqrt(dnorm));
}

function search(query, topK = 5) {
  const index = loadIndex();
  if (!index) return [];
  const tokens = tokenize(query).filter(t => !STOPWORDS.has(t));
  if (tokens.length === 0) return [];
  const scored = index.docs.map(doc => ({ id: doc.id, title: doc.title, text: doc.text, score: scoreDoc(tokens, index, doc) }));
  scored.sort((a,b) => b.score - a.score);
  return scored.slice(0, topK).filter(r => r.score > 0);
}

module.exports = { buildIndex, loadIndex, search, INDEX_PATH };
