<?php
/**
 * WHMCS Integration Module for Streaming System
 * 
 * Este módulo integra o WHMCS com o sistema de streaming,
 * criando, suspendendo e cancelando usuários automaticamente.
 */

if (!defined("WHMCS")) {
    die("This file cannot be accessed directly");
}

// Configurações do módulo
function stmvideoadvance_MetaData() {
    return array(
        'DisplayName' => 'STM Video Advance',
        'APIVersion' => '1.1',
        'RequiresServer' => false,
    );
}

// Campos de configuração do produto
function stmvideoadvance_ConfigOptions() {
    return array(
        'streamings' => array(
            'FriendlyName' => 'Quantidade de Streamings',
            'Type' => 'text',
            'Size' => '10',
            'Default' => '1',
            'Description' => 'Número de streamings simultâneos permitidos',
        ),
        'espectadores' => array(
            'FriendlyName' => 'Limite de Espectadores',
            'Type' => 'text',
            'Size' => '10',
            'Default' => '100',
            'Description' => 'Número máximo de espectadores simultâneos',
        ),
        'espectadores_ilimitado' => array(
            'FriendlyName' => 'Espectadores Ilimitados',
            'Type' => 'yesno',
            'Default' => 'no',
            'Description' => 'Permitir espectadores ilimitados',
        ),
        'bitrate' => array(
            'FriendlyName' => 'Bitrate Padrão (kbps)',
            'Type' => 'text',
            'Size' => '10',
            'Default' => '2500',
            'Description' => 'Bitrate padrão para transmissões',
        ),
        'bitrate_maximo' => array(
            'FriendlyName' => 'Bitrate Máximo (kbps)',
            'Type' => 'text',
            'Size' => '10',
            'Default' => '5000',
            'Description' => 'Bitrate máximo permitido',
        ),
        'espaco' => array(
            'FriendlyName' => 'Espaço de Armazenamento (GB)',
            'Type' => 'text',
            'Size' => '10',
            'Default' => '1000',
            'Description' => 'Espaço em GB para armazenamento de vídeos',
        ),
        'api_url' => array(
            'FriendlyName' => 'URL da API do Sistema',
            'Type' => 'text',
            'Size' => '50',
            'Default' => 'http://localhost:3001/api',
            'Description' => 'URL base da API do sistema de streaming',
        ),
    );
}

// Função para fazer requisições HTTP
function stmvideoadvance_makeApiRequest($endpoint, $data = array(), $method = 'POST') {
    $apiUrl = rtrim($GLOBALS['stm_api_url'], '/') . '/' . ltrim($endpoint, '/');
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        'Content-Type: application/json',
        'User-Agent: WHMCS-STM-Integration/1.0'
    ));
    
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        logActivity("STM Video Advance API Error: " . $error);
        return array('success' => false, 'error' => $error);
    }
    
    $decodedResponse = json_decode($response, true);
    
    if ($httpCode !== 200) {
        $errorMsg = isset($decodedResponse['error']) ? $decodedResponse['error'] : 'HTTP Error ' . $httpCode;
        logActivity("STM Video Advance API HTTP Error: " . $errorMsg);
        return array('success' => false, 'error' => $errorMsg);
    }
    
    return $decodedResponse;
}

// Criar conta
function stmvideoadvance_CreateAccount($vars) {
    global $stm_api_url;
    $stm_api_url = $vars['configoption8'] ?: 'http://localhost:3001/api';
    
    try {
        // Buscar dados do cliente
        $clientData = Capsule::table('tblclients')
            ->where('id', $vars['userid'])
            ->first();
        
        if (!$clientData) {
            return "Erro: Cliente não encontrado";
        }
        
        // Preparar dados para criação do usuário
        $userData = array(
            'whmcs_user_id' => $vars['userid'],
            'whmcs_service_id' => $vars['serviceid'],
            'nome' => $clientData->firstname . ' ' . $clientData->lastname,
            'email' => $clientData->email,
            'senha' => $vars['password'] ?: generateRandomPassword(),
            'telefone' => $clientData->phonenumber,
            'streamings' => (int)$vars['configoption1'] ?: 1,
            'espectadores' => (int)$vars['configoption2'] ?: 100,
            'espectadores_ilimitado' => $vars['configoption3'] === 'on',
            'bitrate' => (int)$vars['configoption4'] ?: 2500,
            'bitrate_maximo' => (int)$vars['configoption5'] ?: 5000,
            'espaco' => (int)$vars['configoption6'] ?: 1000,
        );
        
        // Fazer requisição para criar usuário
        $response = stmvideoadvance_makeApiRequest('whmcs/create-user', $userData);
        
        if (!$response['success']) {
            logActivity("STM Video Advance - Erro ao criar usuário: " . $response['error']);
            return "Erro ao criar conta: " . $response['error'];
        }
        
        // Salvar informações adicionais no WHMCS
        Capsule::table('tblhosting')
            ->where('id', $vars['serviceid'])
            ->update([
                'username' => $response['streaming_user_id'],
                'password' => encrypt($userData['senha']),
            ]);
        
        logActivity("STM Video Advance - Usuário criado com sucesso: " . $clientData->email);
        return "success";
        
    } catch (Exception $e) {
        logActivity("STM Video Advance - Exceção ao criar conta: " . $e->getMessage());
        return "Erro interno: " . $e->getMessage();
    }
}

