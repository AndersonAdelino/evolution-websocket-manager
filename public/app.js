// Estado da aplicação
let socket = null;
let currentSettings = null;
let autoScroll = true;

// Eventos disponíveis
const AVAILABLE_EVENTS = [
    'messages.upsert',
    'messages.update',
    'messages.delete',
    'connection.update',
    'qr.updated',
    'contacts.upsert',
    'contacts.update',
    'groups.upsert',
    'groups.update',
    'call'
];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    connectWebSocket();
});

// Verificar autenticação
async function checkAuth() {
    try {
        const response = await fetch('/api/admin/check');
        if (response.ok) {
            const data = await response.json();
            showMainScreen(data.username);
            loadSettings();
            loadStats(); // Carregar estatísticas ao fazer login
        } else {
            showLoginScreen();
        }
    } catch (error) {
        showLoginScreen();
    }
}

// Mostrar tela de login
function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainScreen').classList.add('hidden');
}

// Mostrar tela principal
function showMainScreen(username) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    document.getElementById('usernameDisplay').textContent = `👤 ${username}`;
}

// Configurar event listeners
function setupEventListeners() {
    // Login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            switchTab(tab);
        });
    });

    // Logs
    document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);
    document.getElementById('autoScroll').addEventListener('change', (e) => {
        autoScroll = e.target.checked;
        // Se ativar auto-scroll, fazer scroll imediatamente
        if (autoScroll) {
            const container = document.getElementById('logsContainer');
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 0);
        }
    });

    // Configurações
    document.getElementById('websocketMode').addEventListener('change', handleModeChange);
    document.getElementById('addInstanceBtn').addEventListener('click', addInstance);
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

    // Webhooks
    document.getElementById('addWebhookBtn').addEventListener('click', () => openWebhookModal());
    document.getElementById('closeWebhookModal').addEventListener('click', closeWebhookModal);
    document.getElementById('cancelWebhookBtn').addEventListener('click', closeWebhookModal);
    document.getElementById('webhookForm').addEventListener('submit', saveWebhook);

    // Senha
    document.getElementById('changePasswordForm').addEventListener('submit', changePassword);

    // Estatísticas
    const refreshStatsBtn = document.getElementById('refreshStatsBtn');
    const resetStatsBtn = document.getElementById('resetStatsBtn');
    const statsTabBtn = document.querySelector('[data-tab="stats"]');
    
    if (refreshStatsBtn) {
        refreshStatsBtn.addEventListener('click', loadStats);
    }
    if (resetStatsBtn) {
        resetStatsBtn.addEventListener('click', resetStats);
    }
    if (statsTabBtn) {
        statsTabBtn.addEventListener('click', () => {
            setTimeout(loadStats, 100);
        });
    }
}

// Login
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            showMainScreen(username);
            loadSettings();
            errorDiv.textContent = '';
        } else {
            errorDiv.textContent = data.error || 'Erro ao fazer login';
        }
    } catch (error) {
        errorDiv.textContent = 'Erro de conexão';
    }
}

// Logout
async function handleLogout() {
    try {
        await fetch('/api/admin/logout', { method: 'POST' });
        showLoginScreen();
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
}

// Trocar aba
function switchTab(tabName) {
    // Atualizar navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Atualizar conteúdo
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// Conectar WebSocket para logs
function connectWebSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Conectado ao servidor de logs');
    });

    socket.on('logs', (logs) => {
        const container = document.getElementById('logsContainer');
        container.innerHTML = '';
        // Mostrar logs na ordem normal (mais antigos primeiro, mais recentes embaixo)
        logs.forEach(log => addLogEntry(log));
        // Scroll para baixo para mostrar os mais recentes
        if (autoScroll) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 0);
        }
    });

    socket.on('log', (log) => {
        addLogEntry(log);
    });
}

// Adicionar entrada de log
function addLogEntry(log) {
    const container = document.getElementById('logsContainer');
    const entry = document.createElement('div');
    entry.className = `log-entry ${log.level}`;

    const time = new Date(log.timestamp).toLocaleTimeString('pt-BR');
    let html = `<span class="log-time">[${time}]</span>`;
    html += `<span class="log-message">${escapeHtml(log.message)}</span>`;

    if (log.data) {
        html += `<div class="log-data">${escapeHtml(JSON.stringify(log.data, null, 2))}</div>`;
    }

    entry.innerHTML = html;
    container.appendChild(entry);

    // Scroll automático para baixo para mostrar os logs mais recentes
    if (autoScroll) {
        // Usar setTimeout para garantir que o scroll aconteça após o DOM atualizar completamente
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 0);
    }
}

