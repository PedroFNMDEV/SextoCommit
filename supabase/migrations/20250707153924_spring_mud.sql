-- ========================================
-- SCRIPTS SQL PARA NOVAS TABELAS - MariaDB
-- Sistema de Streaming com Integração WHMCS
-- ========================================

USE `db_SamCast`;

-- ========================================
-- TABELA: plataformas
-- Armazena as plataformas de streaming disponíveis
-- ========================================
CREATE TABLE IF NOT EXISTS `plataformas` (
  `codigo` int(10) NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `codigo_plataforma` varchar(50) NOT NULL UNIQUE,
  `icone` varchar(100) NOT NULL DEFAULT 'activity',
  `rtmp_base_url` text NOT NULL,
  `requer_stream_key` tinyint(1) NOT NULL DEFAULT 1,
  `ativo` tinyint(1) NOT NULL DEFAULT 1,
  `data_cadastro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`codigo`),
  KEY `idx_codigo_plataforma` (`codigo_plataforma`),
  KEY `idx_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABELA: user_platforms
-- Configurações de plataformas por usuário
-- ========================================
CREATE TABLE IF NOT EXISTS `user_platforms` (
  `codigo` int(10) NOT NULL AUTO_INCREMENT,
  `codigo_stm` int(10) NOT NULL,
  `platform_id` int(10) NOT NULL,
  `stream_key` varchar(500) NOT NULL,
  `rtmp_url` varchar(500) DEFAULT NULL,
  `titulo_padrao` varchar(255) DEFAULT NULL,
  `descricao_padrao` text DEFAULT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT 1,
  `data_cadastro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`codigo`),
  KEY `idx_codigo_stm` (`codigo_stm`),
  KEY `idx_platform_id` (`platform_id`),
  UNIQUE KEY `unique_user_platform` (`codigo_stm`, `platform_id`),
  FOREIGN KEY (`codigo_stm`) REFERENCES `revendas`(`codigo`) ON DELETE CASCADE,
  FOREIGN KEY (`platform_id`) REFERENCES `plataformas`(`codigo`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABELA: transmissoes
-- Registro de transmissões realizadas
-- ========================================
CREATE TABLE IF NOT EXISTS `transmissoes` (
  `codigo` int(10) NOT NULL AUTO_INCREMENT,
  `codigo_stm` int(10) NOT NULL,
  `titulo` varchar(255) NOT NULL,
  `descricao` text DEFAULT NULL,
  `codigo_playlist` int(10) DEFAULT NULL,
  `wowza_stream_id` varchar(255) DEFAULT NULL,
  `status` enum('ativa','finalizada','erro') NOT NULL DEFAULT 'ativa',
  `data_inicio` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `data_fim` datetime DEFAULT NULL,
  `viewers_pico` int(10) DEFAULT 0,
  `duracao_segundos` int(10) DEFAULT 0,
  `settings` json DEFAULT NULL,
  PRIMARY KEY (`codigo`),
  KEY `idx_codigo_stm` (`codigo_stm`),
  KEY `idx_status` (`status`),
  KEY `idx_data_inicio` (`data_inicio`),
  FOREIGN KEY (`codigo_stm`) REFERENCES `revendas`(`codigo`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABELA: transmissoes_plataformas
-- Relaciona transmissões com plataformas
-- ========================================
CREATE TABLE IF NOT EXISTS `transmissoes_plataformas` (
  `codigo` int(10) NOT NULL AUTO_INCREMENT,
  `transmissao_id` int(10) NOT NULL,
  `user_platform_id` int(10) NOT NULL,
  `status` enum('conectando','ativa','erro','desconectada') NOT NULL DEFAULT 'conectando',
  `data_inicio` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `data_fim` datetime DEFAULT NULL,
  `erro_detalhes` text DEFAULT NULL,
  PRIMARY KEY (`codigo`),
  KEY `idx_transmissao_id` (`transmissao_id`),
  KEY `idx_user_platform_id` (`user_platform_id`),
  KEY `idx_status` (`status`),
  FOREIGN KEY (`transmissao_id`) REFERENCES `transmissoes`(`codigo`) ON DELETE CASCADE,
  FOREIGN KEY (`user_platform_id`) REFERENCES `user_platforms`(`codigo`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABELA: logos
-- Armazena logos para marca d'água
-- ========================================
CREATE TABLE IF NOT EXISTS `logos` (
  `codigo` int(10) NOT NULL AUTO_INCREMENT,
  `codigo_stm` int(10) NOT NULL,
  `nome` varchar(255) NOT NULL,
  `arquivo` varchar(500) NOT NULL,
  `tamanho` int(10) NOT NULL DEFAULT 0,
  `tipo_arquivo` varchar(100) DEFAULT NULL,
  `data_upload` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`codigo`),
  KEY `idx_codigo_stm` (`codigo_stm`),
  FOREIGN KEY (`codigo_stm`) REFERENCES `revendas`(`codigo`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABELA: transmission_settings
-- Configurações avançadas de transmissão
-- ========================================
CREATE TABLE IF NOT EXISTS `transmission_settings` (
  `codigo` int(10) NOT NULL AUTO_INCREMENT,
  `codigo_stm` int(10) NOT NULL,
  `nome` varchar(255) NOT NULL,
  `codigo_logo` int(10) DEFAULT NULL,
  `logo_posicao` enum('top-left','top-right','bottom-left','bottom-right','center') DEFAULT 'top-right',
  `logo_opacidade` int(3) DEFAULT 80,
  `logo_tamanho` enum('small','medium','large') DEFAULT 'medium',
  `logo_margem_x` int(5) DEFAULT 20,
  `logo_margem_y` int(5) DEFAULT 20,
  `embaralhar_videos` tinyint(1) DEFAULT 0,
  `repetir_playlist` tinyint(1) DEFAULT 1,
  `transicao_videos` enum('fade','cut','slide') DEFAULT 'fade',
  `resolucao` enum('720p','1080p','1440p','4k') DEFAULT '1080p',
  `fps` int(3) DEFAULT 30,
  `bitrate` int(6) DEFAULT 2500,
  `titulo_padrao` varchar(255) DEFAULT NULL,
  `descricao_padrao` text DEFAULT NULL,
  `data_criacao` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`codigo`),
  KEY `idx_codigo_stm` (`codigo_stm`),
  KEY `idx_codigo_logo` (`codigo_logo`),
  FOREIGN KEY (`codigo_stm`) REFERENCES `revendas`(`codigo`) ON DELETE CASCADE,
  FOREIGN KEY (`codigo_logo`) REFERENCES `logos`(`codigo`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABELA: comerciais_config
-- Configurações de inserção de comerciais
-- ========================================
CREATE TABLE IF NOT EXISTS `comerciais_config` (
  `codigo` int(10) NOT NULL AUTO_INCREMENT,
  `codigo_stm` int(10) NOT NULL,
  `codigo_playlist` int(10) NOT NULL,
  `codigo_pasta_comerciais` int(10) NOT NULL,
  `quantidade_comerciais` int(3) DEFAULT 1,
  `intervalo_videos` int(3) DEFAULT 3,
  `ativo` tinyint(1) DEFAULT 1,
  `data_criacao` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`codigo`),
  KEY `idx_codigo_stm` (`codigo_stm`),
  KEY `idx_codigo_playlist` (`codigo_playlist`),
  FOREIGN KEY (`codigo_stm`) REFERENCES `revendas`(`codigo`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABELA: user_settings
-- Configurações personalizadas do usuário
-- ========================================
CREATE TABLE IF NOT EXISTS `user_settings` (
  `codigo` int(10) NOT NULL AUTO_INCREMENT,
  `codigo_stm` int(10) NOT NULL,
  `menu_items` json DEFAULT NULL,
  `sidebar_collapsed` tinyint(1) DEFAULT 0,
  `notifications_enabled` tinyint(1) DEFAULT 1,
  `auto_refresh` tinyint(1) DEFAULT 1,
  `refresh_interval` int(5) DEFAULT 30,
  `language` varchar(10) DEFAULT 'pt-BR',
  `timezone` varchar(50) DEFAULT 'America/Sao_Paulo',
  `data_atualizacao` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`codigo`),
  UNIQUE KEY `unique_user_settings` (`codigo_stm`),
  FOREIGN KEY (`codigo_stm`) REFERENCES `revendas`(`codigo`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- MELHORIAS NAS TABELAS EXISTENTES
-- ========================================

-- Adicionar colunas na tabela playlists se não existirem
ALTER TABLE `playlists` 
ADD COLUMN IF NOT EXISTS `codigo_stm` int(10) DEFAULT NULL AFTER `nome`,
ADD COLUMN IF NOT EXISTS `descricao` text DEFAULT NULL AFTER `codigo_stm`,
ADD COLUMN IF NOT EXISTS `publica` tinyint(1) DEFAULT 0 AFTER `descricao`,
ADD COLUMN IF NOT EXISTS `total_videos` int(10) DEFAULT 0 AFTER `publica`,
ADD COLUMN IF NOT EXISTS `duracao_total` int(10) DEFAULT 0 AFTER `total_videos`;

-- Adicionar índices na tabela playlists
ALTER TABLE `playlists` 
ADD INDEX IF NOT EXISTS `idx_codigo_stm` (`codigo_stm`),
ADD INDEX IF NOT EXISTS `idx_publica` (`publica`);

-- Adicionar foreign key na tabela playlists (se não existir)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE 
                  WHERE TABLE_SCHEMA = 'db_SamCast' 
                  AND TABLE_NAME = 'playlists' 
                  AND CONSTRAINT_NAME = 'fk_playlists_stm');

SET @sql = IF(@fk_exists = 0, 
  'ALTER TABLE `playlists` ADD CONSTRAINT `fk_playlists_stm` FOREIGN KEY (`codigo_stm`) REFERENCES `revendas`(`codigo`) ON DELETE CASCADE',
  'SELECT "Foreign key already exists" as message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adicionar colunas na tabela revendas se não existirem
ALTER TABLE `revendas` 
ADD COLUMN IF NOT EXISTS `avatar` varchar(500) DEFAULT NULL AFTER `email`,
ADD COLUMN IF NOT EXISTS `telefone` varchar(20) DEFAULT NULL AFTER `avatar`,
ADD COLUMN IF NOT EXISTS `configuracoes` json DEFAULT NULL AFTER `refresh_token`;

-- ========================================
-- INSERIR DADOS INICIAIS
-- ========================================

-- Inserir plataformas padrão
INSERT IGNORE INTO `plataformas` (`nome`, `codigo_plataforma`, `icone`, `rtmp_base_url`, `requer_stream_key`) VALUES
('YouTube', 'youtube', 'youtube', 'rtmp://a.rtmp.youtube.com/live2', 1),
('Facebook', 'facebook', 'facebook', 'rtmps://live-api-s.facebook.com:443/rtmp', 1),
('Instagram', 'instagram', 'instagram', 'rtmps://live-upload.instagram.com/rtmp', 1),
('Twitch', 'twitch', 'twitch', 'rtmp://live.twitch.tv/app', 1),
('TikTok', 'tiktok', 'video', 'rtmp://push.tiktokcdn.com/live', 1),
('Vimeo', 'vimeo', 'video', 'rtmp://rtmp.vimeo.com/live', 1),
('Periscope', 'periscope', 'radio', 'rtmp://publish.periscope.tv/live', 1),
('Kwai', 'kwai', 'zap', 'rtmp://push.kwai.com/live', 1),
('Steam', 'steam', 'activity', 'rtmp://ingest.broadcast.steamcontent.com/live', 1),
('RTMP Próprio', 'rtmp', 'globe', 'rtmp://seu-servidor.com/live', 1);

-- ========================================
-- VIEWS PARA RELATÓRIOS
-- ========================================

-- View para estatísticas de transmissões
CREATE OR REPLACE VIEW `v_transmissoes_stats` AS
SELECT 
    t.codigo_stm,
    r.nome as usuario_nome,
    COUNT(t.codigo) as total_transmissoes,
    SUM(CASE WHEN t.status = 'ativa' THEN 1 ELSE 0 END) as transmissoes_ativas,
    SUM(CASE WHEN t.status = 'finalizada' THEN 1 ELSE 0 END) as transmissoes_finalizadas,
    AVG(t.viewers_pico) as media_viewers,
    SUM(t.duracao_segundos) as tempo_total_transmissao,
    MAX(t.data_inicio) as ultima_transmissao
FROM transmissoes t
JOIN revendas r ON t.codigo_stm = r.codigo
GROUP BY t.codigo_stm, r.nome;

-- View para estatísticas de plataformas
CREATE OR REPLACE VIEW `v_plataformas_stats` AS
SELECT 
    p.nome as plataforma_nome,
    p.codigo_plataforma,
    COUNT(up.codigo) as usuarios_configurados,
    COUNT(tp.codigo) as transmissoes_realizadas,
    SUM(CASE WHEN tp.status = 'ativa' THEN 1 ELSE 0 END) as transmissoes_ativas
FROM plataformas p
LEFT JOIN user_platforms up ON p.codigo = up.platform_id AND up.ativo = 1
LEFT JOIN transmissoes_plataformas tp ON up.codigo = tp.user_platform_id
GROUP BY p.codigo, p.nome, p.codigo_plataforma;

-- ========================================
-- TRIGGERS PARA AUDITORIA
-- ========================================

-- Trigger para atualizar estatísticas da playlist
DELIMITER $$
CREATE TRIGGER IF NOT EXISTS `tr_playlist_videos_stats` 
AFTER INSERT ON `playlists_videos`
FOR EACH ROW
BEGIN
    UPDATE playlists SET 
        total_videos = (
            SELECT COUNT(*) 
            FROM playlists_videos 
            WHERE codigo_playlist = NEW.codigo_playlist
        ),
        duracao_total = (
            SELECT COALESCE(SUM(duracao_segundos), 0) 
            FROM playlists_videos 
            WHERE codigo_playlist = NEW.codigo_playlist
        )
    WHERE id = NEW.codigo_playlist;
END$$

CREATE TRIGGER IF NOT EXISTS `tr_playlist_videos_stats_delete` 
AFTER DELETE ON `playlists_videos`
FOR EACH ROW
BEGIN
    UPDATE playlists SET 
        total_videos = (
            SELECT COUNT(*) 
            FROM playlists_videos 
            WHERE codigo_playlist = OLD.codigo_playlist
        ),
        duracao_total = (
            SELECT COALESCE(SUM(duracao_segundos), 0) 
            FROM playlists_videos 
            WHERE codigo_playlist = OLD.codigo_playlist
        )
    WHERE id = OLD.codigo_playlist;
END$$
DELIMITER ;

-- ========================================
-- PROCEDURES ÚTEIS
-- ========================================

-- Procedure para limpeza de dados antigos
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS `sp_cleanup_old_data`()
BEGIN
    -- Limpar transmissões antigas (mais de 6 meses)
    DELETE FROM transmissoes 
    WHERE status = 'finalizada' 
    AND data_fim < DATE_SUB(NOW(), INTERVAL 6 MONTH);
    
    -- Limpar estatísticas antigas (mais de 1 ano)
    DELETE FROM estatisticas 
    WHERE data < DATE_SUB(NOW(), INTERVAL 1 YEAR);
    
    -- Limpar logs antigos (mais de 3 meses)
    DELETE FROM logs_streamings 
    WHERE data < DATE_SUB(NOW(), INTERVAL 3 MONTH);
    
    SELECT 'Limpeza concluída' as resultado;
END$$
DELIMITER ;

-- Procedure para estatísticas gerais
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS `sp_dashboard_stats`(IN user_id INT)
BEGIN
    SELECT 
        (SELECT COUNT(*) FROM playlists WHERE codigo_stm = user_id) as total_playlists,
        (SELECT COUNT(*) FROM playlists_videos pv 
         JOIN playlists p ON pv.codigo_playlist = p.id 
         WHERE p.codigo_stm = user_id) as total_videos,
        (SELECT COUNT(*) FROM transmissoes WHERE codigo_stm = user_id) as total_transmissoes,
        (SELECT COUNT(*) FROM user_platforms WHERE codigo_stm = user_id AND ativo = 1) as plataformas_configuradas,
        (SELECT COUNT(*) FROM logos WHERE codigo_stm = user_id) as total_logos,
        (SELECT SUM(tamanho) FROM logos WHERE codigo_stm = user_id) as espaco_usado_logos;
END$$
DELIMITER ;

-- ========================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ========================================

-- Índices para tabela estatisticas
ALTER TABLE `estatisticas` 
ADD INDEX IF NOT EXISTS `idx_data_stm` (`data`, `codigo_stm`),
ADD INDEX IF NOT EXISTS `idx_pais_stm` (`pais`, `codigo_stm`),
ADD INDEX IF NOT EXISTS `idx_tempo_conectado` (`tempo_conectado`);

-- Índices para tabela espectadores_conectados
ALTER TABLE `espectadores_conectados` 
ADD INDEX IF NOT EXISTS `idx_atualizacao` (`atualizacao`),
ADD INDEX IF NOT EXISTS `idx_stm_atualizacao` (`codigo_stm`, `atualizacao`);

-- Índices para tabela playlists_videos
ALTER TABLE `playlists_videos` 
ADD INDEX IF NOT EXISTS `idx_playlist_ordem` (`codigo_playlist`, `ordem`),
ADD INDEX IF NOT EXISTS `idx_tipo` (`tipo`);

-- ========================================
-- CONFIGURAÇÕES FINAIS
-- ========================================

-- Otimizar tabelas
OPTIMIZE TABLE playlists, playlists_videos, revendas, streamings;

-- Analisar tabelas para estatísticas
ANALYZE TABLE playlists, playlists_videos, revendas, streamings, transmissoes, user_platforms;

-- Mensagem de sucesso
SELECT 'Todas as tabelas foram criadas com sucesso!' as status,
       'Sistema pronto para uso com integração WHMCS e Wowza' as mensagem,
       NOW() as data_instalacao;