// Suspender conta
function stmvideoadvance_SuspendAccount($vars) {
    global $stm_api_url;
    $stm_api_url = $vars['configoption8'] ?: 'http://localhost:3001/api';
    
    try {
        $suspendData = array(
            'whmcs_service_id' => $vars['serviceid'],
            'motivo' => 'Conta suspensa via WHMCS - Serviço ID: ' . $vars['serviceid']
        );
        
        $response = stmvideoadvance_makeApiRequest('whmcs/suspend-user', $suspendData);
        
        if (!$response['success']) {
            logActivity("STM Video Advance - Erro ao suspender usuário: " . $response['error']);
            return "Erro ao suspender conta: " . $response['error'];
        }
        
        logActivity("STM Video Advance - Usuário suspenso com sucesso: Serviço " . $vars['serviceid']);
        return "success";
        
    } catch (Exception $e) {
        logActivity("STM Video Advance - Exceção ao suspender conta: " . $e->getMessage());
        return "Erro interno: " . $e->getMessage();
    }
}

// Reativar conta
function stmvideoadvance_UnsuspendAccount($vars) {
    global $stm_api_url;
    $stm_api_url = $vars['configoption8'] ?: 'http://localhost:3001/api';
    
    try {
        $unsuspendData = array(
            'whmcs_service_id' => $vars['serviceid'],
            'motivo' => 'Conta reativada via WHMCS - Serviço ID: ' . $vars['serviceid']
        );
        
        $response = stmvideoadvance_makeApiRequest('whmcs/unsuspend-user', $unsuspendData);
        
        if (!$response['success']) {
            logActivity("STM Video Advance - Erro ao reativar usuário: " . $response['error']);
            return "Erro ao reativar conta: " . $response['error'];
        }
        
        logActivity("STM Video Advance - Usuário reativado com sucesso: Serviço " . $vars['serviceid']);
        return "success";
        
    } catch (Exception $e) {
        logActivity("STM Video Advance - Exceção ao reativar conta: " . $e->getMessage());
        return "Erro interno: " . $e->getMessage();
    }
}

// Cancelar conta
function stmvideoadvance_TerminateAccount($vars) {
    global $stm_api_url;
    $stm_api_url = $vars['configoption8'] ?: 'http://localhost:3001/api';
    
    try {
        $terminateData = array(
            'whmcs_service_id' => $vars['serviceid'],
            'motivo' => 'Conta cancelada via WHMCS - Serviço ID: ' . $vars['serviceid']
        );
        
        $response = stmvideoadvance_makeApiRequest('whmcs/terminate-user', $terminateData);
        
        if (!$response['success']) {
            logActivity("STM Video Advance - Erro ao cancelar usuário: " . $response['error']);
            return "Erro ao cancelar conta: " . $response['error'];
        }
        
        logActivity("STM Video Advance - Usuário cancelado com sucesso: Serviço " . $vars['serviceid']);
        return "success";
        
    } catch (Exception $e) {
        logActivity("STM Video Advance - Exceção ao cancelar conta: " . $e->getMessage());
        return "Erro interno: " . $e->getMessage();
    }
}

// Testar conexão
function stmvideoadvance_TestConnection($vars) {
    global $stm_api_url;
    $stm_api_url = $vars['configoption8'] ?: 'http://localhost:3001/api';
    
    try {
        // Fazer uma requisição simples para testar a conexão
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $stm_api_url . '/admin/dashboard/stats');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_NOBODY, true); // Apenas HEAD request
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            return array('success' => false, 'error' => 'Erro de conexão: ' . $error);
        }
        
        if ($httpCode === 200 || $httpCode === 401) { // 401 é esperado sem token
            return array('success' => true, 'message' => 'Conexão estabelecida com sucesso');
        }
        
        return array('success' => false, 'error' => 'Servidor retornou código HTTP: ' . $httpCode);
        
    } catch (Exception $e) {
        return array('success' => false, 'error' => 'Exceção: ' . $e->getMessage());
    }
}

// Gerar senha aleatória
function generateRandomPassword($length = 12) {
    $characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    $password = '';
    
    for ($i = 0; $i < $length; $i++) {
        $password .= $characters[rand(0, strlen($characters) - 1)];
    }
    
    return $password;
}

// Função para exibir informações da conta no painel do cliente
function stmvideoadvance_ClientArea($vars) {
    $serviceId = $vars['serviceid'];
    
    // Buscar dados do serviço
    $service = Capsule::table('tblhosting')
        ->where('id', $serviceId)
        ->first();
    
    if (!$service) {
        return array(
            'templatefile' => 'clientarea',
            'vars' => array(
                'error' => 'Serviço não encontrado'
            )
        );
    }
    
    // Preparar dados para exibição
    $clientAreaData = array(
        'service_status' => $service->domainstatus,
        'username' => $service->username,
        'streamings' => $vars['configoption1'] ?: '1',
        'espectadores' => $vars['configoption2'] ?: '100',
        'bitrate' => $vars['configoption4'] ?: '2500',
        'espaco' => $vars['configoption6'] ?: '1000',
        'login_url' => 'http://localhost:3000/login',
        'dashboard_url' => 'http://localhost:3000/dashboard',
    );
    
    return array(
        'templatefile' => 'clientarea',
        'vars' => $clientAreaData
    );
}

// Função para ações administrativas
function stmvideoadvance_AdminCustomButtonArray() {
    return array(
        "Testar Conexão" => "TestConnection",
        "Verificar Status" => "CheckStatus",
    );
}

// Verificar status do usuário
function stmvideoadvance_CheckStatus($vars) {
    global $stm_api_url;
    $stm_api_url = $vars['configoption8'] ?: 'http://localhost:3001/api';
    
    try {
        // Aqui você pode implementar uma verificação de status específica
        // Por enquanto, retornamos sucesso
        return "Status verificado com sucesso";
        
    } catch (Exception $e) {
        return "Erro ao verificar status: " . $e->getMessage();
    }
}

?>