const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos
app.use('/content', express.static(path.join(__dirname, 'content')));

// Configuração do banco de dados
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'streaming_system',
  charset: 'utf8mb4'
};

// Chave secreta para JWT
const JWT_SECRET = 'streaming_secret_key_2024';
const ADMIN_JWT_SECRET = 'admin_streaming_secret_key_2024';

// Função para criar conexão com o banco
async function createConnection() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    return connection;
  } catch (error) {
    console.error('Erro ao conectar com o banco:', error);
    throw error;
  }
}

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Middleware de autenticação admin
const authenticateAdminToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  jwt.verify(token, ADMIN_JWT_SECRET, (err, admin) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.admin = admin;
    next();
  });
};

// Inicializar banco de dados
async function initializeDatabase() {
  const connection = await createConnection();
  
  try {
    // Criar tabela de usuários
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        codigo INT AUTO_INCREMENT PRIMARY KEY,
        id VARCHAR(50) UNIQUE NOT NULL,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        telefone VARCHAR(20),
        streamings INT DEFAULT 1,
        espectadores INT DEFAULT 100,
        espectadores_ilimitado BOOLEAN DEFAULT FALSE,
        bitrate INT DEFAULT 2500,
        bitrate_maximo INT DEFAULT 5000,
        espaco INT DEFAULT 1000,
        espaco_usado_mb DECIMAL(10,2) DEFAULT 0,
        status INT DEFAULT 1,
        status_detalhado ENUM('ativo', 'suspenso', 'expirado', 'cancelado') DEFAULT 'ativo',
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_expiracao DATE NULL,
        ultimo_acesso_data TIMESTAMP NULL,
        ultimo_acesso_ip VARCHAR(45) NULL,
        observacoes_admin TEXT NULL,
        whmcs_user_id INT NULL,
        whmcs_service_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Criar tabela de administradores
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS administradores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        nivel_acesso ENUM('super_admin', 'admin', 'moderador') DEFAULT 'admin',
        ativo BOOLEAN DEFAULT TRUE,
        ultimo_acesso TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Criar tabela de transmissões
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS transmissoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        descricao TEXT,
        status ENUM('ativa', 'finalizada', 'pausada') DEFAULT 'ativa',
        data_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_fim TIMESTAMP NULL,
        viewers_atual INT DEFAULT 0,
        viewers_maximo INT DEFAULT 0,
        bitrate_atual INT DEFAULT 0,
        duracao_segundos INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(codigo) ON DELETE CASCADE
      )
    `);

    // Criar tabela de folders
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS folders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NOT NULL,
        nome VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(codigo) ON DELETE CASCADE
      )
    `);

    // Criar tabela de vídeos
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NOT NULL,
        id_folder INT NOT NULL,
        nome VARCHAR(255) NOT NULL,
        url VARCHAR(500),
        duracao INT DEFAULT 0,
        tamanho BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(codigo) ON DELETE CASCADE,
        FOREIGN KEY (id_folder) REFERENCES folders(id) ON DELETE CASCADE
      )
    `);

    // Criar tabela de playlists
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS playlists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NOT NULL,
        nome VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(codigo) ON DELETE CASCADE
      )
    `);

    // Criar tabela de playlist_videos
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS playlist_videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_playlist INT NOT NULL,
        id_video INT NOT NULL,
        ordem INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_playlist) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (id_video) REFERENCES videos(id) ON DELETE CASCADE
      )
    `);

    // Criar admin padrão se não existir
    const [adminExists] = await connection.execute(
      'SELECT id FROM administradores WHERE email = ?',
      ['admin@sistema.com']
    );

    if (adminExists.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await connection.execute(
        'INSERT INTO administradores (nome, email, senha, nivel_acesso) VALUES (?, ?, ?, ?)',
        ['Administrador', 'admin@sistema.com', hashedPassword, 'super_admin']
      );
      console.log('Admin padrão criado: admin@sistema.com / admin123');
    }

    console.log('Banco de dados inicializado com sucesso!');
  } catch (error) {
    console.error('Erro ao inicializar banco:', error);
  } finally {
    await connection.end();
  }
}

// ==================== ROTAS DE AUTENTICAÇÃO ADMIN ====================

// Login admin
app.post('/api/admin/auth/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email e senha são obrigatórios' 
    });
  }

  const connection = await createConnection();
  
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM administradores WHERE email = ? AND ativo = TRUE',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Credenciais inválidas' 
      });
    }

    const admin = rows[0];
    const validPassword = await bcrypt.compare(senha, admin.senha);

    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Credenciais inválidas' 
      });
    }

    // Atualizar último acesso
    await connection.execute(
      'UPDATE administradores SET ultimo_acesso = NOW() WHERE id = ?',
      [admin.id]
    );

    const token = jwt.sign(
      { 
        id: admin.id, 
        email: admin.email, 
        nivel_acesso: admin.nivel_acesso 
      },
      ADMIN_JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        nome: admin.nome,
        email: admin.email,
        nivel_acesso: admin.nivel_acesso
      }
    });

  } catch (error) {
    console.error('Erro no login admin:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  } finally {
    await connection.end();
  }
});

// Logout admin
app.post('/api/admin/auth/logout', authenticateAdminToken, async (req, res) => {
  res.json({ success: true, message: 'Logout realizado com sucesso' });
});

// ==================== ROTAS DO DASHBOARD ADMIN ====================

// Estatísticas do dashboard
app.get('/api/admin/dashboard/stats', authenticateAdminToken, async (req, res) => {
  const connection = await createConnection();
  
  try {
    // Estatísticas de usuários
    const [usuariosStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_usuarios,
        SUM(CASE WHEN status_detalhado = 'ativo' THEN 1 ELSE 0 END) as usuarios_ativos,
        SUM(CASE WHEN status_detalhado = 'suspenso' THEN 1 ELSE 0 END) as usuarios_suspensos,
        SUM(CASE WHEN status_detalhado = 'expirado' THEN 1 ELSE 0 END) as usuarios_expirados,
        SUM(CASE WHEN DATE(data_cadastro) >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) THEN 1 ELSE 0 END) as novos_usuarios_mes,
        SUM(CASE WHEN DATE(data_cadastro) >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK) THEN 1 ELSE 0 END) as novos_usuarios_semana,
        SUM(CASE WHEN ultimo_acesso_data >= DATE_SUB(NOW(), INTERVAL 1 WEEK) THEN 1 ELSE 0 END) as usuarios_ativos_semana
      FROM usuarios
    `);

    // Estatísticas de transmissões
    const [transmissoesStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_transmissoes,
        SUM(CASE WHEN status = 'ativa' THEN 1 ELSE 0 END) as transmissoes_ativas,
        SUM(CASE WHEN DATE(data_inicio) >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) THEN 1 ELSE 0 END) as transmissoes_mes,
        SUM(CASE WHEN DATE(data_inicio) >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK) THEN 1 ELSE 0 END) as transmissoes_semana,
        AVG(viewers_maximo) as media_viewers,
        SUM(duracao_segundos) as tempo_total_transmissao
      FROM transmissoes
    `);

    // Estatísticas de recursos
    const [recursosStats] = await connection.execute(`
      SELECT 
        SUM(espaco) as espaco_total_alocado,
        SUM(espaco_usado_mb) as espaco_total_usado,
        AVG(espectadores) as media_espectadores_limite,
        SUM(espectadores) as total_espectadores_limite,
        SUM(CASE WHEN espectadores_ilimitado = TRUE THEN 1 ELSE 0 END) as usuarios_espectadores_ilimitados,
        AVG(bitrate) as media_bitrate,
        MAX(bitrate_maximo) as maior_bitrate_maximo
      FROM usuarios
    `);

    // Usuários mais ativos
    const [usuariosAtivos] = await connection.execute(`
      SELECT 
        u.nome,
        u.email,
        u.id,
        COUNT(t.id) as total_transmissoes,
        MAX(t.data_inicio) as ultima_transmissao,
        SUM(t.duracao_segundos) as tempo_total,
        AVG(t.viewers_maximo) as media_viewers
      FROM usuarios u
      LEFT JOIN transmissoes t ON u.codigo = t.id_usuario
      WHERE u.status_detalhado = 'ativo'
      GROUP BY u.codigo
      ORDER BY total_transmissoes DESC, tempo_total DESC
      LIMIT 10
    `);

    // Crescimento mensal
    const [crescimentoMensal] = await connection.execute(`
      SELECT 
        DATE_FORMAT(data_cadastro, '%Y-%m') as mes,
        COUNT(*) as novos_usuarios
      FROM usuarios
      WHERE data_cadastro >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(data_cadastro, '%Y-%m')
      ORDER BY mes DESC
      LIMIT 12
    `);

    // Plataformas (simulado - você pode implementar uma tabela real)
    const plataformas = [
      { plataforma_nome: 'YouTube', codigo_plataforma: 'youtube', usuarios_configurados: 45, usuarios_ativos: 32 },
      { plataforma_nome: 'Facebook', codigo_plataforma: 'facebook', usuarios_configurados: 38, usuarios_ativos: 28 },
      { plataforma_nome: 'Instagram', codigo_plataforma: 'instagram', usuarios_configurados: 29, usuarios_ativos: 21 },
      { plataforma_nome: 'Twitch', codigo_plataforma: 'twitch', usuarios_configurados: 15, usuarios_ativos: 12 },
      { plataforma_nome: 'TikTok', codigo_plataforma: 'tiktok', usuarios_configurados: 8, usuarios_ativos: 6 }
    ];

    // Calcular resumo
    const usuarios = usuariosStats[0];
    const resumo = {
      taxa_crescimento_usuarios: usuarios.novos_usuarios_mes > 0 ? 
        ((usuarios.novos_usuarios_semana * 4) / usuarios.novos_usuarios_mes * 100) : 0,
      utilizacao_espaco: recursosStats[0].espaco_total_alocado > 0 ? 
        (recursosStats[0].espaco_total_usado / (recursosStats[0].espaco_total_alocado * 1024) * 100) : 0,
      tempo_medio_transmissao: transmissoesStats[0].total_transmissoes > 0 ? 
        (transmissoesStats[0].tempo_total_transmissao / transmissoesStats[0].total_transmissoes) : 0
    };

    res.json({
      success: true,
      data: {
        usuarios: usuariosStats[0],
        transmissoes: transmissoesStats[0],
        recursos: recursosStats[0],
        plataformas,
        usuarios_ativos: usuariosAtivos,
        crescimento_mensal: crescimentoMensal,
        resumo
      }
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao carregar estatísticas' 
    });
  } finally {
    await connection.end();
  }
});

// ==================== ROTAS DE GERENCIAMENTO DE USUÁRIOS ====================

// Listar usuários com filtros e paginação
app.get('/api/admin/users', authenticateAdminToken, async (req, res) => {
  const connection = await createConnection();
  
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      orderBy = 'data_cadastro',
      orderDir = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Construir WHERE clause
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (nome LIKE ? OR email LIKE ? OR id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      whereClause += ' AND status_detalhado = ?';
      params.push(status);
    }

    // Buscar usuários
    const [users] = await connection.execute(`
      SELECT 
        codigo, id, nome, email, telefone, streamings, espectadores, 
        espectadores_ilimitado, bitrate, bitrate_maximo, espaco, espaco_usado_mb,
        status, status_detalhado, data_cadastro, data_expiracao, 
        ultimo_acesso_data, ultimo_acesso_ip, observacoes_admin,
        whmcs_user_id, whmcs_service_id,
        (SELECT COUNT(*) FROM transmissoes WHERE id_usuario = usuarios.codigo) as transmissoes_realizadas,
        (SELECT COUNT(*) FROM playlists WHERE id_usuario = usuarios.codigo) as total_playlists,
        0 as plataformas_configuradas,
        (SELECT MAX(data_inicio) FROM transmissoes WHERE id_usuario = usuarios.codigo) as ultima_transmissao
      FROM usuarios 
      ${whereClause}
      ORDER BY ${orderBy} ${orderDir}
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    // Contar total
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total FROM usuarios ${whereClause}
    `, params);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(limit));

    // Estatísticas gerais
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_usuarios,
        SUM(CASE WHEN status_detalhado = 'ativo' THEN 1 ELSE 0 END) as usuarios_ativos,
        SUM(CASE WHEN status_detalhado = 'suspenso' THEN 1 ELSE 0 END) as usuarios_suspensos,
        SUM(CASE WHEN status_detalhado = 'expirado' THEN 1 ELSE 0 END) as usuarios_expirados,
        SUM(espaco_usado_mb) as espaco_total_usado,
        AVG(espectadores) as media_espectadores
      FROM usuarios
    `);

    res.json({
      success: true,
      data: {
        users,
        stats: stats[0],
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao carregar usuários' 
    });
  } finally {
    await connection.end();
  }
});

