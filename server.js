const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const publicDir = path.join(__dirname, 'public');
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

fs.mkdirSync(dataDir, { recursive: true });

function loadUsers() {
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, '[]\n', 'utf8');
    return [];
  }

  try {
    const content = fs.readFileSync(usersFile, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

let users = loadUsers();
let nextUserId = users.reduce((maxId, user) => Math.max(maxId, Number(user.id) || 0), 0) + 1;

function saveUsers() {
  fs.writeFileSync(usersFile, `${JSON.stringify(users, null, 2)}\n`, 'utf8');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function createToken(payload, expiresInSeconds = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new Error('Token mal formatado.');
  }

  const [encodedHeader, encodedPayload, receivedSignature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (receivedSignature !== expectedSignature) {
    throw new Error('Assinatura inválida.');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expirado.');
  }

  return payload;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('Payload muito grande.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('JSON inválido.'));
      }
    });

    req.on('error', reject);
  });
}

function serveStaticFile(res, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: 'Acesso negado.' });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { error: 'Arquivo não encontrado.' });
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'POST' && url.pathname === '/api/register') {
    try {
      const { name, email, password } = await readBody(req);

      if (!name || !email || !password) {
        sendJson(res, 400, { error: 'Preencha name, email e password.' });
        return;
      }

      if (String(password).length < 4) {
        sendJson(res, 400, { error: 'A senha precisa ter pelo menos 4 caracteres.' });
        return;
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const existingUser = users.find((user) => user.email === normalizedEmail);

      if (existingUser) {
        sendJson(res, 409, { error: 'Usuário já cadastrado.' });
        return;
      }

      const user = {
        id: nextUserId++,
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString()
      };

      users.push(user);
      saveUsers();

      const token = createToken({ id: user.id, email: user.email, name: user.name });
      sendJson(res, 201, {
        message: 'Conta criada e login efetuado com sucesso.',
        token,
        user: publicUser(user)
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    try {
      const { email, password } = await readBody(req);
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const user = users.find((candidate) => candidate.email === normalizedEmail);

      if (!user || user.passwordHash !== hashPassword(password || '')) {
        sendJson(res, 401, { error: 'Email ou senha inválidos.' });
        return;
      }

      const token = createToken({ id: user.id, email: user.email, name: user.name });
      sendJson(res, 200, {
        message: 'Login realizado com sucesso.',
        token,
        user: publicUser(user)
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/profile') {
    try {
      const authHeader = req.headers.authorization || '';
      const [scheme, token] = authHeader.split(' ');

      if (scheme !== 'Bearer' || !token) {
        sendJson(res, 401, { error: 'Envie Authorization: Bearer <token>.' });
        return;
      }

      const payload = verifyToken(token);
      const user = users.find((candidate) => candidate.id === payload.id);

      if (!user) {
        sendJson(res, 404, { error: 'Usuário não encontrado.' });
        return;
      }

      sendJson(res, 200, {
        message: 'Perfil carregado com sucesso.',
        profile: publicUser(user),
        tokenPayload: payload
      });
    } catch (error) {
      sendJson(res, 401, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/users') {
    sendJson(res, 200, {
      users: users.map(publicUser)
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/project-info') {
    sendJson(res, 200, {
      name: 'JWT Auth Demo',
      description: 'Demo de autenticação JWT com cadastro, login, sessão persistida e rota protegida.',
      stack: ['Node.js', 'JavaScript', 'JWT', 'HTML', 'CSS'],
      endpoints: ['/api/register', '/api/login', '/api/profile', '/api/users'],
      runCommand: 'npm start'
    });
    return;
  }

  if (req.method === 'GET') {
    serveStaticFile(res, url.pathname);
    return;
  }

  sendJson(res, 404, { error: 'Rota não encontrada.' });
});

server.listen(PORT, () => {
  console.log(`JWT demo running at http://localhost:${PORT}`);
});