// Limpar logs
function clearLogs() {
    if (confirm('Deseja limpar todos os logs?')) {
        const container = document.getElementById('logsContainer');
        container.innerHTML = '';
        // Adicionar mensagem vazia para manter o layout
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'log-entry info';
        emptyMsg.innerHTML = '<span class="log-time"></span><span class="log-message">Logs limpos. Aguardando novos eventos...</span>';
        container.appendChild(emptyMsg);
    }
}

// Carregar configurações
async function loadSettings() {
    try {
        const response = await fetch('/api/admin/settings');
        if (response.ok) {
            currentSettings = await response.json();
            renderSettings();
            renderWebhooks();
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
    }
}

// Renderizar configurações
function renderSettings() {
    document.getElementById('websocketMode').value = currentSettings.mode || 'global';
    document.getElementById('webhookEnabled').checked = currentSettings.webhookEnabled || false;
    handleModeChange();
    renderInstances();
}

// Renderizar instâncias
function renderInstances() {
    const container = document.getElementById('instancesList');
    const instances = currentSettings.traditionalInstances || [];

    if (instances.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma instância adicionada</p>';
        return;
    }

    container.innerHTML = instances.map((instance, index) => `
        <div class="instance-item">
            <span>${instance}</span>
            <button onclick="removeInstance(${index})">Remover</button>
        </div>
    `).join('');
}

// Adicionar instância
function addInstance() {
    const input = document.getElementById('newInstance');
    const name = input.value.trim();

    if (!name) {
        alert('Digite o nome da instância');
        return;
    }

    if (!currentSettings.traditionalInstances) {
        currentSettings.traditionalInstances = [];
    }

    if (currentSettings.traditionalInstances.includes(name)) {
        alert('Esta instância já foi adicionada');
        return;
    }

    currentSettings.traditionalInstances.push(name);
    input.value = '';
    renderInstances();
}

// Remover instância
window.removeInstance = function(index) {
    currentSettings.traditionalInstances.splice(index, 1);
    renderInstances();
};

// Mudança de modo
function handleModeChange() {
    const mode = document.getElementById('websocketMode').value;
    const section = document.getElementById('traditionalInstancesSection');
    
    if (mode === 'traditional') {
        section.classList.remove('hidden');
    } else {
        section.classList.add('hidden');
    }
}

// Salvar configurações
async function saveSettings() {
    const mode = document.getElementById('websocketMode').value;
    const webhookEnabled = document.getElementById('webhookEnabled').checked;

    const settings = {
        mode,
        webhookEnabled,
        traditionalInstances: currentSettings.traditionalInstances || [],
        webhooks: currentSettings.webhooks || []
    };

    try {
        const response = await fetch('/api/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            currentSettings = settings;
            alert('Configurações salvas com sucesso! A aplicação será reiniciada para aplicar as mudanças.');
            if (typeof location !== 'undefined' && location.reload) {
                location.reload();
            } else if (typeof window !== 'undefined' && window.location) {
                window.location.reload();
            }
        } else {
            alert('Erro ao salvar configurações');
        }
    } catch (error) {
        alert('Erro de conexão');
    }
}

// Renderizar webhooks
function renderWebhooks() {
    const container = document.getElementById('webhooksList');
    const webhooks = currentSettings.webhooks || [];

    if (webhooks.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum webhook configurado. Clique em "Adicionar Webhook" para começar.</p>';
        return;
    }

    container.innerHTML = webhooks.map((webhook, index) => {
        const events = Object.entries(webhook.events || {})
            .filter(([_, enabled]) => enabled)
            .map(([event]) => event);

        return `
            <div class="webhook-card">
                <div class="webhook-header">
                    <div>
                        <div class="webhook-name">${escapeHtml(webhook.name || 'Webhook sem nome')}</div>
                        <div class="webhook-url">${escapeHtml(webhook.url)}</div>
                    </div>
                    <span class="webhook-status ${webhook.enabled ? 'active' : 'inactive'}">
                        ${webhook.enabled ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
                <div class="webhook-events">
                    ${events.map(event => `<span class="event-badge">${event}</span>`).join('')}
                </div>
                <div class="webhook-actions">
                    <button class="btn btn-secondary" onclick="editWebhook(${index})">Editar</button>
                    <button class="btn btn-secondary" onclick="deleteWebhook(${index})">Excluir</button>
                </div>
            </div>
        `;
    }).join('');
}

// Abrir modal de webhook
function openWebhookModal(index = null) {
    const modal = document.getElementById('webhookModal');
    const form = document.getElementById('webhookForm');
    const title = document.getElementById('webhookModalTitle');

    if (index !== null) {
        // Editar
        const webhook = currentSettings.webhooks[index];
        title.textContent = 'Editar Webhook';
        document.getElementById('webhookIndex').value = index;
        document.getElementById('webhookName').value = webhook.name || '';
        document.getElementById('webhookUrl').value = webhook.url || '';
        document.getElementById('webhookEnabledCheck').checked = webhook.enabled !== false;
        renderWebhookEvents(webhook.events || {});
    } else {
        // Novo
        title.textContent = 'Adicionar Webhook';
        form.reset();
        document.getElementById('webhookIndex').value = '';
        renderWebhookEvents({});
    }

    modal.classList.remove('hidden');
}

// Fechar modal
function closeWebhookModal() {
    document.getElementById('webhookModal').classList.add('hidden');
}

// Renderizar eventos do webhook
function renderWebhookEvents(selectedEvents) {
    const container = document.getElementById('webhookEvents');
    container.innerHTML = AVAILABLE_EVENTS.map(event => `
        <label class="event-checkbox">
            <input type="checkbox" value="${event}" ${selectedEvents[event] ? 'checked' : ''}>
            <span>${event}</span>
        </label>
    `).join('');
}

// Salvar webhook
function saveWebhook(e) {
    e.preventDefault();

    const index = document.getElementById('webhookIndex').value;
    const name = document.getElementById('webhookName').value;
    const url = document.getElementById('webhookUrl').value;
    const enabled = document.getElementById('webhookEnabledCheck').checked;

    const events = {};
    document.querySelectorAll('#webhookEvents input[type="checkbox"]').forEach(checkbox => {
        events[checkbox.value] = checkbox.checked;
    });

    if (!currentSettings.webhooks) {
        currentSettings.webhooks = [];
    }

    const webhook = { name, url, enabled, events };

    if (index !== '') {
        // Editar
        currentSettings.webhooks[index] = webhook;
    } else {
        // Adicionar
        currentSettings.webhooks.push(webhook);
    }

    // Salvar no servidor
    fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentSettings)
    }).then(() => {
        renderWebhooks();
        closeWebhookModal();
    });
}