// Criar usuário
app.post('/api/admin/users', authenticateAdminToken, async (req, res) => {
  const connection = await createConnection();
  
  try {
    const {
      nome, email, senha, telefone, streamings = 1, espectadores = 100,
      espectadores_ilimitado = false, bitrate = 2500, bitrate_maximo = 5000,
      espaco = 1000, data_expiracao, observacoes_admin
    } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({
        success: false,
        error: 'Nome, email e senha são obrigatórios'
      });
    }

    // Verificar se email já existe
    const [existingUser] = await connection.execute(
      'SELECT codigo FROM usuarios WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email já está em uso'
      });
    }

    // Gerar ID único
    const userId = email.split('@')[0] + '_' + Date.now();
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(senha, 10);

    // Inserir usuário
    const [result] = await connection.execute(`
      INSERT INTO usuarios (
        id, nome, email, senha, telefone, streamings, espectadores,
        espectadores_ilimitado, bitrate, bitrate_maximo, espaco,
        data_expiracao, observacoes_admin, status_detalhado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo')
    `, [
      userId, nome, email, hashedPassword, telefone, streamings, espectadores,
      espectadores_ilimitado, bitrate, bitrate_maximo, espaco,
      data_expiracao || null, observacoes_admin || null
    ]);

    // Criar pasta padrão para o usuário
    await connection.execute(
      'INSERT INTO folders (id_usuario, nome) VALUES (?, ?)',
      [result.insertId, 'Vídeos']
    );

    res.json({
      success: true,
      message: 'Usuário criado com sucesso',
      user_id: result.insertId
    });

  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar usuário'
    });
  } finally {
    await connection.end();
  }
});

