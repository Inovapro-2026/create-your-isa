const express = require('express');
const fs = require('fs');
const path = require('path');
const wppconnect = require('../../dist');
const PersonalizedIAService = require('../../src/services/personalizedIA');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicializar serviço de IA personalizada
const iaService = new PersonalizedIAService();

// Diretório base para contas
const ACCOUNTS_DIR = path.join(__dirname, '../../contas-isa');

// Gerenciador de instâncias
const instances = new Map();

// Criar diretório de contas se não existir
if (!fs.existsSync(ACCOUNTS_DIR)) {
  fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
}

// Função para criar nova conta
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
  
  // Criar instância inicial no Map
  const instanceData = {
    client: null,
    qrCodeBase64: null,
    qrCodeURL: null,
    status: 'starting',
    accountDir,
    tokensDir,
    cacheDir,
    accountName
  };
  
  instances.set(accountName, instanceData);
  
  try {
    console.log(`[${accountName}] Iniciando criação da conta...`);
    
    client = await wppconnect.create({
      session: accountName,
      catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
        console.log(`[${accountName}] QR Code gerado (tentativa ${attempts}):`);
        console.log(asciiQR);
        
        // ATUALIZAR instância com QR code em tempo real
        qrCodeBase64 = base64Qr;
        qrCodeURL = urlCode;
        status = 'waiting_qr';
        
        // Atualizar no Map
        const currentInstance = instances.get(accountName);
        if (currentInstance) {
          currentInstance.qrCodeBase64 = base64Qr;
          currentInstance.qrCodeURL = urlCode;
          currentInstance.status = 'waiting_qr';
        }
        
        console.log(`[${accountName}] QR Code atualizado na instância`);
      },
      statusFind: (statusSession, session) => {
        console.log(`[${accountName}] Status: ${statusSession}`);
        
        // Atualizar status em tempo real
        const currentInstance = instances.get(accountName);
        if (!currentInstance) return;
        
        if (statusSession === 'isLogged') {
          status = 'connected';
          currentInstance.status = 'connected';
        } else if (statusSession === 'qrReadSuccess') {
          status = 'qr_read';
          qrCodeBase64 = null;
          qrCodeURL = null;
          currentInstance.qrCodeBase64 = null;
          currentInstance.qrCodeURL = null;
          currentInstance.status = 'qr_read';
        } else if (statusSession === 'notLogged') {
          status = 'disconnected';
          currentInstance.status = 'disconnected';
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
    });
    
    console.log(`[${accountName}] Conta criada com sucesso!`);
    status = 'connected';
    
    // Configurar eventos do cliente
    client.onMessage(async (message) => {
      console.log(`[${accountName}] Mensagem recebida:`, message.body);
      
      // Processar mensagem com IA personalizada
      if (message.body && !message.fromMe) {
        try {
          console.log(`[${accountName}] Processando com IA personalizada...`);
          
          // Extrair número do telefone
          const phoneNumber = message.from.replace('@c.us', '');
          
          // Processar com IA
          const iaResult = await iaService.processMessage(message.body, phoneNumber);
          
          if (iaResult.response) {
            // Enviar resposta
            await client.sendText(message.from, iaResult.response);
            
            // Enviar anexo se houver
            if (iaResult.attachment) {
              await client.sendImage(message.from, iaResult.attachment, 'anexo', '');
            }
            
            // Registrar mensagem no banco
            await iaService.logMessage(iaResult.clientId, phoneNumber, message.body, iaResult.response, {
              source: iaResult.source,
              accountName: accountName,
              processingTime: iaResult.processingTime,
              tokens: iaResult.tokens,
              requiresHumanTransfer: iaResult.requiresHumanTransfer
            });
            
            console.log(`[${accountName}] ✓ Resposta IA enviada (${iaResult.processingTime}ms)`);
          }
        } catch (error) {
          console.error(`[${accountName}] ❌ Erro ao processar mensagem com IA:`, error);
          
          // Fallback: enviar mensagem padrão
          try {
            await client.sendText(message.from, 'Desculpe, estou temporariamente indisponível. Por favor, tente novamente mais tarde.');
          } catch (sendError) {
            console.error(`[${accountName}] ❌ Erro ao enviar fallback:`, sendError);
          }
        }
      }
    });
    
    client.onAck((ack) => {
      console.log(`[${accountName}] Ack:`, ack);
    });
    
    client.onStateChange(async (state) => {
      console.log(`[${accountName}] State change:`, state);
    });
    
  } catch (error) {
    console.error(`[${accountName}] ❌ Erro ao criar conta:`, error);
    status = 'error';
  }
  
  // Atualizar instância final
  const finalInstance = instances.get(accountName);
  if (finalInstance) {
    finalInstance.client = client;
    finalInstance.qrCodeBase64 = qrCodeBase64;
    finalInstance.qrCodeURL = qrCodeURL;
    finalInstance.status = status;
  }
  
  return {
    accountName,
    status,
    qrCode: qrCodeBase64,
    qrCodeURL,
    accountDir
  };
}

