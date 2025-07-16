# Integração WHMCS - STM Video Advance

Este módulo integra o WHMCS com o sistema de streaming, permitindo criar, suspender e cancelar usuários automaticamente.

## Instalação

1. **Copie os arquivos para o WHMCS:**
   ```bash
   # Copie o arquivo principal do módulo
   cp stmvideoadvance.php /path/to/whmcs/modules/servers/stmvideoadvance/

   # Copie o template da área do cliente
   cp clientarea.tpl /path/to/whmcs/modules/servers/stmvideoadvance/
   ```

2. **Configure as permissões:**
   ```bash
   chmod 644 /path/to/whmcs/modules/servers/stmvideoadvance/stmvideoadvance.php
   chmod 644 /path/to/whmcs/modules/servers/stmvideoadvance/clientarea.tpl
   ```

## Configuração no WHMCS

### 1. Criar Produto/Serviço

1. Acesse **Setup → Products/Services → Products/Services**
2. Clique em **Create a New Group** (se necessário)
3. Clique em **Create a New Product**
4. Configure:
   - **Product Type:** Other
   - **Product Name:** Streaming Video Advance
   - **Module:** STM Video Advance

### 2. Configurar Módulo

Na aba **Module Settings** do produto, configure:

- **Quantidade de Streamings:** 1 (padrão)
- **Limite de Espectadores:** 100 (padrão)
- **Espectadores Ilimitados:** No (padrão)
- **Bitrate Padrão (kbps):** 2500 (padrão)
- **Bitrate Máximo (kbps):** 5000 (padrão)
- **Espaço de Armazenamento (GB):** 1000 (padrão)
- **URL da API do Sistema:** http://localhost:3001/api

### 3. Configurar Campos Personalizados (Opcional)

Você pode criar campos personalizados para coletar informações adicionais:

1. Acesse **Setup → Custom Fields**
2. Adicione campos como:
   - Nome do Canal
   - Categoria de Conteúdo
   - Observações Especiais

## Funcionamento

### Criação de Conta
Quando um cliente compra o serviço:
1. O WHMCS chama `stmvideoadvance_CreateAccount()`
2. O módulo envia os dados para `/api/whmcs/create-user`
3. O sistema cria o usuário com os recursos configurados
4. Uma pasta padrão "Vídeos" é criada automaticamente

### Suspensão
Quando uma conta é suspensa:
1. O WHMCS chama `stmvideoadvance_SuspendAccount()`
2. O módulo envia requisição para `/api/whmcs/suspend-user`
3. O usuário fica com status "suspenso" no sistema

### Reativação
Quando uma conta é reativada:
1. O WHMCS chama `stmvideoadvance_UnsuspendAccount()`
2. O módulo envia requisição para `/api/whmcs/unsuspend-user`
3. O usuário volta ao status "ativo"

### Cancelamento
Quando uma conta é cancelada:
1. O WHMCS chama `stmvideoadvance_TerminateAccount()`
2. O módulo envia requisição para `/api/whmcs/terminate-user`
3. O usuário fica com status "cancelado"

## API Endpoints

O sistema de streaming deve ter os seguintes endpoints:

### POST /api/whmcs/create-user
Cria um novo usuário via WHMCS.

**Parâmetros:**
```json
{
  "whmcs_user_id": 123,
  "whmcs_service_id": 456,
  "nome": "João Silva",
  "email": "joao@exemplo.com",
  "senha": "senha123",
  "telefone": "(11) 99999-9999",
  "streamings": 1,
  "espectadores": 100,
  "espectadores_ilimitado": false,
  "bitrate": 2500,
  "bitrate_maximo": 5000,
  "espaco": 1000,
  "data_expiracao": "2024-12-31"
}
```

### POST /api/whmcs/suspend-user
Suspende um usuário.

**Parâmetros:**
```json
{
  "whmcs_service_id": 456,
  "motivo": "Suspensão por falta de pagamento"
}
```

### POST /api/whmcs/unsuspend-user
Reativa um usuário suspenso.

**Parâmetros:**
```json
{
  "whmcs_service_id": 456,
  "motivo": "Reativação após pagamento"
}
```

### POST /api/whmcs/terminate-user
Cancela um usuário.

**Parâmetros:**
```json
{
  "whmcs_service_id": 456,
  "motivo": "Cancelamento solicitado pelo cliente"
}
```

## Logs

Todas as ações são registradas no log de atividades do WHMCS:
- Criação de usuários
- Suspensões e reativações
- Cancelamentos
- Erros de API

Para visualizar os logs:
1. Acesse **Utilities → Logs → Activity Log**
2. Filtre por "STM Video Advance"

## Troubleshooting

### Erro de Conexão
- Verifique se a URL da API está correta
- Confirme se o servidor de streaming está rodando
- Teste a conexão usando o botão "Testar Conexão"

### Usuário não criado
- Verifique os logs do WHMCS
- Confirme se todos os campos obrigatórios estão preenchidos
- Teste a API diretamente com curl

### Exemplo de teste com curl:
```bash
curl -X POST http://localhost:3001/api/whmcs/create-user \
  -H "Content-Type: application/json" \
  -d '{
    "whmcs_user_id": 123,
    "whmcs_service_id": 456,
    "nome": "Teste",
    "email": "teste@exemplo.com",
    "senha": "teste123"
  }'
```

## Personalização

### Modificar Template da Área do Cliente
Edite o arquivo `clientarea.tpl` para personalizar a aparência da área do cliente.

### Adicionar Campos de Configuração
Modifique a função `stmvideoadvance_ConfigOptions()` para adicionar novos campos.

### Customizar Ações
Adicione novas funções no módulo para implementar funcionalidades específicas.

## Suporte

Para suporte técnico:
1. Verifique os logs do WHMCS e do sistema de streaming
2. Teste a conectividade da API
3. Confirme se todas as configurações estão corretas
4. Entre em contato com o suporte técnico se necessário

## Versão

- **Versão:** 1.0
- **Compatibilidade:** WHMCS 7.0+
- **Última atualização:** 2024