// Atualizar usuário
app.put('/api/admin/users/:id', authenticateAdminToken, async (req, res) => {
  const connection = await createConnection();
  
  try {
    const userId = req.params.id;
    const {
      nome, email, telefone, streamings, espectadores, espectadores_ilimitado,
      bitrate, bitrate_maximo, espaco, status_detalhado, data_expiracao,
      observacoes_admin
    } = req.body;

    // Verificar se usuário existe
    const [existingUser] = await connection.execute(
      'SELECT codigo FROM usuarios WHERE codigo = ?',
      [userId]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Verificar se email já está em uso por outro usuário
    if (email) {
      const [emailCheck] = await connection.execute(
        'SELECT codigo FROM usuarios WHERE email = ? AND codigo != ?',
        [email, userId]
      );

      if (emailCheck.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Email já está em uso por outro usuário'
        });
      }
    }

    // Atualizar usuário
    await connection.execute(`
      UPDATE usuarios SET
        nome = COALESCE(?, nome),
        email = COALESCE(?, email),
        telefone = COALESCE(?, telefone),
        streamings = COALESCE(?, streamings),
        espectadores = COALESCE(?, espectadores),
        espectadores_ilimitado = COALESCE(?, espectadores_ilimitado),
        bitrate = COALESCE(?, bitrate),
        bitrate_maximo = COALESCE(?, bitrate_maximo),
        espaco = COALESCE(?, espaco),
        status_detalhado = COALESCE(?, status_detalhado),
        data_expiracao = ?,
        observacoes_admin = ?,
        updated_at = NOW()
      WHERE codigo = ?
    `, [
      nome, email, telefone, streamings, espectadores, espectadores_ilimitado,
      bitrate, bitrate_maximo, espaco, status_detalhado,
      data_expiracao || null, observacoes_admin || null, userId
    ]);

    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar usuário'
    });
  } finally {
    await connection.end();
  }
});

