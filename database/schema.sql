-- Script SQL para criar estrutura do banco de dados para IA personalizada
-- Execute este script no Supabase SQL Editor

-- Tabela de clientes
CREATE TABLE clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    whatsapp_phone VARCHAR(20) UNIQUE NOT NULL,
    document VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Tabela de memória IA
CREATE TABLE ia_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    memory_name VARCHAR(255) NOT NULL,
    personality TEXT DEFAULT 'Profissional e prestativa',
    tone TEXT DEFAULT 'Formal mas amigável',
    formality_level VARCHAR(20) DEFAULT 'business' CHECK (formality_level IN ('casual', 'business', 'formal')),
    allow_emojis BOOLEAN DEFAULT false,
    custom_signature TEXT DEFAULT 'Atenciosamente,\nISA 2.5 - InovaPro',
    max_tokens INTEGER DEFAULT 1000,
    business_hours_start TIME DEFAULT '09:00',
    business_hours_end TIME DEFAULT '18:00',
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    enable_human_transfer BOOLEAN DEFAULT true,
    human_transfer_keywords TEXT[] DEFAULT ARRAY['atendente', 'humano', 'pessoa', 'atendimento', 'pessoal'],
    human_transfer_message TEXT DEFAULT 'Estou transferindo você para um de nossos atendentes humanos. Por favor, aguarde um momento.',
    max_response_time INTEGER DEFAULT 300,
    fallback_message TEXT DEFAULT 'Desculpe, não consegui processar sua mensagem. Por favor, tente novamente.',
    enable_typing_simulation BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de produtos do cliente
CREATE TABLE ia_memory_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ia_memory_id UUID REFERENCES ia_memory(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    features TEXT,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de FAQs
CREATE TABLE ia_memory_faqs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ia_memory_id UUID REFERENCES ia_memory(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de triggers
CREATE TABLE ia_memory_triggers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ia_memory_id UUID REFERENCES ia_memory(id) ON DELETE CASCADE,
    trigger_word VARCHAR(100) NOT NULL,
    response TEXT NOT NULL,
    attachment_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de histórico de mensagens
CREATE TABLE client_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    message_content TEXT NOT NULL,
    response_content TEXT,
    message_type VARCHAR(20) DEFAULT 'text',
    direction VARCHAR(10) DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
    processed_by_ia BOOLEAN DEFAULT true,
    ia_source VARCHAR(20) DEFAULT 'groq',
    processing_time_ms INTEGER,
    tokens_used INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_clients_whatsapp_phone ON clients(whatsapp_phone);
CREATE INDEX idx_clients_is_active ON clients(is_active);
CREATE INDEX idx_ia_memory_client_id ON ia_memory(client_id);
CREATE INDEX idx_ia_memory_is_active ON ia_memory(is_active);
CREATE INDEX idx_ia_memory_products_ia_memory_id ON ia_memory_products(ia_memory_id);
CREATE INDEX idx_ia_memory_faqs_ia_memory_id ON ia_memory_faqs(ia_memory_id);
CREATE INDEX idx_ia_memory_triggers_ia_memory_id ON ia_memory_triggers(ia_memory_id);
CREATE INDEX idx_client_messages_client_id ON client_messages(client_id);
CREATE INDEX idx_client_messages_phone_number ON client_messages(phone_number);
CREATE INDEX idx_client_messages_created_at ON client_messages(created_at);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ia_memory_updated_at BEFORE UPDATE ON ia_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Dados de exemplo
INSERT INTO clients (name, email, whatsapp_phone, document) VALUES
('João Silva', 'joao@empresa.com', '5511999999999', '12345678901'),
('Maria Santos', 'maria@empresa.com', '5511888888888', '98765432109');

INSERT INTO ia_memory (client_id, memory_name, personality, tone, formality_level, allow_emojis, custom_signature) VALUES
((SELECT id FROM clients WHERE whatsapp_phone = '5511999999999'), 'João - Vendas', 'Profissional e orientado a vendas', 'Empreendedor e motivador', 'business', true, 'Atenciosamente,\nJoão Silva - Consultor de Vendas'),
((SELECT id FROM clients WHERE whatsapp_phone = '5511888888888'), 'Maria - Suporte', 'Técnica e detalhista', 'Clara e objetiva', 'business', false, 'Atenciosamente,\nMaria Santos - Suporte Técnico');

INSERT INTO ia_memory_products (ia_memory_id, product_name, description, price, features, category) VALUES
((SELECT id FROM ia_memory WHERE memory_name = 'João - Vendas'), 'Consultoria Empresarial', 'Consultoria completa para pequenas empresas', 5000.00, 'Análise de processos, plano de ação, acompanhamento mensal', 'Serviços'),
((SELECT id FROM ia_memory WHERE memory_name = 'João - Vendas'), 'Curso de Gestão', 'Curso online de gestão empresarial', 997.00, '40 horas de conteúdo, certificado, suporte', 'Educação');

INSERT INTO ia_memory_faqs (ia_memory_id, question, answer, category) VALUES
((SELECT id FROM ia_memory WHERE memory_name = 'João - Vendas'), 'Qual o prazo de entrega da consultoria?', 'A consultoria tem duração de 30 dias, com início em até 5 dias úteis após a contratação.', 'Serviços'),
((SELECT id FROM ia_memory WHERE memory_name = 'João - Vendas'), 'O curso tem certificado?', 'Sim, o curso oferece certificado de conclusão reconhecido pelo MEC.', 'Educação'),
((SELECT id FROM ia_memory WHERE memory_name = 'Maria - Suporte'), 'Como faço para resetar minha senha?', 'Para resetar sua senha, acesse a página de login e clique em "Esqueci minha senha".', 'Suporte');

INSERT INTO ia_memory_triggers (ia_memory_id, trigger_word, response) VALUES
((SELECT id FROM ia_memory WHERE memory_name = 'João - Vendas'), 'preço', 'Nossos preços variam conforme o serviço. Posso enviar nossa tabela de preços?'),
((SELECT id FROM ia_memory WHERE memory_name = 'João - Vendas'), 'desconto', 'Temos descontos especiais para pagamentos à vista ou contratos anuais!'),
((SELECT id FROM ia_memory WHERE memory_name = 'Maria - Suporte'), 'problema', 'Entendo que você está enfrentando um problema. Posso ajudar a resolver. Por favor, me conte mais detalhes.');

-- Enable Row Level Security (RLS)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_memory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_memory_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_memory_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_messages ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança (exemplo - ajustar conforme necessário)
CREATE POLICY "Enable read for authenticated users" ON clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read for authenticated users" ON ia_memory FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read for authenticated users" ON ia_memory_products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read for authenticated users" ON ia_memory_faqs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read for authenticated users" ON ia_memory_triggers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for service role" ON client_messages FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Enable read for service role" ON client_messages FOR SELECT USING (auth.role() = 'service_role');