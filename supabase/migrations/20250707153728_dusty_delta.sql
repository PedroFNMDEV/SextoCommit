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
  `codigo` varchar(50) NOT NULL UNIQUE,
  `icone` varchar(100) NOT NULL DEFAULT 'activity',
  `rtmp_base_url` text NOT NULL,
  `requer_stream_key` tinyint(1) NOT NULL DEFAULT 1,
  `ativo` tinyint(1) NOT NULL DEFAULT 1,
  `data_cadastro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`codigo`),
  KEY `idx_codigo` (`codigo`),
  KEY `idx_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABELA: user_platforms
-- Configurações de plataformas por usuário
-- ========================================
CREATE TABLE IF NOT EXISTS `user_platforms` (
  `codigo` int(10) NOT NULL AUTO_INCREMENT,
  `codigo_stm` int(10) NOT NULL,
  `platform_id` varchar(50) NOT NULL,
  `stream_key` text NOT NULL,
  `rtmp_url` text DEFAULT NULL,
  `titulo_padrao` varchar(255) DEFAULT NULL,
  `descricao_padrao` text DEFAULT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT 1,
  `data_cadastro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `data_atualizacao` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`codigo`),
  KEY `idx_codigo_stm` (`codigo_stm`),
  KEY `idx_platform_id` (`platform_id`),
  KEY `idx_ativo` (`ativo`),
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
  `settings` json DEFAULT NULL,
  `viewers_max` int(10) NOT NULL DEFAULT 0,
  `duracao_segundos` int(10) NOT NULL DEFAULT 0,
  PRIMARY KEY (`codigo`),
  KEY `idx_codigo_stm` (`codigo_stm`),
  KEY `idx_status` (`status`),
  KEY `idx_data_inicio` (`data_inicio`),
  KEY `idx_wowza_stream_id` (`wowza_stream_id`)
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
  `erro_detalhes` text DEFAULT NULL,
  `data_inicio` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `data_fim` datetime DEFAULT NULL,
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
  `tipo_arquivo` varchar(100) NOT NULL,
  `data_upload` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`codigo`),
  KEY `idx_codigo_stm` (`codigo_stm`),
  KEY `idx_data_upload` (`data_upload`)
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
  `logo_posicao` enum('top-left','top-right','bottom-left','bottom-right','center') NOT NULL DEFAULT 'top-right',
  `logo_opacidade` int(3) NOT NULL DEFAULT 80,
  `logo_tamanho` enum('small','medium','large') NOT NULL DEFAULT 'medium',
  `logo_margem_x` int(5) NOT NULL DEFAULT 20,
  `logo_margem_y` int(5) NOT NULL DEFAULT 20,
  `embaralhar_videos` tinyint(1) NOT NULL DEFAULT 0,
  `repetir_playlist` tinyint(1) NOT NULL DEFAULT 1,
  `transicao_videos` enum('fade','cut','slide') NOT NULL DEFAULT 'fade',
  `resolucao` enum('720p','1080p','1440p','4k') NOT NULL DEFAULT '1080p',
  `fps` int(3) NOT NULL DEFAULT 30,
  `bitrate` int(6) NOT NULL DEFAULT 2500,
  `titulo_padrao` varchar(255) DEFAULT NULL,
  `descricao_padrao` text DEFAULT NULL,
  `data_criacao` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`codigo`),
  KEY `idx_codigo_stm` (`codigo_stm`),
  KEY `idx_codigo_logo` (`codigo_logo`),
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
  `quantidade_comerciais` int(3) NOT NULL DEFAULT 1,
  `intervalo_videos` int(3) NOT NULL DEFAULT 3,
  `ativo` tinyint(1) NOT NULL DEFAULT 1,
  `data_criacao` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `data_atualizacao` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`codigo`),
  KEY `idx_codigo_stm` (`codigo_stm`),
  KEY `idx_codigo_playlist` (`codigo_playlist`),
  KEY `idx_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABELA: user_settings
-- Configurações personalizadas do usuário
-- ========================================
CREATE TABLE IF NOT EXISTS `user_settings` (
  `codigo` int(10) NOT NULL AUTO_INCREMENT,
  `codigo_stm` int(10) NOT NULL,
  `menu_items` json DEFAULT NULL,
  `sidebar_collapsed` tinyint(1) NOT NULL DEFAULT 0,
  `notifications_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `auto_refresh` tinyint(1) NOT NULL DEFAULT 1,
  `refresh_interval` int(5) NOT NULL DEFAULT 30,
  `language` varchar(10) NOT NULL DEFAULT 'pt-BR',
  `timezone` varchar(50) NOT NULL DEFAULT 'America/Sao_Paulo',
  `data_criacao` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `data_atualizacao` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`codigo`),
  UNIQUE KEY `idx_codigo_stm` (`codigo_stm`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- INSERIR DADOS INICIAIS
-- ========================================

-- Inserir plataformas padrão
INSERT IGNORE INTO `plataformas` (`nome`, `codigo`, `icone`, `rtmp_base_url`, `requer_stream_key`, `ativo`) VALUES
('YouTube', 'youtube', 'youtube', 'rtmp://a.rtmp.youtube.com/live2', 1, 1),
('Facebook', 'facebook', 'facebook', 'rtmps://live-api-s.facebook.com:443/rtmp', 1, 1),
('Instagram', 'instagram', 'instagram', 'rtmps://live-upload.instagram.com/rtmp', 1, 1),
('Twitch', 'twitch', 'twitch', 'rtmp://live.twitch.tv/live', 1, 1),
('TikTok', 'tiktok', 'video', 'rtmp://push.tiktokcdn.com/live', 1, 1),
('Vimeo', 'vimeo', 'video', 'rtmp://rtmp.vimeo.com/live', 1, 1),
('Periscope', 'periscope', 'radio', 'rtmp://publish.periscope.tv/live', 1, 1),
('Kwai', 'kwai', 'zap', 'rtmp://push.kwai.com/live', 1, 1),
('Steam', 'steam', 'activity', 'rtmp://ingest.broadcast.steamcontent.com/live', 1, 1),
('RTMP Próprio', 'rtmp', 'globe', '', 1, 1);

-- ========================================
-- ATUALIZAR TABELAS EXISTENTES
-- ========================================

-- Adicionar colunas na tabela playlists se não existirem
ALTER TABLE `playlists` 
ADD COLUMN IF NOT EXISTS `codigo_stm` int(10) NOT NULL DEFAULT 0 AFTER `nome`,
ADD INDEX IF NOT EXISTS `idx_codigo_stm` (`codigo_stm`);

-- Adicionar colunas na tabela revendas se não existirem  
ALTER TABLE `revendas`
ADD COLUMN IF NOT EXISTS `api_token` varchar(255) DEFAULT NULL AFTER `srt_status`,
ADD COLUMN IF NOT EXISTS `refresh_token` varchar(255) DEFAULT NULL AFTER `api_token`;

-- ========================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ========================================

-- Índices para tabela espectadores_conectados
ALTER TABLE `espectadores_conectados`
ADD INDEX IF NOT EXISTS `idx_codigo_stm_atualizacao` (`codigo_stm`, `atualizacao`),
ADD INDEX IF NOT EXISTS `idx_pais_cidade` (`pais_nome`, `cidade`);

-- Índices para tabela estatisticas
ALTER TABLE `estatisticas`
ADD INDEX IF NOT EXISTS `idx_codigo_stm_data_hora` (`codigo_stm`, `data`, `hora`),
ADD INDEX IF NOT EXISTS `idx_codigo_stm_pais_data` (`codigo_stm`, `pais`, `data`);

-- Índices para tabela playlists_videos
ALTER TABLE `playlists_videos`
ADD INDEX IF NOT EXISTS `idx_codigo_playlist_ordem` (`codigo_playlist`, `ordem`),
ADD INDEX IF NOT EXISTS `idx_tipo` (`tipo`);

-- Índices para tabela playlists_agendamentos
ALTER TABLE `playlists_agendamentos`
ADD INDEX IF NOT EXISTS `idx_codigo_stm_data` (`codigo_stm`, `data`),
ADD INDEX IF NOT EXISTS `idx_frequencia` (`frequencia`),
ADD INDEX IF NOT EXISTS `idx_status_data` (`data`);

-- ========================================
-- VIEWS ÚTEIS PARA RELATÓRIOS
-- ========================================

-- View para estatísticas de transmissões
CREATE OR REPLACE VIEW `v_transmissoes_stats` AS
SELECT 
    t.codigo,
    t.codigo_stm,
    t.titulo,
    t.status,
    t.data_inicio,
    t.data_fim,
    TIMESTAMPDIFF(SECOND, t.data_inicio, COALESCE(t.data_fim, NOW())) as duracao_segundos,
    COUNT(tp.codigo) as total_plataformas,
    SUM(CASE WHEN tp.status = 'ativa' THEN 1 ELSE 0 END) as plataformas_ativas,
    t.viewers_max
FROM transmissoes t
LEFT JOIN transmissoes_plataformas tp ON t.codigo = tp.transmissao_id
GROUP BY t.codigo;

-- View para estatísticas de espectadores por país
CREATE OR REPLACE VIEW `v_espectadores_por_pais` AS
SELECT 
    codigo_stm,
    pais_nome,
    COUNT(*) as total_espectadores,
    COUNT(DISTINCT ip) as ips_unicos,
    AVG(TIMESTAMPDIFF(MINUTE, atualizacao, NOW())) as tempo_medio_minutos
FROM espectadores_conectados
WHERE atualizacao >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY codigo_stm, pais_nome;

-- ========================================
-- TRIGGERS PARA AUDITORIA
-- ========================================

-- Trigger para atualizar data_atualizacao em user_platforms
DELIMITER $$
CREATE TRIGGER IF NOT EXISTS `tr_user_platforms_update`
    BEFORE UPDATE ON `user_platforms`
    FOR EACH ROW
BEGIN
    SET NEW.data_atualizacao = CURRENT_TIMESTAMP;
END$$
DELIMITER ;

-- Trigger para calcular duração em transmissoes
DELIMITER $$
CREATE TRIGGER IF NOT EXISTS `tr_transmissoes_duracao`
    BEFORE UPDATE ON `transmissoes`
    FOR EACH ROW
BEGIN
    IF NEW.data_fim IS NOT NULL AND OLD.data_fim IS NULL THEN
        SET NEW.duracao_segundos = TIMESTAMPDIFF(SECOND, NEW.data_inicio, NEW.data_fim);
    END IF;
END$$
DELIMITER ;

-- ========================================
-- PROCEDURES ÚTEIS
-- ========================================

-- Procedure para limpar dados antigos
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS `sp_cleanup_old_data`()
BEGIN
    -- Limpar espectadores conectados antigos (mais de 1 hora)
    DELETE FROM espectadores_conectados 
    WHERE atualizacao < DATE_SUB(NOW(), INTERVAL 1 HOUR);
    
    -- Limpar estatísticas muito antigas (mais de 1 ano)
    DELETE FROM estatisticas 
    WHERE data < DATE_SUB(CURDATE(), INTERVAL 1 YEAR);
    
    -- Limpar logs antigos (mais de 6 meses)
    DELETE FROM logs_streamings 
    WHERE data < DATE_SUB(NOW(), INTERVAL 6 MONTH);
    
    SELECT 'Limpeza concluída' as resultado;
END$$
DELIMITER ;

-- Procedure para estatísticas de usuário
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS `sp_user_stats`(IN user_id INT)
BEGIN
    SELECT 
        'Transmissões' as tipo,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'ativa' THEN 1 ELSE 0 END) as ativas
    FROM transmissoes 
    WHERE codigo_stm = user_id
    
    UNION ALL
    
    SELECT 
        'Playlists' as tipo,
        COUNT(*) as total,
        0 as ativas
    FROM playlists 
    WHERE codigo_stm = user_id
    
    UNION ALL
    
    SELECT 
        'Vídeos' as tipo,
        COUNT(*) as total,
        0 as ativas
    FROM playlists_videos pv
    JOIN playlists p ON pv.codigo_playlist = p.codigo
    WHERE p.codigo_stm = user_id;
END$$
DELIMITER ;

-- ========================================
-- COMENTÁRIOS FINAIS
-- ========================================

/*
INSTRUÇÕES DE USO:

1. Execute este script no seu banco MariaDB
2. Verifique se todas as tabelas foram criadas com sucesso
3. As plataformas padrão serão inseridas automaticamente
4. Os índices melhorarão a performance das consultas
5. As views facilitarão a criação de relatórios
6. Os triggers manterão a integridade dos dados
7. As procedures podem ser usadas para manutenção

MANUTENÇÃO:
- Execute sp_cleanup_old_data() periodicamente para limpar dados antigos
- Use sp_user_stats(user_id) para obter estatísticas de um usuário
- Monitore o crescimento das tabelas de logs e estatísticas

SEGURANÇA:
- Todas as tabelas usam InnoDB para suporte a transações
- Foreign keys garantem integridade referencial
- Índices otimizam consultas frequentes
- Triggers mantêm dados consistentes
*/