// Endpoint para criar nova conta
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
    res.json({
      status: true,
      message: 'Conta criada com sucesso',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Erro ao criar conta',
      error: error.message
    });
  }
});

// Endpoint para listar contas
app.get('/accounts', (req, res) => {
  const accounts = Array.from(instances.entries()).map(([name, instance]) => ({
    name,
    status: instance.status,
    hasQR: !!instance.qrCodeBase64,
    accountDir: instance.accountDir
  }));
  
  res.json({
    status: true,
    data: accounts
  });
});

// Endpoint para obter QR code de uma conta específica
app.get('/account/:name/qr', (req, res) => {
  const { name } = req.params;
  const instance = instances.get(name);
  
  if (!instance) {
    return res.status(404).json({
      status: false,
      message: 'Conta não encontrada'
    });
  }
  
  res.json({
    status: instance.qrCodeBase64 ? true : false,
    accountName: name,
    qrcode: instance.qrCodeBase64,
    url: instance.qrCodeURL,
    connectionStatus: instance.status,
    message: instance.qrCodeBase64 ? 'QR code disponível' : 'Aguardando QR code...'
  });
});

// Endpoint para status de conexão de uma conta
app.get('/account/:name/status', async (req, res) => {
  const { name } = req.params;
  const instance = instances.get(name);
  
  if (!instance) {
    return res.status(404).json({
      status: false,
      message: 'Conta não encontrada'
    });
  }
  
  let connectionStatus = 'unknown';
  if (instance.client && typeof instance.client.getConnectionState === 'function') {
    try {
      connectionStatus = await instance.client.getConnectionState();
    } catch (error) {
      connectionStatus = 'error';
    }
  }
  
  res.json({
    status: true,
    accountName: name,
    connectionStatus,
    instanceStatus: instance.status
  });
});

// Endpoint para enviar mensagem
app.post('/account/:name/sendmessage', async (req, res) => {
  const { name } = req.params;
  const { telnumber, message } = req.body;
  
  const instance = instances.get(name);
  
  if (!instance) {
    return res.status(404).json({
      status: false,
      message: 'Conta não encontrada'
    });
  }
  
  if (!instance.client) {
    return res.status(400).json({
      status: false,
      message: 'Cliente não inicializado'
    });
  }
  
  try {
    const connectionStatus = await instance.client.getConnectionState();
    if (connectionStatus !== 'CONNECTED') {
      return res.status(400).json({
        status: false,
        message: 'Conta não conectada'
      });
    }
    
    const numberStatus = await instance.client.checkNumberStatus(telnumber + '@c.us');
    if (!numberStatus.canReceiveMessage) {
      return res.status(400).json({
        status: false,
        message: 'Número não pode receber mensagens'
      });
    }
    
    const result = await instance.client.sendText(numberStatus.id._serialized, message);
    
    res.json({
      status: true,
      message: 'Mensagem enviada com sucesso',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Erro ao enviar mensagem',
      error: error.message
    });
  }
});

// Endpoint para deletar conta
app.delete('/account/:name', async (req, res) => {
  const { name } = req.params;
  const instance = instances.get(name);
  
  if (!instance) {
    return res.status(404).json({
      status: false,
      message: 'Conta não encontrada'
    });
  }
  
  try {
    if (instance.client) {
      await instance.client.close();
    }
    
    instances.delete(name);
    
    res.json({
      status: true,
      message: 'Conta deletada com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Erro ao deletar conta',
      error: error.message
    });
  }
});

// Servir dashboard HTML
app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Iniciar servidor
const porta = 3000;
const server = app.listen(porta, '0.0.0.0', () => {
  console.log('Servidor multi-contas corrigido iniciado na porta %s', porta);
  console.log('Diretório de contas: %s', ACCOUNTS_DIR);
  console.log('');
  console.log('Endpoints disponíveis:');
  console.log('POST /account/create - Criar nova conta');
  console.log('GET /accounts - Listar todas as contas');
  console.log('GET /account/:name/qr - Obter QR code da conta');
  console.log('GET /account/:name/status - Status da conexão');
  console.log('POST /account/:name/sendmessage - Enviar mensagem');
  console.log('DELETE /account/:name - Deletar conta');
});