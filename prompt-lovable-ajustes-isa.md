# Prompt para Lovable - Ajustes na ISA e Correção do Edge Function

## Contexto
Estamos com um sistema WhatsApp ISA multi-contas rodando, mas precisamos corrigir erros e implementar melhorias. O sistema atual tem:

1. **Multi-account-server.js** funcionando na porta 3000
2. **PersonalizedIAService** integrado
3. **Sistema de pastas separadas** por cliente
4. **Erro no Edge Function** retornando HTML ao invés de JSON

## Problemas a Corrigir

### 1. Edge Function Error 500
**Erro atual:**
```
Edge function returned 500: Error, {"error":"Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"}
```

**Causa:** A Edge Function está recebendo HTML (`<!DOCTYPE html>`) quando esperava JSON. Isso indica que o servidor está retornando uma página de erro ao invés de uma resposta JSON válida.

### 2. Status de Contas com Erro
As contas estão sendo criadas com status "error" e não estão gerando QR codes. Precisamos:
- Identificar o erro no wppconnect.create()
- Implementar tratamento de erros adequado
- Garantir que QR codes sejam gerados corretamente

### 3. Melhorias no Sistema Multi-Contas

## Implementações Necessárias

### A. Correção do Edge Function (supabase/functions/whatsapp-proxy/index.ts)

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const PROXY_TARGET = "http://localhost:3000"; // URL do multi-account-server

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const searchParams = url.search;
    
    // Construir URL alvo
    const targetUrl = `${PROXY_TARGET}${path}${searchParams}`;
    
    // Preparar headers
    const headers = new Headers(req.headers);
    headers.set('Host', 'localhost:3000');
    headers.set('Origin', 'http://localhost:3000');
    
    // Fazer requisição ao servidor
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined
    });
    
    // Verificar se a resposta é JSON válido
    const contentType = response.headers.get('content-type');
    let responseBody;
    
    if (contentType && contentType.includes('application/json')) {
      responseBody = await response.json();
    } else {
      const text = await response.text();
      // Se não for JSON, criar uma resposta de erro estruturada
      responseBody = {
        status: false,
        message: 'Erro no servidor',
        error: text,
        timestamp: new Date().toISOString()
      };
    }
    
    return new Response(JSON.stringify(responseBody), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
    
  } catch (error) {
    console.error('Erro no proxy:', error);
    
    return new Response(JSON.stringify({
      status: false,
      message: 'Erro no proxy do WhatsApp',
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});
```

### B. Melhorias no Multi-Account-Server (examples/rest/multi-account-server.js)

```javascript
// Adicionar validação de erros detalhada
async function createAccount(accountName) {
  const accountDir = path.join(ACCOUNTS_DIR, accountName);
  const tokensDir = path.join(accountDir, 'tokens');
  const cacheDir = path.join(accountDir, 'cache');
  
  // Criar estrutura de pastas
  if (!fs.existsSync(accountDir)) {
    fs.mkdirSync(accountDir, { recursive: true });
    fs.mkdirSync(tokensDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  let qrCodeBase64 = null;
  let qrCodeURL = null;
  let status = 'starting';
  let client = null;
  let errorMessage = null;
  
  try {
    console.log(`[${accountName}] Iniciando criação da conta...`);
    
    client = await wppconnect.create({
      session: accountName,
      catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
        console.log(`[${accountName}] QR Code gerado (tentativa ${attempts}):`);
        console.log(asciiQR);
        qrCodeBase64 = base64Qr;
        qrCodeURL = urlCode;
        status = 'waiting_qr';
      },
      statusFind: (statusSession, session) => {
        console.log(`[${accountName}] Status: ${statusSession}`);
        if (statusSession === 'isLogged') {
          status = 'connected';
        } else if (statusSession === 'qrReadSuccess') {
          status = 'qr_read';
          qrCodeBase64 = null;
          qrCodeURL = null;
        } else if (statusSession === 'notLogged') {
          status = 'disconnected';
        }
      },
      headless: true,
      devtools: false,
      useChrome: true,
      debug: false,
      logQR: true,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      disableWelcome: true,
      updatesLog: false,
      autoClose: 0,
      tokenStore: 'file',
      folderNameToken: tokensDir,
      mkdirFolderToken: tokensDir,
      // Adicionar timeout e retry
      timeout: 60000,
      retryTimeout: 30000
    });
    
    console.log(`[${accountName}] Conta criada com sucesso!`);
    status = 'connected';
    
  } catch (error) {
    console.error(`[${accountName}] Erro ao criar conta:`, error);
    errorMessage = error.message;
    status = 'error';
  }
  
  // Armazenar instância mesmo em caso de erro
  instances.set(accountName, {
    client,
    qrCodeBase64,
    qrCodeURL,
    status,
    accountDir,
    tokensDir,
    cacheDir,
    errorMessage,
    createdAt: new Date().toISOString()
  });
  
  return {
    accountName,
    status,
    qrCode: qrCodeBase64,
    qrCodeURL,
    accountDir,
    errorMessage
  };
}

// Melhorar endpoint de criação com retry
app.post('/account/create', async (req, res) => {
  const { accountName } = req.body;
  
  if (!accountName) {
    return res.status(400).json({
      status: false,
      message: 'Nome da conta é obrigatório'
    });
  }
  
  if (instances.has(accountName)) {
    return res.status(400).json({
      status: false,
      message: 'Conta já existe'
    });
  }
  
  try {
    const result = await createAccount(accountName);
    
    // Se houver erro, ainda retornar a estrutura criada
    res.json({
      status: true,
      message: result.status === 'error' ? 'Conta criada com erros' : 'Conta criada com sucesso',
      data: result,
      warning: result.status === 'error' ? 'Verifique os logs para detalhes do erro' : null
    });
    
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Erro ao criar conta',
      error: error.message
    });
  }
});
```

### C. Adicionar Health Check Endpoint

```javascript
// Endpoint de health check
app.get('/health', (req, res) => {
  const totalInstances = instances.size;
  const connectedInstances = Array.from(instances.values()).filter(i => i.status === 'connected').length;
  const errorInstances = Array.from(instances.values()).filter(i => i.status === 'error').length;
  
  res.json({
    status: true,
    timestamp: new Date().toISOString(),
    data: {
      server: 'running',
      port: porta,
      totalInstances,
      connectedInstances,
      errorInstances,
      uptime: process.uptime()
    }
  });
});
```

### D. Dashboard HTML Aprimorado (dashboard.html)

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gerenciador de Contas WhatsApp ISA</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .content {
            padding: 30px;
        }
        
        .create-account {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        
        .create-account h2 {
            margin-bottom: 15px;
            color: #333;
        }
        
        .form-group {
            display: flex;
            gap: 10px;
            align-items: end;
        }
        
        .form-group input {
            flex: 1;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
        }
        
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .btn-primary {
            background: #667eea;
            color: white;
        }
        
        .btn-primary:hover {
            background: #5a6fd8;
        }
        
        .btn-success {
            background: #28a745;
            color: white;
        }
        
        .btn-danger {
            background: #dc3545;
            color: white;
        }
        
        .accounts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
        }
        
        .account-card {
            background: white;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            padding: 20px;
            transition: all 0.3s ease;
        }
        
        .account-card:hover {
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            transform: translateY(-2px);
        }
        
        .account-card.connected {
            border-color: #28a745;
            background: #f8fff9;
        }
        
        .account-card.error {
            border-color: #dc3545;
            background: #fff8f8;
        }
        
        .account-card.waiting_qr {
            border-color: #ffc107;
            background: #fffbf0;
        }
        
        .account-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .account-name {
            font-size: 1.2rem;
            font-weight: bold;
            color: #333;
        }
        
        .status-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .status-connected {
            background: #d4edda;
            color: #155724;
        }
        
        .status-error {
            background: #f8d7da;
            color: #721c24;
        }
        
        .status-waiting_qr {
            background: #fff3cd;
            color: #856404;
        }
        
        .account-actions {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }
        
        .qr-container {
            text-align: center;
            margin: 15px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .qr-code {
            max-width: 200px;
            margin: 10px auto;
            border: 2px solid #ddd;
            border-radius: 8px;
        }
        
        .loading {
            text-align: center;
            padding: 20px;
            color: #666;
        }
        
        .error-message {
            background: #f8d7da;
            color: #721c24;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
            font-size: 0.9rem;
        }
        
        .stats {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .stat-item {
            text-align: center;
        }
        
        .stat-number {
            font-size: 1.5rem;
            font-weight: bold;
            color: #667eea;
        }
        
        .stat-label {
            font-size: 0.9rem;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Gerenciador WhatsApp ISA</h1>
            <p>Sistema de Multi-contas com IA Personalizada</p>
        </div>
        
        <div class="content">
            <div class="stats" id="stats">
                <div class="stat-item">
                    <div class="stat-number" id="total-contas">0</div>
                    <div class="stat-label">Total de Contas</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number" id="contas-conectadas">0</div>
                    <div class="stat-label">Conectadas</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number" id="contas-erro">0</div>
                    <div class="stat-label">Com Erro</div>
                </div>
            </div>
            
            <div class="create-account">
                <h2>➕ Criar Nova Conta</h2>
                <div class="form-group">
                    <input type="text" id="account-name" placeholder="Nome da conta (ex: cliente-joao-restaurante)" />
                    <button class="btn btn-primary" onclick="createAccount()">Criar Conta</button>
                </div>
            </div>
            
            <div class="loading" id="loading" style="display: none;">
                Carregando contas...
            </div>
            
            <div id="accounts-container">
                <!-- Contas serão carregadas aqui -->
            </div>
        </div>
    </div>

    <script>
        const API_BASE = window.location.origin;
        
        // Carregar contas ao iniciar
        document.addEventListener('DOMContentLoaded', () => {
            loadAccounts();
            // Atualizar a cada 5 segundos
            setInterval(loadAccounts, 5000);
        });
        
        async function createAccount() {
            const accountName = document.getElementById('account-name').value.trim();
            
            if (!accountName) {
                alert('Por favor, insira um nome para a conta');
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE}/account/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ accountName })
                });
                
                const data = await response.json();
                
                if (data.status) {
                    alert(`Conta ${accountName} criada com sucesso!`);
                    document.getElementById('account-name').value = '';
                    loadAccounts();
                } else {
                    alert(`Erro: ${data.message}`);
                }
            } catch (error) {
                alert(`Erro ao criar conta: ${error.message}`);
            }
        }
        
        async function loadAccounts() {
            try {
                const response = await fetch(`${API_BASE}/accounts`);
                const data = await response.json();
                
                if (data.status) {
                    displayAccounts(data.data);
                    updateStats(data.data);
                }
            } catch (error) {
                console.error('Erro ao carregar contas:', error);
            }
        }
        
        function displayAccounts(accounts) {
            const container = document.getElementById('accounts-container');
            
            if (accounts.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #666;">Nenhuma conta criada ainda</p>';
                return;
            }
            
            container.innerHTML = accounts.map(account => `
                <div class="account-card ${account.status}">
                    <div class="account-header">
                        <div class="account-name">${account.name}</div>
                        <div class="status-badge status-${account.status}">${account.status}</div>
                    </div>
                    
                    <div class="account-info">
                        <p><strong>Status:</strong> ${getStatusText(account.status)}</p>
                        <p><strong>Criado:</strong> ${new Date(account.createdAt || Date.now()).toLocaleString()}</p>
                    </div>
                    
                    ${account.hasQR ? `
                        <div class="qr-container">
                            <p><strong>QR Code:</strong></p>
                            <img src="data:image/png;base64,${account.qrCode}" class="qr-code" alt="QR Code" />
                            <p style="font-size: 0.9rem; color: #666;">Escaneie com seu WhatsApp</p>
                        </div>
                    ` : ''}
                    
                    ${account.errorMessage ? `
                        <div class="error-message">
                            <strong>Erro:</strong> ${account.errorMessage}
                        </div>
                    ` : ''}
                    
                    <div class="account-actions">
                        <button class="btn btn-success" onclick="getQRCode('${account.name}')">📱 Obter QR Code</button>
                        <button class="btn btn-primary" onclick="getStatus('${account.name}')">📊 Status</button>
                        <button class="btn btn-danger" onclick="deleteAccount('${account.name}')">🗑️ Deletar</button>
                    </div>
                </div>
            `).join('');
        }
        
        function getStatusText(status) {
            const statusMap = {
                'connected': '✅ Conectado',
                'waiting_qr': '⏳ Aguardando QR Code',
                'error': '❌ Erro',
                'starting': '🔄 Iniciando...',
                'disconnected': '🔌 Desconectado'
            };
            return statusMap[status] || status;
        }
        
        function updateStats(accounts) {
            document.getElementById('total-contas').textContent = accounts.length;
            document.getElementById('contas-conectadas').textContent = accounts.filter(a => a.status === 'connected').length;
            document.getElementById('contas-erro').textContent = accounts.filter(a => a.status === 'error').length;
        }
        
        async function getQRCode(accountName) {
            try {
                const response = await fetch(`${API_BASE}/account/${accountName}/qr`);
                const data = await response.json();
                
                if (data.status && data.qrcode) {
                    alert('QR Code obtido com sucesso! Atualize a página para visualizar.');
                    loadAccounts();
                } else {
                    alert(`QR Code não disponível: ${data.message}`);
                }
            } catch (error) {
                alert(`Erro ao obter QR Code: ${error.message}`);
            }
        }
        
        async function getStatus(accountName) {
            try {
                const response = await fetch(`${API_BASE}/account/${accountName}/status`);
                const data = await response.json();
                
                if (data.status) {
                    alert(`Status da conta ${accountName}:\nConexão: ${data.connectionStatus}\nInstância: ${data.instanceStatus}`);
                }
            } catch (error) {
                alert(`Erro ao obter status: ${error.message}`);
            }
        }
        
        async function deleteAccount(accountName) {
            if (!confirm(`Tem certeza que deseja deletar a conta ${accountName}?`)) {
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE}/account/${accountName}`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                
                if (data.status) {
                    alert(`Conta ${accountName} deletada com sucesso!`);
                    loadAccounts();
                } else {
                    alert(`Erro: ${data.message}`);
                }
            } catch (error) {
                alert(`Erro ao deletar conta: ${error.message}`);
            }
        }
    </script>