// Alterar status do usuário
app.patch('/api/admin/users/:id/status', authenticateAdminToken, async (req, res) => {
  const connection = await createConnection();
  
  try {
    const userId = req.params.id;
    const { status_detalhado, motivo } = req.body;

    if (!['ativo', 'suspenso', 'expirado', 'cancelado'].includes(status_detalhado)) {
      return res.status(400).json({
        success: false,
        error: 'Status inválido'
      });
    }

    // Atualizar status
    await connection.execute(`
      UPDATE usuarios SET
        status_detalhado = ?,
        observacoes_admin = CONCAT(COALESCE(observacoes_admin, ''), '\n[', NOW(), '] Status alterado para: ', ?, COALESCE(CONCAT(' - Motivo: ', ?), '')),
        updated_at = NOW()
      WHERE codigo = ?
    `, [status_detalhado, status_detalhado, motivo, userId]);

    res.json({
      success: true,
      message: `Status alterado para ${status_detalhado} com sucesso`
    });

  } catch (error) {
    console.error('Erro ao alterar status:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao alterar status'
    });
  } finally {
    await connection.end();
  }
});

// Resetar senha do usuário
app.post('/api/admin/users/:id/reset-password', authenticateAdminToken, async (req, res) => {
  const connection = await createConnection();
  
  try {
    const userId = req.params.id;
    const { nova_senha } = req.body;

    if (!nova_senha || nova_senha.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Nova senha deve ter pelo menos 6 caracteres'
      });
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(nova_senha, 10);

    // Atualizar senha
    await connection.execute(`
      UPDATE usuarios SET
        senha = ?,
        observacoes_admin = CONCAT(COALESCE(observacoes_admin, ''), '\n[', NOW(), '] Senha resetada pelo admin'),
        updated_at = NOW()
      WHERE codigo = ?
    `, [hashedPassword, userId]);

    res.json({
      success: true,
      message: 'Senha resetada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao resetar senha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao resetar senha'
    });
  } finally {
    await connection.end();
  }
});

