{* Template para área do cliente WHMCS *}

<div class="panel panel-default">
    <div class="panel-heading">
        <h3 class="panel-title">
            <i class="fa fa-video-camera"></i>
            Detalhes do Serviço de Streaming
        </h3>
    </div>
    <div class="panel-body">
        {if $error}
            <div class="alert alert-danger">
                <strong>Erro:</strong> {$error}
            </div>
        {else}
            <div class="row">
                <div class="col-md-6">
                    <h4>Informações da Conta</h4>
                    <table class="table table-striped">
                        <tr>
                            <td><strong>Status:</strong></td>
                            <td>
                                {if $service_status == 'Active'}
                                    <span class="label label-success">Ativo</span>
                                {elseif $service_status == 'Suspended'}
                                    <span class="label label-warning">Suspenso</span>
                                {elseif $service_status == 'Terminated'}
                                    <span class="label label-danger">Cancelado</span>
                                {else}
                                    <span class="label label-default">{$service_status}</span>
                                {/if}
                            </td>
                        </tr>
                        <tr>
                            <td><strong>Usuário:</strong></td>
                            <td>{$username}</td>
                        </tr>
                    </table>
                </div>
                
                <div class="col-md-6">
                    <h4>Recursos Disponíveis</h4>
                    <table class="table table-striped">
                        <tr>
                            <td><strong>Streamings:</strong></td>
                            <td>{$streamings}</td>
                        </tr>
                        <tr>
                            <td><strong>Espectadores:</strong></td>
                            <td>{$espectadores}</td>
                        </tr>
                        <tr>
                            <td><strong>Bitrate:</strong></td>
                            <td>{$bitrate} kbps</td>
                        </tr>
                        <tr>
                            <td><strong>Espaço:</strong></td>
                            <td>{$espaco} GB</td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <hr>
            
            <div class="row">
                <div class="col-md-12">
                    <h4>Acesso ao Sistema</h4>
                    <p>Use os links abaixo para acessar seu painel de streaming:</p>
                    
                    <div class="btn-group" role="group">
                        <a href="{$login_url}" target="_blank" class="btn btn-primary">
                            <i class="fa fa-sign-in"></i> Fazer Login
                        </a>
                        <a href="{$dashboard_url}" target="_blank" class="btn btn-success">
                            <i class="fa fa-dashboard"></i> Acessar Dashboard
                        </a>
                    </div>
                </div>
            </div>
            
            <hr>
            
            <div class="row">
                <div class="col-md-12">
                    <h4>Informações Importantes</h4>
                    <div class="alert alert-info">
                        <ul class="mb-0">
                            <li><strong>Login:</strong> Use seu email cadastrado no WHMCS</li>
                            <li><strong>Senha:</strong> A senha foi enviada por email ou definida durante a ativação</li>
                            <li><strong>Suporte:</strong> Em caso de dúvidas, abra um ticket de suporte</li>
                            <li><strong>Recursos:</strong> Seus limites estão definidos conforme o plano contratado</li>
                        </ul>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
.panel {
    margin-bottom: 20px;
    background-color: #fff;
    border: 1px solid transparent;
    border-radius: 4px;
    box-shadow: 0 1px 1px rgba(0,0,0,.05);
}

.panel-heading {
    padding: 10px 15px;
    border-bottom: 1px solid transparent;
    border-top-left-radius: 3px;
    border-top-right-radius: 3px;
    background-color: #f5f5f5;
    border-color: #ddd;
}

.panel-body {
    padding: 15px;
}

.table {
    width: 100%;
    max-width: 100%;
    margin-bottom: 20px;
    background-color: transparent;
}

.table-striped > tbody > tr:nth-of-type(odd) {
    background-color: #f9f9f9;
}

.label {
    display: inline;
    padding: .2em .6em .3em;
    font-size: 75%;
    font-weight: 700;
    line-height: 1;
    color: #fff;
    text-align: center;
    white-space: nowrap;
    vertical-align: baseline;
    border-radius: .25em;
}

.label-success {
    background-color: #5cb85c;
}

.label-warning {
    background-color: #f0ad4e;
}

.label-danger {
    background-color: #d9534f;
}

.label-default {
    background-color: #777;
}

.btn {
    display: inline-block;
    padding: 6px 12px;
    margin-bottom: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.42857143;
    text-align: center;
    white-space: nowrap;
    vertical-align: middle;
    cursor: pointer;
    border: 1px solid transparent;
    border-radius: 4px;
    text-decoration: none;
}

.btn-primary {
    color: #fff;
    background-color: #337ab7;
    border-color: #2e6da4;
}

.btn-success {
    color: #fff;
    background-color: #5cb85c;
    border-color: #4cae4c;
}

.alert {
    padding: 15px;
    margin-bottom: 20px;
    border: 1px solid transparent;
    border-radius: 4px;
}

.alert-info {
    color: #31708f;
    background-color: #d9edf7;
    border-color: #bce8f1;
}

.alert-danger {
    color: #a94442;
    background-color: #f2dede;
    border-color: #ebccd1;
}
</style>