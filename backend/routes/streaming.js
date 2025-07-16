const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');
const { WowzaStreamingService } = require('../config/WowzaStreamingService');

const router = express.Router();
const wowzaService = new WowzaStreamingService();

// GET /api/streaming/status - Verifica status da transmissão
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Buscar transmissão ativa
    const [transmissionRows] = await db.execute(
      `SELECT 
        t.codigo as id,
        t.titulo,
        t.status,
        t.data_inicio,
        t.codigo_playlist,
        t.wowza_stream_id
       FROM transmissoes t
       WHERE t.codigo_stm = ? AND t.status = 'ativa'
       ORDER BY t.data_inicio DESC
       LIMIT 1`,
      [userId]
    );

    if (transmissionRows.length === 0) {
      return res.json({
        success: true,
        is_live: false,
        transmission: null
      });
    }

    const transmission = transmissionRows[0];

    // Buscar estatísticas do Wowza
    const stats = await wowzaService.getStreamStats(transmission.wowza_stream_id);

    // Buscar plataformas conectadas
    const [platformRows] = await db.execute(
      `SELECT 
        tp.status,
        up.platform_id,
        p.nome,
        p.codigo
       FROM transmissoes_plataformas tp
       JOIN user_platforms up ON tp.user_platform_id = up.codigo
       JOIN plataformas p ON up.platform_id = p.codigo
       WHERE tp.transmissao_id = ?`,
      [transmission.id]
    );

    res.json({
      success: true,
      is_live: true,
      transmission: {
        ...transmission,
        stats: {
          viewers: stats.viewers,
          bitrate: stats.bitrate,
          uptime: stats.uptime,
          isActive: stats.isActive
        },
        platforms: platformRows.map(p => ({
          user_platform: {
            platform: {
              nome: p.nome,
              codigo: p.codigo
            }
          },
          status: p.status
        }))
      }
    });
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// POST /api/streaming/start - Inicia transmissão
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const {
      titulo,
      descricao,
      playlist_id,
      platform_ids = [],
      id_transmission_settings,
      settings = {}
    } = req.body;

    const userId = req.user.id;

    if (!titulo || !playlist_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Título e playlist são obrigatórios' 
      });
    }

    // Verificar se já há transmissão ativa
    const [activeTransmission] = await db.execute(
      'SELECT codigo FROM transmissoes WHERE codigo_stm = ? AND status = "ativa"',
      [userId]
    );

    if (activeTransmission.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Já existe uma transmissão ativa'
      });
    }

    // Buscar vídeos da playlist
    const [playlistVideos] = await db.execute(
      `SELECT pv.*, pv.video as nome, pv.path_video as url
       FROM playlists_videos pv
       WHERE pv.codigo_playlist = ?
       ORDER BY pv.ordem`,
      [playlist_id]
    );

    if (playlistVideos.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Playlist não possui vídeos'
      });
    }

    // Buscar plataformas selecionadas
    const platforms = [];
    if (platform_ids.length > 0) {
      const [platformRows] = await db.execute(
        `SELECT up.*, p.nome, p.codigo, p.rtmp_base_url
         FROM user_platforms up
         JOIN plataformas p ON up.platform_id = p.codigo
         WHERE up.codigo IN (${platform_ids.map(() => '?').join(',')}) AND up.codigo_stm = ?`,
        [...platform_ids, userId]
      );
      platforms.push(...platformRows);
    }

    // Gerar ID único para o stream
    const streamId = `stream_${userId}_${Date.now()}`;

    // Iniciar stream no Wowza
    const wowzaResult = await wowzaService.startStream({
      streamId,
      userId,
      playlistId: playlist_id,
      videos: playlistVideos,
      platforms: platforms.map(p => ({
        platform: { codigo: p.codigo, nome: p.nome, rtmp_base_url: p.rtmp_base_url },
        rtmp_url: p.rtmp_url,
        stream_key: p.stream_key
      }))
    });

    if (!wowzaResult.success) {
      return res.status(500).json({
        success: false,
        error: wowzaResult.error || 'Erro ao iniciar stream no Wowza'
      });
    }

    // Salvar transmissão no banco
    const [transmissionResult] = await db.execute(
      `INSERT INTO transmissoes (
        codigo_stm, titulo, descricao, codigo_playlist, 
        wowza_stream_id, status, data_inicio, settings
      ) VALUES (?, ?, ?, ?, ?, 'ativa', NOW(), ?)`,
      [
        userId, 
        titulo, 
        descricao || '', 
        playlist_id, 
        streamId,
        JSON.stringify(settings)
      ]
    );

    const transmissionId = transmissionResult.insertId;

    // Salvar plataformas conectadas
    for (const platformId of platform_ids) {
      await db.execute(
        `INSERT INTO transmissoes_plataformas (
          transmissao_id, user_platform_id, status
        ) VALUES (?, ?, 'conectando')`,
        [transmissionId, platformId]
      );
    }

    res.json({
      success: true,
      transmission: {
        id: transmissionId,
        titulo,
        wowza_stream_id: streamId
      },
      wowza_data: wowzaResult.data
    });

  } catch (error) {
    console.error('Erro ao iniciar transmissão:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// POST /api/streaming/stop - Para transmissão
router.post('/stop', authMiddleware, async (req, res) => {
  try {
    const { transmission_id } = req.body;
    const userId = req.user.id;

    // Buscar transmissão
    const [transmissionRows] = await db.execute(
      'SELECT * FROM transmissoes WHERE codigo = ? AND codigo_stm = ? AND status = "ativa"',
      [transmission_id, userId]
    );

    if (transmissionRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transmissão não encontrada ou já finalizada'
      });
    }

    const transmission = transmissionRows[0];

    // Parar stream no Wowza
    const wowzaResult = await wowzaService.stopStream(transmission.wowza_stream_id);

    // Atualizar status no banco
    await db.execute(
      'UPDATE transmissoes SET status = "finalizada", data_fim = NOW() WHERE codigo = ?',
      [transmission_id]
    );

    // Atualizar status das plataformas
    await db.execute(
      'UPDATE transmissoes_plataformas SET status = "desconectada" WHERE transmissao_id = ?',
      [transmission_id]
    );

    res.json({
      success: true,
      message: 'Transmissão finalizada com sucesso',
      wowza_result: wowzaResult
    });

  } catch (error) {
    console.error('Erro ao parar transmissão:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// GET /api/streaming/platforms - Lista plataformas disponíveis
router.get('/platforms', authMiddleware, async (req, res) => {
  try {
    const [platforms] = await db.execute(
      `SELECT codigo as id, nome, codigo, rtmp_base_url, requer_stream_key
       FROM plataformas 
       WHERE ativo = 1
       ORDER BY nome`
    );

    res.json({
      success: true,
      platforms
    });
  } catch (error) {
    console.error('Erro ao buscar plataformas:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// GET /api/streaming/user-platforms - Lista plataformas do usuário
router.get('/user-platforms', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [platforms] = await db.execute(
      `SELECT 
        up.codigo as id,
        up.platform_id as id_platform,
        up.stream_key,
        up.rtmp_url,
        up.titulo_padrao,
        up.descricao_padrao,
        up.ativo,
        p.nome,
        p.codigo,
        p.rtmp_base_url,
        p.requer_stream_key
       FROM user_platforms up
       JOIN plataformas p ON up.platform_id = p.codigo
       WHERE up.codigo_stm = ?
       ORDER BY p.nome`,
      [userId]
    );

    res.json({
      success: true,
      platforms: platforms.map(p => ({
        ...p,
        platform: {
          id: p.codigo,
          nome: p.nome,
          codigo: p.codigo,
          rtmp_base_url: p.rtmp_base_url,
          requer_stream_key: p.requer_stream_key
        }
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar plataformas do usuário:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// POST /api/streaming/configure-platform - Configura plataforma
router.post('/configure-platform', authMiddleware, async (req, res) => {
  try {
    const {
      platform_id,
      stream_key,
      rtmp_url,
      titulo_padrao,
      descricao_padrao
    } = req.body;

    const userId = req.user.id;

    if (!platform_id || !stream_key) {
      return res.status(400).json({
        success: false,
        error: 'Platform ID e Stream Key são obrigatórios'
      });
    }

    // Verificar se plataforma existe
    const [platformRows] = await db.execute(
      'SELECT * FROM plataformas WHERE codigo = ?',
      [platform_id]
    );

    if (platformRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Plataforma não encontrada'
      });
    }

    // Verificar se usuário já tem esta plataforma configurada
    const [existingRows] = await db.execute(
      'SELECT codigo FROM user_platforms WHERE codigo_stm = ? AND platform_id = ?',
      [userId, platform_id]
    );

    if (existingRows.length > 0) {
      // Atualizar configuração existente
      await db.execute(
        `UPDATE user_platforms SET 
         stream_key = ?, rtmp_url = ?, titulo_padrao = ?, descricao_padrao = ?, ativo = 1
         WHERE codigo_stm = ? AND platform_id = ?`,
        [stream_key, rtmp_url || '', titulo_padrao || '', descricao_padrao || '', userId, platform_id]
      );
    } else {
      // Criar nova configuração
      await db.execute(
        `INSERT INTO user_platforms (
          codigo_stm, platform_id, stream_key, rtmp_url, 
          titulo_padrao, descricao_padrao, ativo
        ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [userId, platform_id, stream_key, rtmp_url || '', titulo_padrao || '', descricao_padrao || '']
      );
    }

    res.json({
      success: true,
      message: 'Plataforma configurada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao configurar plataforma:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// DELETE /api/streaming/user-platforms/:id - Remove plataforma
router.delete('/user-platforms/:id', authMiddleware, async (req, res) => {
  try {
    const platformId = req.params.id;
    const userId = req.user.id;

    const [result] = await db.execute(
      'DELETE FROM user_platforms WHERE codigo = ? AND codigo_stm = ?',
      [platformId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Plataforma não encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Plataforma removida com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover plataforma:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

module.exports = router;