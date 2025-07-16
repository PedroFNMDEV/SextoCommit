const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');

const router = express.Router();

// POST /api/whmcs/webhook - Webhook do WHMCS
router.post('/webhook', async (req, res) => {
  try {
    const { action, data } = req.body;

    console.log('WHMCS Webhook recebido:', { action, data });

    switch (action) {
      case 'create_account':
        await handleCreateAccount(data);
        break;
      case 'suspend_account':
        await handleSuspendAccount(data);
        break;
      case 'unsuspend_account':
        await handleUnsuspendAccount(data);
        break;
      case 'terminate_account':
        await handleTerminateAccount(data);
        break;
      default:
        console.log('Ação não reconhecida:', action);
    }

    res.json({ success: true, message: 'Webhook processado com sucesso' });
  } catch (error) {
    console.error('Erro no webhook WHMCS:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Função para criar conta
async function handleCreateAccount(data) {
  const {
    client_id,
    service_id,
    domain,
    username,
    password,
    email,
    first_name,
    last_name,
    config_options
  } = data;

  try {
    // Gerar login único
    const login = username || `${first_name.toLowerCase()}${Math.floor(Math.random() * 9999)}`;
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Extrair configurações do produto
    const espectadores = config_options?.espectadores || 100;
    const bitrate = config_options?.bitrate || 2500;
    const espaco = config_options?.espaco_ftp || 1000;
    const aplicacao = config_options?.aplicacao || 'live';

    // Criar usuário na tabela revendas
    const [userResult] = await db.execute(
      `INSERT INTO revendas (
        codigo_revenda, id, nome, email, senha, streamings, espectadores,
        bitrate, espaco, subrevendas, chave_api, status, data_cadastro,
        dominio_padrao, ultimo_acesso_data, ultimo_acesso_ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), ?)`,
      [
        0, // codigo_revenda
        login.substring(0, 6).toUpperCase(), // id
        `${first_name} ${last_name}`, // nome
        email,
        hashedPassword,
        1, // streamings
        espectadores,
        bitrate,
        Math.floor(espaco / 1024), // converter MB para GB
        0, // subrevendas
        '', // chave_api
        1, // status ativo
        domain || '', // dominio_padrao
        '0.0.0.0' // ultimo_acesso_ip
      ]
    );

    const userId = userResult.insertId;

    // Criar streaming na tabela streamings
    await db.execute(
      `INSERT INTO streamings (
        codigo_cliente, codigo_servidor, login, senha, senha_transmissao,
        espectadores, bitrate, espaco, ftp_dir, identificacao, email,
        data_cadastro, aplicacao, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
      [
        userId, // codigo_cliente
        1, // codigo_servidor (servidor padrão)
        login,
        '', // senha (vazia por padrão)
        '', // senha_transmissao (vazia por padrão)
        espectadores,
        bitrate,
        espaco, // espaco em MB
        `/${login}`, // ftp_dir
        `${first_name} ${last_name}`, // identificacao
        email,
        aplicacao,
        1 // status ativo
      ]
    );

    console.log(`Conta criada com sucesso: ${login} (${email})`);

  } catch (error) {
    console.error('Erro ao criar conta:', error);
    throw error;
  }
}

// Função para suspender conta
async function handleSuspendAccount(data) {
  const { username, service_id } = data;

  try {
    // Suspender na tabela revendas
    await db.execute(
      'UPDATE revendas SET status = 0 WHERE id = ? OR email = ?',
      [username, username]
    );

    // Suspender na tabela streamings
    await db.execute(
      'UPDATE streamings SET status = 0 WHERE login = ? OR email = ?',
      [username, username]
    );

    console.log(`Conta suspensa: ${username}`);

  } catch (error) {
    console.error('Erro ao suspender conta:', error);
    throw error;
  }
}

// Função para reativar conta
async function handleUnsuspendAccount(data) {
  const { username, service_id } = data;

  try {
    // Reativar na tabela revendas
    await db.execute(
      'UPDATE revendas SET status = 1 WHERE id = ? OR email = ?',
      [username, username]
    );

    // Reativar na tabela streamings
    await db.execute(
      'UPDATE streamings SET status = 1 WHERE login = ? OR email = ?',
      [username, username]
    );

    console.log(`Conta reativada: ${username}`);

  } catch (error) {
    console.error('Erro ao reativar conta:', error);
    throw error;
  }
}

// Função para terminar conta
async function handleTerminateAccount(data) {
  const { username, service_id } = data;

  try {
    // Marcar como inativo ao invés de deletar (preservar dados)
    await db.execute(
      'UPDATE revendas SET status = 0 WHERE id = ? OR email = ?',
      [username, username]
    );

    await db.execute(
      'UPDATE streamings SET status = 0 WHERE login = ? OR email = ?',
      [username, username]
    );

    console.log(`Conta terminada: ${username}`);

  } catch (error) {
    console.error('Erro ao terminar conta:', error);
    throw error;
  }
}

// GET /api/whmcs/test - Endpoint de teste
router.get('/test', async (req, res) => {
  try {
    // Testar conexão com banco
    const [result] = await db.execute('SELECT COUNT(*) as count FROM revendas');
    
    res.json({
      success: true,
      message: 'WHMCS integration is working',
      database_connection: true,
      total_users: result[0].count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;