</body>
</html>
```

### E. Configuração de Clientes com IA Personalizada

Criar um sistema para configurar cada cliente com suas próprias respostas de IA:

```javascript
// Adicionar endpoint para configurar IA do cliente
app.post('/account/:name/config', async (req, res) => {
  const { name } = req.params;
  const config = req.body;
  
  const instance = instances.get(name);
  
  if (!instance) {
    return res.status(404).json({
      status: false,
      message: 'Conta não encontrada'
    });
  }
  
  try {
    // Salvar configuração em arquivo
    const configPath = path.join(instance.accountDir, 'ia-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    // Atualizar configuração na memória
    instance.iaConfig = config;
    
    res.json({
      status: true,
      message: 'Configuração de IA salva com sucesso',
      config: config
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Erro ao salvar configuração',
      error: error.message
    });
  }
});

// Obter configuração de IA do cliente
app.get('/account/:name/config', (req, res) => {
  const { name } = req.params;
  const instance = instances.get(name);
  
  if (!instance) {
    return res.status(404).json({
      status: false,
      message: 'Conta não encontrada'
    });
  }
  
  try {
    const configPath = path.join(instance.accountDir, 'ia-config.json');
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json({
        status: true,
        config: config
      });
    } else {
      res.json({
        status: false,
        message: 'Configuração não encontrada'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Erro ao ler configuração',
      error: error.message
    });
  }
});
```

## Testes e Validação

### 1. Testar Edge Function
```bash
curl -X POST https://seu-dominio.supabase.co/functions/v1/whatsapp-proxy/account/create \
  -H 'Content-Type: application/json' \
  -d '{"accountName":"teste-cliente"}'
```

### 2. Testar Multi-Account-Server
```bash
# Criar conta
curl -X POST http://localhost:3000/account/create \
  -H 'Content-Type: application/json' \
  -d '{"accountName":"cliente-teste"}'

# Listar contas
curl http://localhost:3000/accounts

# Health check
curl http://localhost:3000/health
```

### 3. Configurar IA Personalizada
```bash
curl -X POST http://localhost:3000/account/cliente-teste/config \
  -H 'Content-Type: application/json' \
  -d '{
    "businessName": "Restaurante do João",
    "businessType": "restaurant",
    "welcomeMessage": "🍽️ Bem-vindo ao Restaurante do João!",
    "products": [
      {"name": "Pizza Margherita", "price": "R$ 35,00"},
      {"name": "Lasanha Bolonhesa", "price": "R$ 28,00"}
    ],
    "openingHours": "Seg-Sex: 11h-22h, Sab-Dom: 10h-23h",
    "triggers": {
      "cardapio": "Aqui está nosso cardápio...",
      "preco": "Os preços variam de R$ 15-50",
      "entrega": "Entrega grátis acima de R$ 50"
    }
  }'
```

## Observações Importantes

1. **Segurança**: Implementar autenticação nos endpoints
2. **Logs**: Adicionar logging detalhado para debugging
3. **Monitoramento**: Implementar métricas de performance
4. **Backup**: Criar sistema de backup das configurações
5. **Escalabilidade**: Considerar uso de Redis para gerenciamento de sessões

## Próximos Passos

1. Implementar os códigos acima
2. Testar todos os endpoints
3. Verificar logs de erro detalhados
4. Ajustar configurações de timeout
5. Implementar sistema de retry automático
6. Adicionar monitoramento em tempo real

Preciso que implemente essas correções e melhorias para tornar o sistema robusto e funcional.