// ==================== INTEGRAÇÃO WHMCS ====================

// Endpoint para integração WHMCS - Criar usuário
app.post('/api/whmcs/create-user', async (req, res) => {
  const connection = await createConnection();
  
  try {
    const {
      whmcs_user_id,
      whmcs_service_id,
      nome,
      email,
      senha,
      telefone,
      streamings = 1,
      espectadores = 100,
      espectadores_ilimitado = false,
      bitrate = 2500,
      bitrate_maximo = 5000,
      espaco = 1000,
      data_expiracao
    } = req.body;

    // Validações básicas
    if (!whmcs_user_id || !whmcs_service_id || !nome || !email || !senha) {
      return res.status(400).json({
        success: false,
        error: 'Dados obrigatórios: whmcs_user_id, whmcs_service_id, nome, email, senha'
      });
    }

    // Verificar se já existe usuário com este email ou WHMCS IDs
    const [existingUser] = await connection.execute(`
      SELECT codigo FROM usuarios 
      WHERE email = ? OR whmcs_user_id = ? OR whmcs_service_id = ?
    `, [email, whmcs_user_id, whmcs_service_id]);

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Usuário já existe com este email ou IDs WHMCS'
      });
    }

    // Gerar ID único
    const userId = email.split('@')[0] + '_' + Date.now();
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(senha, 10);

    // Inserir usuário
    const [result] = await connection.execute(`
      INSERT INTO usuarios (
        id, nome, email, senha, telefone, streamings, espectadores,
        espectadores_ilimitado, bitrate, bitrate_maximo, espaco,
        data_expiracao, whmcs_user_id, whmcs_service_id, status_detalhado,
        observacoes_admin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo', 'Criado via WHMCS')
    `, [
      userId, nome, email, hashedPassword, telefone, streamings, espectadores,
      espectadores_ilimitado, bitrate, bitrate_maximo, espaco,
      data_expiracao || null, whmcs_user_id, whmcs_service_id
    ]);

    // Criar pasta padrão para o usuário
    await connection.execute(
      'INSERT INTO folders (id_usuario, nome) VALUES (?, ?)',
      [result.insertId, 'Vídeos']
    );

    res.json({
      success: true,
      message: 'Usuário criado com sucesso via WHMCS',
      user_id: result.insertId,
      streaming_user_id: userId
    });

  } catch (error) {
    console.error('Erro ao criar usuário via WHMCS:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    await connection.end();
  }
});

