const registerForm = document.querySelector('#register-form');
const loginForm = document.querySelector('#login-form');
const profileButton = document.querySelector('#profile-button');
const tokenOutput = document.querySelector('#token-output');
const output = document.querySelector('#output');
const clearOutputButton = document.querySelector('#clear-output');

function renderResponse(title, payload) {
  output.textContent = `${title}\n\n${JSON.stringify(payload, null, 2)}`;
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

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const data = await callApi('/api/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    renderResponse('Cadastro realizado com sucesso:', data);
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
    tokenOutput.value = data.token || '';
    renderResponse('Login realizado com sucesso:', data);
  } catch (error) {
    renderResponse('Erro no login:', error);
  }
});

profileButton.addEventListener('click', async () => {
  try {
    const data = await callApi('/api/profile', {
      headers: {
        Authorization: `Bearer ${tokenOutput.value.trim()}`
      }
    });
    renderResponse('Perfil carregado com sucesso:', data);
  } catch (error) {
    renderResponse('Erro ao buscar perfil:', error);
  }
});

clearOutputButton.addEventListener('click', () => {
  output.textContent = 'Aguardando ações...';
});
