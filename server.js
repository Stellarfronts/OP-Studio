const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const root = __dirname;
const dataFile = path.join(root, 'public-data.json');

function readData() {
  try {
    if (!fs.existsSync(dataFile)) {
      fs.writeFileSync(dataFile, JSON.stringify({ people: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (error) {
    return { people: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function getAllTypings() {
  const data = readData();
  return (data.people || []).flatMap(person => (person.typings || []).map(typing => ({ ...typing, personName: person.name })));
}

function findTypingById(id) {
  return getAllTypings().find(typing => typing.id === id);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';

  if (pathname === '/api/people' && req.method === 'GET') {
    sendJson(res, 200, readData());
    return;
  }

  if (pathname === '/api/people' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const data = readData();
        const name = String(payload.name || '').trim();
        if (!name) {
          sendJson(res, 400, { error: 'Name is required' });
          return;
        }

        const person = data.people.find(entry => entry.name.toLowerCase() === name.toLowerCase());
        const entry = person || { name, typings: [] };
        const typing = {
          id: Date.now().toString(36),
          title: payload.title || 'Untitled typing',
          notes: payload.notes || '',
          selections: payload.selections || {},
          sliderStates: payload.sliderStates || {},
          saviorState: payload.saviorState || '',
          demonState: payload.demonState || '',
          images: Array.isArray(payload.images) ? payload.images : [],
          coins: Array.isArray(payload.coins) ? payload.coins : [],
          publishedAt: new Date().toISOString()
        };

        if (!person) {
          data.people.push(entry);
        }

        entry.typings.push(typing);
        writeData(data);
        sendJson(res, 200, { success: true, person: entry });
      } catch (error) {
        sendJson(res, 400, { error: 'Invalid JSON body' });
      }
    });
    return;
  }

  if (pathname.startsWith('/api/people/') && req.method === 'GET') {
    const name = decodeURIComponent(pathname.split('/').pop() || '');
    const data = readData();
    const person = data.people.find(entry => entry.name.toLowerCase() === name.toLowerCase());
    if (!person) {
      sendJson(res, 404, { error: 'Person not found' });
      return;
    }
    sendJson(res, 200, person);
    return;
  }

  if (pathname.startsWith('/api/typing/') && req.method === 'GET') {
    const id = decodeURIComponent(pathname.split('/').pop() || '');
    const typing = findTypingById(id);
    if (!typing) {
      sendJson(res, 404, { error: 'Typing not found' });
      return;
    }
    sendJson(res, 200, { typing });
    return;
  }

  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(root, safePath);
  const extension = path.extname(filePath).toLowerCase();
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  }[extension] || 'application/octet-stream';

  if (filePath.startsWith(root) && fs.existsSync(filePath)) {
    serveFile(res, filePath, contentType);
    return;
  }

  serveFile(res, path.join(root, 'index.html'), 'text/html; charset=utf-8');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
