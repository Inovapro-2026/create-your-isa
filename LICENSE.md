# 📋 INFORMAÇÕES DO SISTEMA WHATSAPP ISA
=========================================

## 🖥️ DADOS DO SERVIDOR ATUAL
=============================
**Data da Instalação:** 27 de dezembro de 2024  
**Horário do Sistema:** 11:38:25 UTC  
**Usuário Atual:** root  
**Diretório Atual:** /root  

### 🔌 INFORMAÇÕES DE REDE:
- **IP Público (IPv4):** 148.230.76.60
- **IP Público (IPv6):** 2a02:4780:14:68db::1
- **Porta API WhatsApp:** 3001 (ativa)
- **Status da Porta:** LISTENING (processo 796333/node)

### 📁 ESTRUTURA DO PROJETO:
- **Caminho Principal:** `/root/INOVAPRO\ /whatsapp-isa/`
- **Arquivo de Inicialização:** `start-bot.js`
- **Status do Serviço:** Aguardando configuração PM2

---

## 🔧 CONFIGURAÇÕES TÉCNICAS
=============================

### 📱 WHATSAPP CONFIGURATION:
```javascript
const config = {
  session: 'isa-session',
  headless: true,
  browser: 'chromium-browser',
  porta: 3001,
  ip_vps: '148.230.76.60',
  ipv6_vps: '2a02:4780:14:68db::1'
};
```

### 🔑 CREDENCIAIS DE ACESSO:
- **Protocolo:** HTTP (recomendar HTTPS em produção)
- **URL Base:** http://148.230.76.60:3001
- **Método de Autenticação:** Bearer Token
- **Status do Serviço:** Configurando...

---

## 🚀 ENDPOINTS DISPONÍVEIS
=============================

### 📊 STATUS DO SISTEMA:
```
GET http://148.230.76.60:3001/api/whatsapp/status
Headers: Authorization: Bearer [API_KEY]
```

### 📨 ENVIAR MENSAGEM:
```
POST http://148.230.76.60:3001/api/whatsapp/send-message
Headers: 
  Content-Type: application/json
  Authorization: Bearer [API_KEY]

Body:
{
  "number": "5511999999999",
  "message": "Sua mensagem aqui",
  "session": "isa-session"
}
```

### 📱 OBTER QR CODE:
```
GET http://148.230.76.60:3001/api/whatsapp/qr
Headers: Authorization: Bearer [API_KEY]
```

---

## 🛠️ COMANDOS ESSENCIAIS
=========================

### 📁 NAVEGAÇÃO:
```bash
cd "/root/INOVAPRO\ /whatsapp-isa/"
```

### 🔨 BUILD E EXECUÇÃO:
```bash
# Instalar dependências
npm install express cors axios dotenv

# Build do projeto
npm run build

# Iniciar com PM2
pm2 start ecosystem.config.js

# Verificar status
pm2 status
pm2 logs whatsapp-isa-api
```

### 🔍 MONITORAMENTO:
```bash
# Verificar portas
netstat -tulpn | grep :3001

# Verificar processos
ps aux | grep node

# Logs do sistema
journalctl -u pm2-root -f
```

---

## ⚙️ CONFIGURAÇÕES DO SISTEMA
===============================

### 📋 DEPENDÊNCIAS INSTALADAS:
- **Node.js:** Versão compatível com WPPConnect
- **PM2:** Gerenciador de processos
- **WPPConnect:** Biblioteca WhatsApp Web
- **Chromium:** Navegador para automação
- **Express:** Framework web para API

### 🔧 BIBLIOTECAS UTILIZADAS:
```json
{
  "express": "^4.18.0",
  "cors": "^2.8.5",
  "axios": "^1.13.2",
  "dotenv": "^16.0.0"
}
```

---

## 🚨 INFORMAÇÕES DE SEGURANÇA
==============================

### 🔐 MEDIDAS RECOMENDADAS:
1. **Alterar API Key padrão**
2. **Configurar firewall (UFW)**
3. **Implementar HTTPS (SSL/TLS)**
4. **Ativar rate limiting**
5. **Validar IPs de origem**

### 🛡️ CONFIGURAÇÃO FIREWALL:
```bash
# Liberar porta apenas para IP específico do painel
ufw allow from [IP_DO_PAINEL_ISA] to any port 3001
```

---

## 📞 SUPORTE E MANUTENÇÃO
=========================

### 🆘 CONTATOS E RECURSOS:
- **Responsável pelo Sistema:** [INSIRA_NOME_RESPONSÁVEL]
- **Data da Última Atualização:** 27 de dezembro de 2024
- **Status Atual:** Em configuração

### 🔍 DIAGNÓSTICOS COMUNS:
```bash
# Verificar conexão WhatsApp
curl -X GET http://148.230.76.60:3001/api/whatsapp/status

# Testar envio de mensagem
curl -X POST http://148.230.76.60:3001/api/whatsapp/send-message \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer [API_KEY]" \\
  -d '{"number": "5511999999999", "message": "Teste"}'
```

---

## 📄 LICENÇA ORIGINAL WPPConnect
=================================

### GNU LESSER GENERAL PUBLIC LICENSE

Version 3, 29 June 2007

Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.

[O resto da licença LGPL continua aqui...]

This version of the GNU Lesser General Public License incorporates the
terms and conditions of version 3 of the GNU General Public License,
supplemented by the additional permissions listed below.

#### 0. Additional Definitions.

As used herein, "this License" refers to version 3 of the GNU Lesser
General Public License, and the "GNU GPL" refers to version 3 of the
GNU General Public License.

"The Library" refers to a covered work governed by this License, other
than an Application or a Combined Work as defined below.

An "Application" is any work that makes use of an interface provided
by the Library, but which is not otherwise based on the Library.
Defining a subclass of a class defined by the Library is deemed a mode
of using an interface provided by the Library.

A "Combined Work" is a work produced by combining or linking an
Application with the Library. The particular version of the Library
with which the Combined Work was made is also called the "Linked
Version".

The "Minimal Corresponding Source" for a Combined Work means the
Corresponding Source for the Combined Work, excluding any source code
for portions of the Combined Work that, considered in isolation, are
based on the Application, and not on the Linked Version.

The "Corresponding Application Code" for a Combined Work means the
object code and/or source code for the Application, including any data
and utility programs needed for reproducing the Combined Work from the
Application, but excluding the System Libraries of the Combined Work.

#### 1. Exception to Section 3 of the GNU GPL.

You may convey a covered work under sections 3 and 4 of this License
without being bound by section 3 of the GNU GPL.

#### 2. Conveying Modified Versions.

[O restante completo da licença LGPL v3 continua...]

---

## 📝 NOTAS FINAIS
==================

**⚠️ IMPORTANTE:**
- Este arquivo contém informações sensíveis do sistema
- Manter em local seguro e com acesso restrito
- Atualizar sempre que houver mudanças nas configurações
- Implementar backup regular das configurações

**📅 Informações do Sistema:**
- **Sistema Operacional:** Linux (Ubuntu/Debian)
- **Kernel:** $(uname -r)
- **Arquitetura:** $(uname -m)
- **Data/Hora Atual:** $(date)

**🔧 Versão do Projeto:** WPPConnect ISA Integration v1.0