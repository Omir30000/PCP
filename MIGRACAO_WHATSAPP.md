# Migração do Envio de WhatsApp — EvolutionAPI → WPPConnect

Guia para substituir a **EvolutionAPI** por uma solução própria baseada em **WPPConnect**
(ou **Baileys**, como alternativa), sem precisar reescrever o frontend.

---

## 1. Como o envio funciona hoje

O projeto é 100% frontend (React + Vite) hospedado no Vercel. O envio acontece em **3 arquivos**:

| Arquivo | Linha | Uso |
|---|---|---|
| `PaginaRegistro.tsx` | 277 | Envia resumo de produção ao finalizar registro |
| `Envio de Registros.tsx` | 606 | Envia mensagem para contatos |
| `RelatorioBoletimAI.tsx` | 193 | Envia boletim gerado por IA |

Todos usam o mesmo padrão:

```js
const EVO_CONFIG = {
  baseURL: import.meta.env.VITE_EVO_BASE_URL,
  apiKey: import.meta.env.VITE_EVO_API_KEY,
  instance: import.meta.env.VITE_EVO_INSTANCE,
  destination: import.meta.env.VITE_EVO_DESTINATION
};

const response = await fetch(`/api/evo/message/sendText/${EVO_CONFIG.instance}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'apiKey': EVO_CONFIG.apiKey },
  body: JSON.stringify({ number, text: mensagem, linkPreview: false })
});
```

Note o caminho relativo `/api/evo/...`: quem resolve o destino é o `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/evo/(.*)", "destination": "https://evolution-evolution-api.585pjj.easypanel.host/$1" }
  ]
}
```

**Conclusão:** para trocar de provedor, basta que o novo serviço exponha o mesmo endpoint
(`POST /message/sendText/:instance`) com o mesmo corpo (`number`, `text`) e header (`apiKey`).
Se fizermos isso, **o frontend não muda nenhuma linha** — só alteramos o host no `vercel.json`.

---

## 2. Por que WPPConnect (e não os outros)

| | Baileys | WPPConnect | Venom-Bot |
|---|---|---|---|
| Base | Headless, sem navegador | Usa Baileys internamente | Puppeteer/Chromium |
| Peso | Leve | Leve | Pesado |
| REST API pronta | Não | Sim (`wppconnect-server`) | Sim, mas desatualizado |
| Manutenção | Ativa | Ativa | **Deprecado** |
| Licença | Grátis | Grátis | Grátis |

- **WPPConnect** é a melhor opção: é um fork do Baileys com camada de sessão/QR bem
  resolvida e API madura. É a alternativa de migração mais direta à EvolutionAPI.
- **Baileys** é a base da própria EvolutionAPI: mais leve e controlável, porém você precisa
  construir a camada HTTP e o gerenciamento de sessão (reconexão, storage) do zero.
- **Venom-Bot**: evitar. Baseado em automação de navegador, pesado e sem manutenção ativa.

---

## 3. Arquitetura alvo

```
[ Frontend Vercel ]  --fetch /api/evo/message/sendText/instancia-->
        |
        | vercel.json (rewrite, muda só o host)
        v
[ Seu conector Node.js (VPS/máquina local/Railway/Render) ]
   - WPPConnect (ou Baileys) mantém a sessão do WhatsApp Web
   - Existe endpoint: POST /message/sendText/:instance
        |
        v
[ WhatsApp API ]
```

Requisitos do conector:
- Node.js 18+.
- Processo **persistente** (a sessão do WhatsApp Web precisa ficar ativa). Use PM2, Docker ou
  um host com servidor Node (VPS, Railway, Render). **Não roda no Vercel (serverless).**
- Um pouco de RAM (~300 MB) e acesso de rede para o QR code inicial.

---

## 4. Passo a passo — Conector com WPPConnect

### 4.1 Criar o projeto do conector

```bash
mkdir whatsapp-connector
cd whatsapp-connector
npm init -y
npm install @wppconnect-team/wppconnect express dotenv
```

### 4.2 `server.js`

Servidor que expõe o mesmo endpoint usado pelo frontend, para **não precisar mexer no app**:

```js
const express = require('express');
const dotenv = require('dotenv');
const wppconnect = require('@wppconnect-team/wppconnect');

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3333;
const API_KEY = process.env.CONNECTOR_API_KEY;        // opcional (segurança)
const SESSION_NAME = process.env.WPP_SESSION || 'pcp';

// Mapa de sessões por instância (para suportar múltiplas, como a EvolutionAPI)
const clients = new Map();

async function getClient(instance) {
  const session = instance || SESSION_NAME;
  if (clients.has(session)) return clients.get(session);

  const client = await wppconnect.default.create({
    session: session,
    headless: true,
    logQR: false,
    statusFind: (status) => {
      console.log(`[${session}] Status:`, status);
    },
    // Pasta local onde a sessão é salva (persistência)
    folderName: session
  });

  clients.set(session, client);
  return client;
}

