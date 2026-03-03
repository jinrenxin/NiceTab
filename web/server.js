import http from 'node:http';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadEnv = () => {
  const envPath = path.join(__dirname, '.env');
  let content = '';
  try {
    content = readFileSync(envPath, 'utf8');
  } catch {
    return;
  }
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      return;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
};

loadEnv();

const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 3000);

const provider = (process.env.GIST_PROVIDER || 'github').toLowerCase();
const gistId = process.env.GIST_ID || '';
const gistToken = process.env.GIST_TOKEN || '';
const gistFilename = process.env.GIST_FILENAME || '__NiceTab_gist__.json';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const getApiBase = () =>
  provider === 'gitee' ? 'https://gitee.com/api/v5/gists' : 'https://api.github.com/gists';

const withAccessToken = apiUrl => {
  if (provider !== 'gitee' || !gistToken) {
    return apiUrl;
  }
  const sep = apiUrl.includes('?') ? '&' : '?';
  return `${apiUrl}${sep}access_token=${encodeURIComponent(gistToken)}`;
};

const makeHeaders = extraHeaders => {
  const headers = { ...(extraHeaders || {}) };
  if (provider === 'github') {
    headers.Accept = 'application/vnd.github+json';
  }
  if (gistToken) {
    headers.Authorization = `token ${gistToken}`;
  }
  return headers;
};

const resolveGistFile = gist => {
  const files = gist?.files || {};
  if (files[gistFilename]) {
    return files[gistFilename];
  }
  const fallbackKey = Object.keys(files).find(key => key.endsWith('.json'));
  if (fallbackKey) {
    return files[fallbackKey];
  }
  return null;
};

const parseTabsData = content => {
  try {
    const parsed = JSON.parse(content || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const fetchGist = async () => {
  if (!gistId) {
    throw new Error('GIST_ID is required');
  }
  const apiUrl = withAccessToken(`${getApiBase()}/${gistId}`);
  const response = await fetch(apiUrl, { headers: makeHeaders() });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fetch gist failed: ${response.status} ${text}`);
  }
  return response.json();
};

const fetchGistData = async () => {
  const gist = await fetchGist();
  const file = resolveGistFile(gist);
  if (!file) {
    throw new Error('Gist file not found');
  }
  let content = file.content || '';
  if (file.truncated && file.raw_url) {
    const rawUrl = withAccessToken(file.raw_url);
    const rawResponse = await fetch(rawUrl, { headers: makeHeaders() });
    if (!rawResponse.ok) {
      const text = await rawResponse.text();
      throw new Error(`Fetch raw gist failed: ${rawResponse.status} ${text}`);
    }
    content = await rawResponse.text();
  }
  const data = parseTabsData(content);
  const fileName = file.filename || gistFilename;
  return {
    provider,
    gistId,
    fileName,
    updatedAt: gist.updated_at || gist.created_at || '',
    data,
  };
};

const updateGistData = async (data, fileName) => {
  if (!Array.isArray(data)) {
    throw new Error('`data` must be an array');
  }
  if (!gistId) {
    throw new Error('GIST_ID is required');
  }

  const targetFileName =
    typeof fileName === 'string' && fileName.trim() ? fileName.trim() : gistFilename;
  const apiUrl = withAccessToken(`${getApiBase()}/${gistId}`);
  const payload = {
    files: {
      [targetFileName]: {
        content: `${JSON.stringify(data, null, 2)}\n`,
      },
    },
  };

  const response = await fetch(apiUrl, {
    method: 'PATCH',
    headers: makeHeaders({
      'Content-Type': 'application/json; charset=utf-8',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Update gist failed: ${response.status} ${text}`);
  }

  const gist = await response.json();
  return {
    provider,
    gistId,
    fileName: targetFileName,
    updatedAt: gist.updated_at || gist.created_at || '',
    data,
  };
};

const readJsonBody = async req => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) {
    return {};
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON body');
  }
};

const sendJson = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const sendFile = async (res, filePath, method) => {
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const content = await readFile(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(method === 'HEAD' ? undefined : content);
};

const server = http.createServer(async (req, res) => {
  try {
    const method = (req.method || 'GET').toUpperCase();
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    if (url.pathname === '/api/health') {
      if (method !== 'GET') {
        return sendJson(res, 405, { error: 'Method Not Allowed' });
      }
      return sendJson(res, 200, { status: 'ok' });
    }
    if (url.pathname === '/api/tabs') {
      if (method === 'GET') {
        const gist = await fetchGistData();
        return sendJson(res, 200, gist);
      }
      if (method === 'PUT') {
        const body = await readJsonBody(req);
        if (!Array.isArray(body?.data)) {
          return sendJson(res, 400, { error: '`data` must be an array' });
        }
        const gist = await updateGistData(body.data, body.fileName);
        return sendJson(res, 200, gist);
      }
      return sendJson(res, 405, { error: 'Method Not Allowed' });
    }
    if (url.pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: 'Not Found' });
    }
    if (method !== 'GET' && method !== 'HEAD') {
      return sendJson(res, 405, { error: 'Method Not Allowed' });
    }
    let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    pathname = pathname.replace(/\\/g, '/');
    if (pathname.includes('..')) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }
    const filePath = path.join(publicDir, pathname);
    await sendFile(res, filePath, method);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return sendJson(res, 404, { error: 'Not Found' });
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Server error' });
  }
});

server.listen(port);
