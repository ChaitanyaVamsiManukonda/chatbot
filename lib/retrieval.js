const fs = require('fs');
const path = require('path');

// Optional S3 support
const S3_BUCKET = process.env.S3_BUCKET;
const S3_KEY = process.env.S3_INDEX_KEY || 'index.json';
let s3Client = null;
let S3ClientClass = null, GetObjectCommand = null, PutObjectCommand = null;

if (S3_BUCKET) {
  try {
    const s3Module = require('@aws-sdk/client-s3');
    S3ClientClass = s3Module.S3Client;
    GetObjectCommand = s3Module.GetObjectCommand;
    PutObjectCommand = s3Module.PutObjectCommand;
    s3Client = new S3ClientClass({ region: process.env.S3_REGION || 'us-east-1' });
    console.log('S3 persistence enabled for bucket:', S3_BUCKET);
  } catch (e) {
    console.warn('S3 client setup failed:', e.message, '. Falling back to local storage only.');
    s3Client = null;
  }
}

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

async function buildIndex(docs) {
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

  // If S3 configured, upload index as well
  if (s3Client && PutObjectCommand) {
    try {
      await s3Client.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: S3_KEY, Body: JSON.stringify(index), ContentType: 'application/json' }));
      console.log('Index uploaded to S3:', S3_BUCKET, S3_KEY);
    } catch (err) {
      console.warn('Failed to upload index to S3:', err.message);
    }
  }

  return index;
}

async function loadIndex() {
  // If S3 configured, try to fetch latest index from S3
  if (s3Client && GetObjectCommand) {
    try {
      const resp = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: S3_KEY }));
      // stream to string
      const streamToString = (stream) => new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (c) => chunks.push(c));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      });
      const bodyStr = await streamToString(resp.Body);
      const obj = JSON.parse(bodyStr);
      // also write a local cache
      ensureDataDir();
      fs.writeFileSync(INDEX_PATH, JSON.stringify(obj, null, 2), 'utf8');
      return obj;
    } catch (err) {
      // fall back to local file
      console.warn('Failed to load index from S3, falling back to local:', err.message);
    }
  }

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

async function search(query, topK = 5) {
  const index = await loadIndex();
  if (!index) return [];
  const tokens = tokenize(query).filter(t => !STOPWORDS.has(t));
  if (tokens.length === 0) return [];
  const scored = index.docs.map(doc => ({ id: doc.id, title: doc.title, text: doc.text, score: scoreDoc(tokens, index, doc) }));
  scored.sort((a,b) => b.score - a.score);
  return scored.slice(0, topK).filter(r => r.score > 0);
}

module.exports = { buildIndex, loadIndex, search, INDEX_PATH };
