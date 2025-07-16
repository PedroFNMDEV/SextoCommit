const express = require('express');
const bcrypt = require('bcrypt');
const { query, transaction } = require('../../config/database');
const { adminAuth, requireLevel, logAdminAction } = require('../../middlewares/adminAuth');

const router = express.Router();

// Listar todos os usuários com paginação e filtros
router.get('/', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const orderBy = req.query.orderBy || 'data_cadastro';
    const orderDir = req.query.orderDir || 'DESC';

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (search) {
      whereClause += ' AND (nome LIKE ? OR email LIKE ? OR id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClause += ' AND status_detalhado = ?';
      params.push(status);
    }

    // Query principal
    const usersQuery = `
      SELECT 
        codigo, id, nome, email, telefone, streamings, espectadores,
        espectadores_ilimitado, bitrate, bitrate_maximo, espaco, espaco_usado_mb,
        status, status_detalhado, data_cadastro, data_expiracao, ultimo_acesso_data, ultimo_acesso_ip,
        total_transmissoes, ultima_transmissao, observacoes_admin,
        (SELECT COUNT(*) FROM transmissoes WHERE codigo_stm = revendas.codigo) as transmissoes_realizadas,
        (SELECT COUNT(*) FROM playlists WHERE codigo_stm = revendas.codigo) as total_playlists,
        (SELECT COUNT(*) FROM user_platforms WHERE codigo_stm = revendas.codigo AND ativo = 1) as plataformas_configuradas
      FROM revendas 
      ${whereClause}
      ORDER BY ${orderBy} ${orderDir}
      LIMIT ? OFFSET ?
    `;

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM revendas 
      ${whereClause}
    `;

    const users = await query(usersQuery, [...params, limit, offset]);
    const countResult = await query(countQuery, params);
    const total = countResult[0].total;

    // Estatísticas gerais
    const statsQuery = `
      SELECT 
        COUNT(*) as total_usuarios,
        SUM(CASE WHEN status_detalhado = 'ativo' THEN 1 ELSE 0 END) as usuarios_ativos,
        SUM(CASE WHEN status_detalhado = 'suspenso' THEN 1 ELSE 0 END) as usuarios_suspensos,
        SUM(CASE WHEN data_expiracao IS NOT NULL AND data_expiracao < CURDATE() THEN 1 ELSE 0 END) as usuarios_expirados,
        SUM(COALESCE(espaco_usado_mb, 0)) as espaco_total_usado,
        AVG(espectadores) as media_espectadores
      FROM revendas
    `;

    const stats = await query(statsQuery);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: stats[0]
      }
    });

  } catch (error) {
    console.error('Admin users list error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar usuários'
    });
  }
});

// Obter detalhes de um usuário específico
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    const userQuery = `
      SELECT 
        r.*,
        a.nome as admin_criador_nome,
        (SELECT COUNT(*) FROM transmissoes WHERE codigo_stm = r.codigo) as total_transmissoes,
        (SELECT COUNT(*) FROM playlists WHERE codigo_stm = r.codigo) as total_playlists,
        (SELECT COUNT(*) FROM user_platforms WHERE codigo_stm = r.codigo AND ativo = 1) as plataformas_configuradas,
        (SELECT COUNT(*) FROM logos WHERE codigo_stm = r.codigo) as total_logos,
        (SELECT SUM(tamanho) FROM logos WHERE codigo_stm = r.codigo) as espaco_logos_usado
      FROM revendas r
      LEFT JOIN administradores a ON r.admin_criador = a.codigo
      WHERE r.codigo = ?
    `;

    const users = await query(userQuery, [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    const user = users[0];

    // Buscar transmissões recentes
    const transmissoesQuery = `
      SELECT titulo, status, data_inicio, data_fim, viewers_pico, duracao_segundos
      FROM transmissoes 
      WHERE codigo_stm = ? 
      ORDER BY data_inicio DESC 
      LIMIT 10
    `;

    const transmissoes = await query(transmissoesQuery, [userId]);

    // Buscar plataformas configuradas
    const plataformasQuery = `
      SELECT p.nome, p.codigo_plataforma, up.ativo, up.data_cadastro
      FROM user_platforms up
      JOIN plataformas p ON up.platform_id = p.codigo
      WHERE up.codigo_stm = ?
      ORDER BY up.data_cadastro DESC
    `;

    const plataformas = await query(plataformasQuery, [userId]);

    res.json({
      success: true,
      data: {
        user,
        transmissoes,
        plataformas
      }
    });

  } catch (error) {
    console.error('Admin user details error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar detalhes do usuário'
    });
  }
});

// Criar novo usuário
router.post('/', adminAuth, requireLevel('admin'), async (req, res) => {
  try {
    const {
      nome, email, senha, telefone, streamings, espectadores, espectadores_ilimitado,
      bitrate, bitrate_maximo, espaco, data_expiracao, observacoes_admin
    } = req.body;

    // Validações
    if (!nome || !email || !senha) {
      return res.status(400).json({
        success: false,
        error: 'Nome, email e senha são obrigatórios'
      });
    }

    if (senha.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Senha deve ter pelo menos 6 caracteres'
      });
    }

    // Verificar se email já existe
    const existingUsers = await query(
      'SELECT codigo FROM revendas WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email já está em uso'
      });
    }

    // Gerar ID único
    const generateId = () => Math.random().toString(36).substr(2, 6).toUpperCase();
    let userId = generateId();
    
    // Verificar se ID é único
    let idExists = true;
    while (idExists) {
      const existing = await query('SELECT codigo FROM revendas WHERE id = ?', [userId]);
      if (existing.length === 0) {
        idExists = false;
      } else {
        userId = generateId();
      }
    }

    // Criptografar senha
    const senhaCriptografada = await bcrypt.hash(senha, 10);

    // Criar usuário
    const result = await transaction(async (connection) => {
      const insertQuery = `
        INSERT INTO revendas (
          codigo_revenda, id, nome, email, telefone, senha, streamings, espectadores, 
          espectadores_ilimitado, bitrate, bitrate_maximo, espaco, data_expiracao,
          observacoes_admin, admin_criador, status, status_detalhado, data_cadastro,
          chave_api, dominio_padrao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'ativo', NOW(), ?, ?)
      `;

      const chaveApi = Math.random().toString(36).substr(2, 32);
      const dominioBase = process.env.DOMAIN_BASE || 'streaming.local';

      const [insertResult] = await connection.execute(insertQuery, [
        0, // codigo_revenda (0 para usuários diretos)
        userId,
        nome,
        email,
        telefone || null,
        senhaCriptografada,
        streamings || 1,
        espectadores || 100,
        espectadores_ilimitado ? 1 : 0,
        bitrate || 2500,
        bitrate_maximo || 5000,
        espaco || 1000,
        data_expiracao || null,
        observacoes_admin || null,
        req.admin.id,
        chaveApi,
        dominioBase
      ]);

      return insertResult.insertId;
    });

    // Log da ação
    await logAdminAction(
      req.admin.id, 
      'create_user', 
      'revendas', 
      result, 
      null, 
      { nome, email, streamings, espectadores, bitrate, espaco }, 
      req
    );

    res.json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: { id: result, userId }
    });

  } catch (error) {
    console.error('Admin create user error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar usuário'
    });
  }
});

// Atualizar usuário
router.put('/:id', adminAuth, requireLevel('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const {
      nome, email, telefone, streamings, espectadores, espectadores_ilimitado,
      bitrate, bitrate_maximo, espaco, status_detalhado, data_expiracao, observacoes_admin
    } = req.body;

    // Buscar dados atuais para log
    const currentData = await query(
      'SELECT * FROM revendas WHERE codigo = ?',
      [userId]
    );

    if (currentData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Verificar se email já existe (exceto para o usuário atual)
    if (email && email !== currentData[0].email) {
      const existingUsers = await query(
        'SELECT codigo FROM revendas WHERE email = ? AND codigo != ?',
        [email, userId]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Email já está em uso'
        });
      }
    }

    // Atualizar usuário
    const updateQuery = `
      UPDATE revendas SET 
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
        observacoes_admin = COALESCE(?, observacoes_admin),
        data_ultima_atualizacao = NOW()
      WHERE codigo = ?
    `;

    await query(updateQuery, [
      nome, email, telefone, streamings, espectadores,
      espectadores_ilimitado ? 1 : 0, bitrate, bitrate_maximo, espaco,
      status_detalhado, data_expiracao, observacoes_admin, userId
    ]);

    // Log da ação
    await logAdminAction(
      req.admin.id,
      'update_user',
      'revendas',
      userId,
      currentData[0],
      req.body,
      req
    );

    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso'
    });

  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar usuário'
    });
  }
});

// Suspender/Ativar usuário
router.patch('/:id/status', adminAuth, requireLevel('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { status_detalhado, motivo } = req.body;

    if (!['ativo', 'suspenso', 'cancelado'].includes(status_detalhado)) {
      return res.status(400).json({
        success: false,
        error: 'Status inválido'
      });
    }

    // Buscar dados atuais
    const currentData = await query(
      'SELECT status_detalhado, nome FROM revendas WHERE codigo = ?',
      [userId]
    );

    if (currentData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Atualizar status
    await query(
      'UPDATE revendas SET status_detalhado = ?, observacoes_admin = CONCAT(COALESCE(observacoes_admin, ""), "\n", NOW(), " - Status alterado para ", ?, " por ", ?, COALESCE(CONCAT(" - Motivo: ", ?), "")) WHERE codigo = ?',
      [status_detalhado, status_detalhado, req.admin.nome, motivo, userId]
    );

    // Log da ação
    await logAdminAction(
      req.admin.id,
      'change_user_status',
      'revendas',
      userId,
      { status_anterior: currentData[0].status_detalhado },
      { status_novo: status_detalhado, motivo },
      req
    );

    res.json({
      success: true,
      message: `Usuário ${status_detalhado === 'ativo' ? 'ativado' : status_detalhado} com sucesso`
    });

  } catch (error) {
    console.error('Admin change user status error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao alterar status do usuário'
    });
  }
});

// Resetar senha do usuário
router.post('/:id/reset-password', adminAuth, requireLevel('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { nova_senha } = req.body;

    if (!nova_senha || nova_senha.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Nova senha deve ter pelo menos 6 caracteres'
      });
    }

    // Buscar usuário
    const users = await query(
      'SELECT nome FROM revendas WHERE codigo = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Criptografar nova senha
    const senhaCriptografada = await bcrypt.hash(nova_senha, 10);

    // Atualizar senha
    await query(
      'UPDATE revendas SET senha = ? WHERE codigo = ?',
      [senhaCriptografada, userId]
    );

    // Log da ação
    await logAdminAction(
      req.admin.id,
      'reset_user_password',
      'revendas',
      userId,
      null,
      { usuario: users[0].nome },
      req
    );

    res.json({
      success: true,
      message: 'Senha resetada com sucesso'
    });

  } catch (error) {
    console.error('Admin reset user password error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao resetar senha'
    });
  }
});

// Excluir usuário (soft delete)
router.delete('/:id', adminAuth, requireLevel('super_admin'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Buscar dados do usuário
    const users = await query(
      'SELECT nome, email FROM revendas WHERE codigo = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Marcar como cancelado ao invés de excluir
    await query(
      'UPDATE revendas SET status_detalhado = "cancelado", observacoes_admin = CONCAT(COALESCE(observacoes_admin, ""), "\n", NOW(), " - Conta cancelada por ", ?) WHERE codigo = ?',
      [req.admin.nome, userId]
    );

    // Log da ação
    await logAdminAction(
      req.admin.id,
      'delete_user',
      'revendas',
      userId,
      users[0],
      null,
      req
    );

    res.json({
      success: true,
      message: 'Usuário cancelado com sucesso'
    });

  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao cancelar usuário'
    });
  }
});

module.exports = router;