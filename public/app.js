const registerForm = document.querySelector('#register-form');
const loginForm = document.querySelector('#login-form');
const profileButton = document.querySelector('#profile-button');
const logoutButton = document.querySelector('#logout-button');
const tokenOutput = document.querySelector('#token-output');
const output = document.querySelector('#output');
const clearOutputButton = document.querySelector('#clear-output');
const sessionStatus = document.querySelector('#session-status');
const profileName = document.querySelector('#profile-name');
const profileEmail = document.querySelector('#profile-email');
const usersList = document.querySelector('#users-list');

const storageKey = 'jwt-demo-session';

function renderResponse(title, payload) {
  output.textContent = `${title}\n\n${JSON.stringify(payload, null, 2)}`;
}

function saveSession(session) {
  localStorage.setItem(storageKey, JSON.stringify(session));
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || 'null');
  } catch (error) {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(storageKey);
}

function updateSessionUi(session) {
  tokenOutput.value = session?.token || '';
  sessionStatus.textContent = session?.user ? `Logado como ${session.user.name}` : 'Deslogado';
  sessionStatus.classList.toggle('is-authenticated', Boolean(session?.user));
  profileName.textContent = session?.user?.name || 'Nenhum usuário autenticado';
  profileEmail.textContent = session?.user?.email || 'Faça cadastro ou login para carregar os dados.';
}

async function callApi(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({ error: 'Resposta inválida.' }));

  if (!response.ok) {
    throw data;
  }

  return data;
}

async function refreshUsersList() {
  try {
    const data = await callApi('/api/users');
    usersList.innerHTML = '';

    if (!data.users.length) {
      usersList.innerHTML = '<li>Nenhuma conta cadastrada ainda.</li>';
      return;
    }

    data.users.forEach((user) => {
      const item = document.createElement('li');
      item.textContent = `${user.name} — ${user.email}`;
      usersList.appendChild(item);
    });
  } catch (error) {
    usersList.innerHTML = '<li>Não foi possível carregar as contas.</li>';
  }
}

async function fetchProfile() {
  const session = readSession();

  if (!session?.token) {
    renderResponse('Você ainda não está logado:', { error: 'Faça login pela página para carregar o perfil.' });
    return;
  }

  try {
    const data = await callApi('/api/profile', {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    });

    saveSession({ ...session, user: data.profile, token: session.token });
    updateSessionUi(readSession());
    renderResponse('Perfil carregado com sucesso:', data);
  } catch (error) {
    clearSession();
    updateSessionUi(null);
    renderResponse('Sessão expirada ou inválida:', error);
  }
}

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const data = await callApi('/api/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    saveSession({ token: data.token, user: data.user });
    updateSessionUi(readSession());
    registerForm.reset();
    renderResponse('Conta criada com sucesso:', data);
    refreshUsersList();
  } catch (error) {
    renderResponse('Erro no cadastro:', error);
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const data = await callApi('/api/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    saveSession({ token: data.token, user: data.user });
    updateSessionUi(readSession());
    loginForm.reset();
    renderResponse('Login realizado com sucesso:', data);
  } catch (error) {
    renderResponse('Erro no login:', error);
  }
});

profileButton.addEventListener('click', fetchProfile);

logoutButton.addEventListener('click', () => {
  clearSession();
  updateSessionUi(null);
  renderResponse('Sessão encerrada:', { ok: true });
});

clearOutputButton.addEventListener('click', () => {
  output.textContent = 'Aguardando ações...';
});

updateSessionUi(readSession());
refreshUsersList();

if (readSession()?.token) {
  fetchProfile();
}