// ===== Endpoint compatível com EvolutionAPI =====
// POST /message/sendText/:instance
// body: { number, text, linkPreview? }
// header: apiKey
app.post('/message/sendText/:instance', async (req, res) => {
  if (API_KEY && req.headers.apikey !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const { number, text } = req.body || {};
  if (!number || !text) {
    return res.status(400).json({ error: 'number e text são obrigatórios' });
  }

  try {
    const client = await getClient(req.params.instance);
    // número com DDI + DDD, sem '+' e sem '9' extra (formato do WPPConnect)
    const phone = number.startsWith('55') ? number : '55' + number;

    const result = await client.sendText(phone, text);
    res.json({ status: 'SUCCESS', key: result.key });
  } catch (err) {
    console.error('[sendText]', err);
    res.status(500).json({ error: String(err) });
  }
});

// Endpoint para exibir o QR no navegador (emparelhamento inicial)
app.get('/qrcode/:instance', async (req, res) => {
  const session = req.params.instance || SESSION_NAME;
  if (clients.has(session)) {
    return res.json({ message: 'Sessão já conectada' });
  }
  const client = await wppconnect.default.create({
    session,
    headless: true,
    folderName: session
  });
  clients.set(session, client);
  res.json({ message: 'Sessão criada. Conecte pelo QR exibido no console do servidor.' });
});

app.listen(PORT, () => console.log(`Conector WPPConnect rodando em :${PORT}`));
```

### 4.3 `.env` do conector

```
PORT=3333
WPP_SESSION=pcp
CONNECTOR_API_KEY=sua_chave_secreta_aqui
```

### 4.4 Primeira execução (QR code)

```bash
node server.js
```

Ao iniciar, o WPPConnect gera um **QR code no terminal**. Escaneie com o WhatsApp
(Configurações → Aparelhos conectados → Conectar aparelho). A sessão fica salva na pasta
`pcp/` e reconecta sozinha nos próximos inícios.

> Dica: se o QR não aparecer bem no terminal, use a lib `qrcode-terminal`:
> `npm install qrcode-terminal` e passe `logQR: true` nas opções do `create`.

### 4.5 Rodando como serviço permanente (PM2)

```bash
npm install -g pm2
pm2 start server.js --name whatsapp-connector
pm2 save
pm2 startup   # mantém ativo após reboot
```

---

## 5. Passo a passo — Alternativa com Baileys

Escolha Baileys se quiser máximo controle e mínimo peso. O custo é gerenciar sessão e
reconexão manualmente.

```bash
npm install @whiskeysockets/baileys express qrcode-terminal pino
```

```js
// baileys-server.js (exemplo mínimo)
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3334;

let sock;

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('baileys-session');
  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) start();
    } else if (connection === 'open') {
      console.log('WhatsApp conectado!');
    }
  });
  // QR no terminal
  sock.ev.on('qr', (qr) => qrcode.generate(qr, { small: true }));
}

// POST /message/sendText/:instance — mesmo formato da EvolutionAPI
app.post('/message/sendText/:instance', async (req, res) => {
  const { number, text } = req.body || {};
  if (!sock || !number || !text) {
    return res.status(400).json({ error: 'Servidor não conectado ou payload inválido' });
  }
  const phone = number.replace(/[^0-9]/g, '');
  const jid = (phone.startsWith('55') ? phone : '55' + phone) + '@s.whatsapp.net';
  try {
    await sock.sendMessage(jid, { text });
    res.json({ status: 'SUCCESS' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => console.log('Baileys rodando em :' + PORT));
start();
```

> No Baileys, mensagens para números que **nunca** conversaram com você exigem a presença
> do usuário no grupo/contato ou a abertura do chat — comportamento padrão do WhatsApp.

---

## 6. Apontando o frontend para o novo conector

Como o frontend usa o caminho relativo `/api/evo/...`, só é preciso trocar o **host** no
`vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/evo/(.*)",
      "destination": "https://SEU-CONECTOR/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Substitua `https://SEU-CONECTOR/` pelo endereço público do conector
(ex.: `https://whatsapp-connector.suaempresa.com/` ou IP:porta com HTTPS).

> ⚠️ Se o conector tiver `apiKey` configurada, defina o mesmo valor em
> `VITE_EVO_API_KEY` no `.env` do app — o frontend já envia esse header.

### Caminho alternativo (sem mexer no vercel.json)

Se preferir apontar direto, basta mudar a base URL para o endereço do conector nos 3
arquivos. Aí o `fetch` usa URL absoluta:

```js
const EVO_CONFIG = {
  baseURL: import.meta.env.VITE_EVO_BASE_URL,  // agora: https://SEU-CONECTOR
  ...
};
const response = await fetch(`${EVO_CONFIG.baseURL}/message/sendText/${EVO_CONFIG.instance}`, ...);
```

---

## 7. Checklist de validação

1. [ ] Subiu o conector e escaneou o QR (status "conectado" no console).
2. [ ] Teste local com curl antes de tocar no frontend:
   ```bash
   curl -X POST https://SEU-CONECTOR/message/sendText/pcp \
     -H "Content-Type: application/json" \
     -H "apiKey: sua_chave_secreta_aqui" \
     -d '{"number":"5511999999999","text":"Teste de migração"}'
   ```
3. [ ] Conferiu que o número foi formatado corretamente (DDI 55 + DDD + número, sem `9` extra).
4. [ ] Atualizou o `vercel.json` e fez deploy.
5. [ ] Testou as 3 telas: `PaginaRegistro.tsx`, `Envio de Registros.tsx`, `RelatorioBoletimAI.tsx`.
6. [ ] Configurou o conector para subir sozinho (PM2/Docker) e em modo `production` (HTTPS).
7. [ ] (Opcional) Limitou as instâncias na EvolutionAPI e depois encerrou o serviço.

---

## 8. Observações finais

- **Sessão**: WPPConnect salva a sessão localmente; faça backup dessa pasta — se perder, precisa
  escanear o QR de novo.
- **Um número por vez**: cada sessão = um número do WhatsApp. Para múltiplos números, crie
  instâncias/processos separados (o conector acima já aceita `:instance` dinâmico).
- **Limites do WhatsApp**: evite disparos em massa (acima de ~50 msgs/hora sem variação de
  conteúdo) para não bloquear o número. O WPPConnect usa a API não oficial do WhatsApp Web.
- **Custo**: WPPConnect e Baileys são gratuitos e sem licença, ao contrário da EvolutionAPI
  (que passou a exigir licença paga para múltiplas instâncias).
