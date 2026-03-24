# Integração no site de portfólio

Este repositório agora expõe `GET /api/project-info` para facilitar a integração com cards dinâmicos no portfólio.

## 1) Rodar o projeto localmente

```bash
npm start
```

App: `http://localhost:3000`  
Metadata do projeto: `http://localhost:3000/api/project-info`

## 2) Snippet (React/Next) para o seu portfólio

```jsx
import { useEffect, useState } from 'react';

export default function JwtProjectCard() {
  const [project, setProject] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3000/api/project-info')
      .then((res) => res.json())
      .then(setProject)
      .catch(() => setProject(null));
  }, []);

  if (!project) {
    return <p>Carregando projeto JWT...</p>;
  }

  return (
    <article>
      <h3>{project.name}</h3>
      <p>{project.description}</p>
      <ul>
        {project.stack.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <a href="http://localhost:3000" target="_blank" rel="noreferrer">
        Ver demo
      </a>
    </article>
  );
}
```

## 3) Snippet HTML simples

```html
<section>
  <h3>JWT Auth Demo</h3>
  <p>Cadastro, login, sessão persistida e rota protegida com JWT.</p>
  <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer">Ver demo</a>
  <a href="https://github.com/KevinCFreitas/api-jwt" target="_blank" rel="noopener noreferrer">Código</a>
</section>
```

## 4) Texto pronto para currículo/portfólio

**JWT Auth Demo** — Aplicação com autenticação JWT incluindo cadastro, login, persistência de sessão no navegador e consumo de rota protegida, com interface web para testes end-to-end.

## Observação

Neste ambiente de execução, o acesso de rede ao repositório `https://github.com/KevinCFreitas/portifolio` retornou `403`, então a integração automática nesse outro repositório não pôde ser aplicada daqui.