// Endpoint para integração WHMCS - Suspender usuário
app.post('/api/whmcs/suspend-user', async (req, res) => {
  const connection = await createConnection();
  
  try {
    const { whmcs_service_id, motivo = 'Suspenso via WHMCS' } = req.body;

    if (!whmcs_service_id) {
      return res.status(400).json({
        success: false,
        error: 'whmcs_service_id é obrigatório'
      });
    }

    // Buscar usuário
    const [user] = await connection.execute(
      'SELECT codigo FROM usuarios WHERE whmcs_service_id = ?',
      [whmcs_service_id]
    );

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Suspender usuário
    await connection.execute(`
      UPDATE usuarios SET
        status_detalhado = 'suspenso',
        observacoes_admin = CONCAT(COALESCE(observacoes_admin, ''), '\n[', NOW(), '] ', ?),
        updated_at = NOW()
      WHERE whmcs_service_id = ?
    `, [motivo, whmcs_service_id]);

    res.json({
      success: true,
      message: 'Usuário suspenso com sucesso'
    });

  } catch (error) {
    console.error('Erro ao suspender usuário via WHMCS:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    await connection.end();
  }
});

// Endpoint para integração WHMCS - Reativar usuário
app.post('/api/whmcs/unsuspend-user', async (req, res) => {
  const connection = await createConnection();
  
  try {
    const { whmcs_service_id, motivo = 'Reativado via WHMCS' } = req.body;

    if (!whmcs_service_id) {
      return res.status(400).json({
        success: false,
        error: 'whmcs_service_id é obrigatório'
      });
    }

    // Reativar usuário
    await connection.execute(`
      UPDATE usuarios SET
        status_detalhado = 'ativo',
        observacoes_admin = CONCAT(COALESCE(observacoes_admin, ''), '\n[', NOW(), '] ', ?),
        updated_at = NOW()
      WHERE whmcs_service_id = ?
    `, [motivo, whmcs_service_id]);

    res.json({
      success: true,
      message: 'Usuário reativado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao reativar usuário via WHMCS:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    await connection.end();
  }
});

// Endpoint para integração WHMCS - Cancelar usuário
app.post('/api/whmcs/terminate-user', async (req, res) => {
  const connection = await createConnection();
  
  try {
    const { whmcs_service_id, motivo = 'Cancelado via WHMCS' } = req.body;

    if (!whmcs_service_id) {
      return res.status(400).json({
        success: false,
        error: 'whmcs_service_id é obrigatório'
      });
    }

    // Cancelar usuário
    await connection.execute(`
      UPDATE usuarios SET
        status_detalhado = 'cancelado',
        observacoes_admin = CONCAT(COALESCE(observacoes_admin, ''), '\n[', NOW(), '] ', ?),
        updated_at = NOW()
      WHERE whmcs_service_id = ?
    `, [motivo, whmcs_service_id]);

    res.json({
      success: true,
      message: 'Usuário cancelado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao cancelar usuário via WHMCS:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    await connection.end();
  }
});

// ==================== ROTAS DE AUTENTICAÇÃO USUÁRIO ====================

// Login usuário
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const connection = await createConnection();
  
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM usuarios WHERE email = ? AND status_detalhado = "ativo"',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.senha);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Atualizar último acesso
    await connection.execute(
      'UPDATE usuarios SET ultimo_acesso_data = NOW(), ultimo_acesso_ip = ? WHERE codigo = ?',
      [req.ip, user.codigo]
    );

    const token = jwt.sign(
      { id: user.codigo, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.codigo,
        nome: user.nome,
        email: user.email,
        streamings: user.streamings,
        espectadores: user.espectadores,
        bitrate: user.bitrate,
        espaco: user.espaco
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    await connection.end();
  }
});

// Verificar token
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const connection = await createConnection();
  
  try {
    const [rows] = await connection.execute(
      'SELECT codigo, nome, email, streamings, espectadores, bitrate, espaco FROM usuarios WHERE codigo = ? AND status_detalhado = "ativo"',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = rows[0];
    res.json({
      id: user.codigo,
      nome: user.nome,
      email: user.email,
      streamings: user.streamings,
      espectadores: user.espectadores,
      bitrate: user.bitrate,
      espaco: user.espaco
    });

  } catch (error) {
    console.error('Erro ao verificar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    await connection.end();
  }
});

// ==================== ROTAS BÁSICAS PARA O SISTEMA ====================

// Listar folders do usuário
app.get('/api/folders', authenticateToken, async (req, res) => {
  const connection = await createConnection();
  
  try {
    const [folders] = await connection.execute(
      'SELECT id, nome FROM folders WHERE id_usuario = ? ORDER BY nome',
      [req.user.id]
    );

    res.json(folders);
  } catch (error) {
    console.error('Erro ao buscar folders:', error);
    res.status(500).json({ error: 'Erro ao carregar pastas' });
  } finally {
    await connection.end();
  }
});

// Criar folder
app.post('/api/folders', authenticateToken, async (req, res) => {
  const { nome } = req.body;
  
  if (!nome) {
    return res.status(400).json({ error: 'Nome da pasta é obrigatório' });
  }

  const connection = await createConnection();
  
  try {
    const [result] = await connection.execute(
      'INSERT INTO folders (id_usuario, nome) VALUES (?, ?)',
      [req.user.id, nome]
    );

    res.json({
      id: result.insertId,
      nome
    });
  } catch (error) {
    console.error('Erro ao criar folder:', error);
    res.status(500).json({ error: 'Erro ao criar pasta' });
  } finally {
    await connection.end();
  }
});

// Listar playlists do usuário
app.get('/api/playlists', authenticateToken, async (req, res) => {
  const connection = await createConnection();
  
  try {
    const [playlists] = await connection.execute(
      'SELECT id, nome FROM playlists WHERE id_usuario = ? ORDER BY nome',
      [req.user.id]
    );

    res.json(playlists);
  } catch (error) {
    console.error('Erro ao buscar playlists:', error);
    res.status(500).json({ error: 'Erro ao carregar playlists' });
  } finally {
    await connection.end();
  }
});

// Criar playlist
app.post('/api/playlists', authenticateToken, async (req, res) => {
  const { nome } = req.body;
  
  if (!nome) {
    return res.status(400).json({ error: 'Nome da playlist é obrigatório' });
  }

  const connection = await createConnection();
  
  try {
    const [result] = await connection.execute(
      'INSERT INTO playlists (id_usuario, nome) VALUES (?, ?)',
      [req.user.id, nome]
    );

    res.json({
      id: result.insertId,
      nome
    });
  } catch (error) {
    console.error('Erro ao criar playlist:', error);
    res.status(500).json({ error: 'Erro ao criar playlist' });
  } finally {
    await connection.end();
  }
});

// Inicializar servidor
async function startServer() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📊 Admin: http://localhost:3000/admin/login`);
      console.log(`👤 Login: admin@sistema.com / admin123`);
    });
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();