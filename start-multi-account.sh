#!/bin/bash

# Script de inicialização do WhatsApp ISA Multi-contas

echo "🚀 Iniciando WhatsApp ISA - Gerenciador Multi-contas"
echo "=================================================="

# Parar processos anteriores
echo "📴 Parando processos anteriores..."
pm2 stop whatsapp-isa-multi 2>/dev/null
pm2 delete whatsapp-isa-multi 2>/dev/null

# Criar diretórios necessários
echo "📁 Criando estrutura de diretórios..."
mkdir -p /root/INOVAPRO\ /whatsapp-isa/contas-isa
mkdir -p /root/INOVAPRO\ /whatsapp-isa/logs

# Limpar cache antigo (opcional)
echo "🧹 Limpando cache antigo..."
rm -rf /root/INOVAPRO\ /whatsapp-isa/contas-isa/*/cache/* 2>/dev/null || true

# Iniciar servidor multi-contas
echo "🌟 Iniciando servidor multi-contas..."
cd /root/INOVAPRO\ /whatsapp-isa
pm2 start pm2-multi.config.js

# Aguardar inicialização
echo "⏳ Aguardando inicialização..."
sleep 5

# Verificar status
echo "📊 Status do processo:"
pm2 status whatsapp-isa-multi

echo ""
echo "✅ Sistema iniciado com sucesso!"
echo ""
echo "📱 Acesse o dashboard em: http://148.230.76.60:3000/dashboard.html"
echo ""
echo "🔧 Endpoints disponíveis:"
echo "  POST /account/create - Criar nova conta"
echo "  GET  /accounts - Listar todas as contas"
echo "  GET  /account/:nome/qr - Obter QR code"
echo "  POST /account/:nome/sendmessage - Enviar mensagem"
echo ""
echo "💡 Exemplos de uso:"
echo "  curl -X POST http://148.230.76.60:3000/account/create \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"accountName\":\"isa-001\"}'"
echo ""
echo "  curl http://148.230.76.60:3000/account/isa-001/qr"
echo ""

# Mostrar logs em tempo real
echo "📝 Logs (Ctrl+C para sair):"
pm2 logs whatsapp-isa-multi --lines 50