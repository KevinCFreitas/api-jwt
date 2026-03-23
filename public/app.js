const registerForm = document.querySelector('#register-form');
const loginForm = document.querySelector('#login-form');
const profileButton = document.querySelector('#profile-button');
const logoutButton = document.querySelector('#logout-button');
const refreshUsersButton = document.querySelector('#refresh-users-button');
const tokenOutput = document.querySelector('#token-output');
const output = document.querySelector('#output');
const clearOutputButton = document.querySelector('#clear-output');
const sessionStatus = document.querySelector('#session-status');
const profileName = document.querySelector('#profile-name');
const profileEmail = document.querySelector('#profile-email');
const usersList = document.querySelector('#users-list');
const authStatusText = document.querySelector('#auth-status-text');
const tokenSizeText = document.querySelector('#token-size-text');
const usersCountText = document.querySelector('#users-count-text');

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
  const token = session?.token || '';
  tokenOutput.value = token;
  sessionStatus.textContent = session?.user ? `Logado como ${session.user.name}` : 'Deslogado';
  sessionStatus.classList.toggle('is-authenticated', Boolean(session?.user));
  profileName.textContent = session?.user?.name || 'Nenhum usuário autenticado';
  profileEmail.textContent = session?.user?.email || 'Faça cadastro ou login para carregar os dados.';
  authStatusText.textContent = session?.user ? 'Autenticado' : 'Sem sessão';
  tokenSizeText.textContent = `${token.length} caracteres`;
}

function setButtonLoading(button, isLoading) {
  button.disabled = isLoading;
  button.dataset.originalText = button.dataset.originalText || button.textContent;
  button.textContent = isLoading ? 'Carregando...' : button.dataset.originalText;
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
    setButtonLoading(refreshUsersButton, true);
    const data = await callApi('/api/users');
    usersList.innerHTML = '';
    usersCountText.textContent = `${data.users.length} cadastradas`;

    if (!data.users.length) {
      usersList.innerHTML = '<li>Nenhuma conta cadastrada ainda.</li>';
      return;
    }

    data.users.forEach((user) => {
      const item = document.createElement('li');
      item.className = 'user-item';
      item.innerHTML = `<strong>${user.name}</strong><span>${user.email}</span>`;
      usersList.appendChild(item);
    });
  } catch (error) {
    usersList.innerHTML = '<li>Não foi possível carregar as contas.</li>';
    usersCountText.textContent = 'Erro ao carregar';
  } finally {
    setButtonLoading(refreshUsersButton, false);
  }
}

async function fetchProfile() {
  const session = readSession();

  if (!session?.token) {
    renderResponse('Você ainda não está logado:', { error: 'Faça login pela página para carregar o perfil.' });
    return;
  }

  try {
    setButtonLoading(profileButton, true);
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
  } finally {
    setButtonLoading(profileButton, false);
  }
}

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const payload = Object.fromEntries(formData.entries());
  const submitButton = registerForm.querySelector('button[type="submit"]');

  try {
    setButtonLoading(submitButton, true);
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
  } finally {
    setButtonLoading(submitButton, false);
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());
  const submitButton = loginForm.querySelector('button[type="submit"]');

  try {
    setButtonLoading(submitButton, true);
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
  } finally {
    setButtonLoading(submitButton, false);
  }
});

profileButton.addEventListener('click', fetchProfile);
refreshUsersButton.addEventListener('click', refreshUsersList);

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
