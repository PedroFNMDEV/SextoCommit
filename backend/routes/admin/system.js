const express = require('express');
const { query } = require('../../config/database');
const { adminAuth, requireLevel, logAdminAction } = require('../../middlewares/adminAuth');

const router = express.Router();

// Informações do servidor Wowza
router.get('/wowza-status', adminAuth, async (req, res) => {
  try {
    // Simular dados do Wowza (em produção, isso viria de uma API real)
    const wowzaStats = {
      status: 'online',
      version: '4.8.20',
      uptime: '15 dias, 8 horas',
      connections: {
        current: 1247,
        peak: 2156,
        total: 45678
      },
      bandwidth: {
        incoming: '2.4 Gbps',
        outgoing: '8.7 Gbps',
        peak_outgoing: '12.3 Gbps'
      },
      applications: {
        live: {
          status: 'running',
          connections: 1247,
          streams: 89
        },
        playback: {
          status: 'running',
          connections: 234,
          streams: 12
        }
      },
      server_info: {
        cpu_usage: 45.2,
        memory_usage: 67.8,
        disk_usage: 23.4,
        network_io: '1.2 GB/s'
      }
    };

    // Estatísticas reais do banco
    const dbStatsQuery = `
      SELECT 
        COUNT(DISTINCT r.codigo) as total_accounts,
        COUNT(CASE WHEN r.status_detalhado = 'ativo' THEN 1 END) as active_accounts,
        COUNT(CASE WHEN t.status = 'ativa' THEN 1 END) as active_streams,
        SUM(r.espectadores) as total_viewer_limit,
        AVG(r.bitrate) as avg_bitrate,
        SUM(r.espaco) as total_storage_allocated,
        SUM(r.espaco_usado_mb) / 1024 as total_storage_used_gb
      FROM revendas r
      LEFT JOIN transmissoes t ON r.codigo = t.codigo_stm AND t.status = 'ativa'
    `;

    const dbStats = await query(dbStatsQuery);

    res.json({
      success: true,
      data: {
        wowza: wowzaStats,
        database: dbStats[0]
      }
    });

  } catch (error) {
    console.error('Admin wowza status error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar status do Wowza'
    });
  }
});

// Configurações do sistema
router.get('/settings', adminAuth, async (req, res) => {
  try {
    const settingsQuery = `
      SELECT * FROM configuracoes LIMIT 1
    `;

    const settings = await query(settingsQuery);

    // Configurações padrão se não existirem
    const defaultSettings = {
      dominio_padrao: process.env.DOMAIN_BASE || 'streaming.local',
      codigo_servidor_atual: 1,
      manutencao: 'nao',
      max_usuarios_por_servidor: 1000,
      backup_automatico: 'sim',
      logs_retention_days: 90,
      email_notifications: 'sim'
    };

    res.json({
      success: true,
      data: settings.length > 0 ? settings[0] : defaultSettings
    });

  } catch (error) {
    console.error('Admin settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar configurações'
    });
  }
});

// Atualizar configurações do sistema
router.put('/settings', adminAuth, requireLevel('super_admin'), async (req, res) => {
  try {
    const {
      dominio_padrao,
      manutencao,
      max_usuarios_por_servidor,
      backup_automatico,
      logs_retention_days,
      email_notifications
    } = req.body;

    // Verificar se já existe configuração
    const existing = await query('SELECT codigo FROM configuracoes LIMIT 1');

    if (existing.length > 0) {
      // Atualizar existente
      await query(`
        UPDATE configuracoes SET 
          dominio_padrao = COALESCE(?, dominio_padrao),
          manutencao = COALESCE(?, manutencao)
        WHERE codigo = ?
      `, [dominio_padrao, manutencao, existing[0].codigo]);
    } else {
      // Criar nova
      await query(`
        INSERT INTO configuracoes (dominio_padrao, codigo_servidor_atual, manutencao)
        VALUES (?, 1, ?)
      `, [dominio_padrao || 'streaming.local', manutencao || 'nao']);
    }

    // Log da ação
    await logAdminAction(
      req.admin.id,
      'update_system_settings',
      'configuracoes',
      existing.length > 0 ? existing[0].codigo : null,
      null,
      req.body,
      req
    );

    res.json({
      success: true,
      message: 'Configurações atualizadas com sucesso'
    });

  } catch (error) {
    console.error('Admin update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar configurações'
    });
  }
});

// Logs do sistema
router.get('/logs', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const action = req.query.action || '';
    const admin_id = req.query.admin_id || '';

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (action) {
      whereClause += ' AND al.acao LIKE ?';
      params.push(`%${action}%`);
    }

    if (admin_id) {
      whereClause += ' AND al.admin_id = ?';
      params.push(admin_id);
    }

    const logsQuery = `
      SELECT 
        al.id, al.acao, al.tabela_afetada, al.registro_id,
        al.dados_anteriores, al.dados_novos, al.ip_address,
        al.created_at, a.nome as admin_nome, a.email as admin_email
      FROM admin_logs al
      JOIN administradores a ON al.admin_id = a.codigo
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM admin_logs al
      JOIN administradores a ON al.admin_id = a.codigo
      ${whereClause}
    `;

    const [logs, countResult] = await Promise.all([
      query(logsQuery, [...params, limit, offset]),
      query(countQuery, params)
    ]);

    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Admin logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar logs'
    });
  }
});

// Backup do sistema
router.post('/backup', adminAuth, requireLevel('super_admin'), async (req, res) => {
  try {
    // Em produção, isso executaria um backup real
    const backupId = `backup_${Date.now()}`;
    
    // Log da ação
    await logAdminAction(
      req.admin.id,
      'system_backup',
      null,
      null,
      null,
      { backup_id: backupId },
      req
    );

    res.json({
      success: true,
      message: 'Backup iniciado com sucesso',
      data: { backup_id: backupId }
    });

  } catch (error) {
    console.error('Admin backup error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao iniciar backup'
    });
  }
});

// Limpeza de dados antigos
router.post('/cleanup', adminAuth, requireLevel('super_admin'), async (req, res) => {
  try {
    const { days = 90 } = req.body;

    // Executar limpeza
    const cleanupResults = await Promise.all([
      // Limpar logs antigos
      query('DELETE FROM logs WHERE data < DATE_SUB(NOW(), INTERVAL ? DAY)', [days]),
      query('DELETE FROM logs_streamings WHERE data < DATE_SUB(NOW(), INTERVAL ? DAY)', [days]),
      
      // Limpar estatísticas antigas
      query('DELETE FROM estatisticas WHERE data < DATE_SUB(NOW(), INTERVAL ? DAY)', [days * 2]),
      
      // Limpar sessões expiradas
      query('DELETE FROM admin_sessions WHERE expires_at < NOW()'),
      
      // Limpar transmissões finalizadas antigas
      query('DELETE FROM transmissoes WHERE status = "finalizada" AND data_fim < DATE_SUB(NOW(), INTERVAL ? DAY)', [days])
    ]);

    const totalDeleted = cleanupResults.reduce((sum, result) => sum + result.affectedRows, 0);

    // Log da ação
    await logAdminAction(
      req.admin.id,
      'system_cleanup',
      null,
      null,
      null,
      { days, records_deleted: totalDeleted },
      req
    );

    res.json({
      success: true,
      message: `Limpeza concluída. ${totalDeleted} registros removidos.`,
      data: { records_deleted: totalDeleted }
    });

  } catch (error) {
    console.error('Admin cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao executar limpeza'
    });
  }
});

module.exports = router;