// Editar webhook
window.editWebhook = function(index) {
    openWebhookModal(index);
};

// Excluir webhook
window.deleteWebhook = function(index) {
    if (confirm('Deseja excluir este webhook?')) {
        currentSettings.webhooks.splice(index, 1);
        fetch('/api/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentSettings)
        }).then(() => {
            renderWebhooks();
        });
    }
};

// Alterar senha
async function changePassword(e) {
    e.preventDefault();
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    const errorDiv = document.getElementById('passwordError');
    const successDiv = document.getElementById('passwordSuccess');

    errorDiv.textContent = '';
    successDiv.textContent = '';

    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'As senhas não coincidem';
        return;
    }

    try {
        const response = await fetch('/api/admin/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPassword, newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            successDiv.textContent = 'Senha alterada com sucesso!';
            e.target.reset();
        } else {
            errorDiv.textContent = data.error || 'Erro ao alterar senha';
        }
    } catch (error) {
        errorDiv.textContent = 'Erro de conexão';
    }
}

// Utilitário: escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Carregar estatísticas
async function loadStats() {
    const container = document.getElementById('statsContainer');
    if (!container) {
        console.error('Container de estatísticas não encontrado');
        return;
    }

    try {
        container.innerHTML = '<div class="stats-loading">Carregando estatísticas...</div>';
        
        const response = await fetch('/api/admin/stats');
        
        if (!response.ok) {
            let errorMessage = 'Erro ao carregar estatísticas';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (e) {
                errorMessage = `Erro ${response.status}: ${response.statusText}`;
            }
            container.innerHTML = `<div class="error-message">${errorMessage}</div>`;
            return;
        }
        
        const data = await response.json();
        renderStats(data);
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        container.innerHTML = `<div class="error-message">Erro de conexão: ${error.message}</div>`;
    }
}

// Renderizar estatísticas
function renderStats(stats) {
    const container = document.getElementById('statsContainer');
    if (!container) {
        console.error('Container de estatísticas não encontrado');
        return;
    }

    // Verificar se stats está vazio ou inválido
    if (!stats || typeof stats !== 'object') {
        container.innerHTML = '<div class="error-message">Dados de estatísticas inválidos</div>';
        return;
    }

    // Garantir que os objetos existam
    stats.events = stats.events || { total: 0, byType: {}, byInstance: {}, averagePerMinute: 0 };
    stats.webhooks = stats.webhooks || { total: 0, success: 0, failed: 0, byWebhook: {}, byEventType: {}, successRate: '0%', averagePerMinute: 0 };
    stats.connections = stats.connections || { currentConnections: 0, totalConnections: 0, reconnections: 0, disconnections: 0 };
    stats.errors = stats.errors || { total: 0, byType: {}, errorRate: '0%' };
    stats.uptime = stats.uptime || { formatted: '0s', days: 0, hours: 0, minutes: 0 };
    
    const html = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Uptime</div>
                <div class="stat-value">${stats.uptime.formatted}</div>
                <div class="stat-detail">${stats.uptime.days} dias, ${stats.uptime.hours % 24}h ${stats.uptime.minutes % 60}m</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">Total de Eventos</div>
                <div class="stat-value">${stats.events.total.toLocaleString()}</div>
                <div class="stat-detail">${stats.events.averagePerMinute} eventos/min</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">Webhooks Enviados</div>
                <div class="stat-value">${stats.webhooks.total.toLocaleString()}</div>
                <div class="stat-detail">Taxa de sucesso: ${stats.webhooks.successRate}</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">Webhooks Sucesso</div>
                <div class="stat-value success">${stats.webhooks.success.toLocaleString()}</div>
                <div class="stat-detail">${stats.webhooks.averagePerMinute} webhooks/min</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">Webhooks Falhados</div>
                <div class="stat-value error">${stats.webhooks.failed.toLocaleString()}</div>
                <div class="stat-detail">Após retries</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">Conexões Ativas</div>
                <div class="stat-value">${stats.connections.currentConnections}</div>
                <div class="stat-detail">Total: ${stats.connections.totalConnections}</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">Reconexões</div>
                <div class="stat-value">${stats.connections.reconnections}</div>
                <div class="stat-detail">Desconexões: ${stats.connections.disconnections}</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">Erros</div>
                <div class="stat-value error">${stats.errors.total.toLocaleString()}</div>
                <div class="stat-detail">Taxa: ${stats.errors.errorRatePercent || stats.errors.errorRate || '0'}%</div>
            </div>
        </div>
        
        <div class="stats-sections">
            <div class="stats-section">
                <h3>Eventos por Tipo</h3>
                <div class="stats-list">
                    ${Object.entries(stats.events.byType)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, count]) => `
                            <div class="stats-item">
                                <span class="stats-item-label">${type}</span>
                                <span class="stats-item-value">${count.toLocaleString()}</span>
                            </div>
                        `).join('')}
                </div>
            </div>
            
            <div class="stats-section">
                <h3>Eventos por Instância</h3>
                <div class="stats-list">
                    ${Object.keys(stats.events.byInstance).length > 0
                        ? Object.entries(stats.events.byInstance)
                            .sort((a, b) => b[1] - a[1])
                            .map(([instance, count]) => `
                                <div class="stats-item">
                                    <span class="stats-item-label">${instance}</span>
                                    <span class="stats-item-value">${count.toLocaleString()}</span>
                                </div>
                            `).join('')
                        : '<div class="stats-item"><span class="stats-item-label">Nenhuma instância registrada</span></div>'
                    }
                </div>
            </div>
            
            <div class="stats-section">
                <h3>Webhooks por Nome</h3>
                <div class="stats-list">
                    ${Object.keys(stats.webhooks.byWebhook).length > 0
                        ? Object.entries(stats.webhooks.byWebhook)
                            .sort((a, b) => b[1].total - a[1].total)
                            .map(([name, data]) => `
                                <div class="stats-item">
                                    <span class="stats-item-label">${escapeHtml(name)}</span>
                                    <span class="stats-item-value">
                                        <span class="success">${data.success || 0}</span> / 
                                        <span class="error">${data.failed || 0}</span> 
                                        (${data.total || 0})
                                    </span>
                                </div>
                            `).join('')
                        : '<div class="stats-item"><span class="stats-item-label">Nenhum webhook registrado</span></div>'
                    }
                </div>
            </div>
            
            <div class="stats-section">
                <h3>Webhooks por Tipo de Evento</h3>
                <div class="stats-list">
                    ${Object.keys(stats.webhooks.byEventType).length > 0
                        ? Object.entries(stats.webhooks.byEventType)
                            .sort((a, b) => b[1].total - a[1].total)
                            .map(([type, data]) => `
                                <div class="stats-item">
                                    <span class="stats-item-label">${type}</span>
                                    <span class="stats-item-value">
                                        <span class="success">${data.success || 0}</span> / 
                                        <span class="error">${data.failed || 0}</span> 
                                        (${data.total || 0})
                                    </span>
                                </div>
                            `).join('')
                        : '<div class="stats-item"><span class="stats-item-label">Nenhum evento de webhook registrado</span></div>'
                    }
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Resetar estatísticas
async function resetStats() {
    if (!confirm('Deseja resetar todas as estatísticas? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/admin/stats/reset', {
            method: 'POST'
        });
        
        if (response.ok) {
            alert('Estatísticas resetadas com sucesso!');
            loadStats();
        } else {
            alert('Erro ao resetar estatísticas');
        }
    } catch (error) {
        alert('Erro de conexão');
    }
}

