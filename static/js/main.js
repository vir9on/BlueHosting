// Auth modal functionality
const authModal = document.querySelector('.modal-auth');
const authTabs = document.querySelectorAll('.auth-tab');
const authForms = document.querySelectorAll('.auth-form');

function showAuthModal() {
    authModal.classList.add('show');
}

function hideAuthModal() {
    authModal.classList.remove('show');
}

function switchAuthTab(tab) {
    authTabs.forEach(t => t.classList.remove('active'));
    authForms.forEach(f => f.style.display = 'none');
    
    tab.classList.add('active');
    const formId = tab.getAttribute('data-form');
    document.getElementById(formId).style.display = 'flex';
}

// Profile menu functionality
const profileButton = document.querySelector('.profile-button');
const profileMenu = document.querySelector('.profile-menu');

if (profileButton) {
    profileButton.addEventListener('click', (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle('show');
    });
}

document.addEventListener('click', (e) => {
    if (profileMenu && !profileMenu.contains(e.target) && !profileButton.contains(e.target)) {
        profileMenu.classList.remove('show');
    }
});

// Form submission handlers
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(loginForm);
        const data = {
            username: formData.get('username'),
            password: formData.get('password')
        };

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (result.success) {
                window.location.reload();
            } else {
                alert(result.message || 'Ошибка входа');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Произошла ошибка при входе');
        }
    });
}

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(registerForm);
        const data = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password'),
            confirm_password: formData.get('confirm_password')
        };

        if (data.password !== data.confirm_password) {
            alert('Пароли не совпадают');
            return;
        }

        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (result.success) {
                window.location.reload();
            } else {
                alert(result.message || 'Ошибка регистрации');
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Произошла ошибка при регистрации');
        }
    });
}

// Balance update functionality
async function updateBalance(amount) {
    try {
        const response = await fetch('/api/balance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount })
        });

        const result = await response.json();
        
        if (result.success) {
            const balanceElement = document.querySelector('.balance');
            if (balanceElement) {
                balanceElement.textContent = `${result.balance} ₽`;
            }
        } else {
            alert(result.message || 'Ошибка обновления баланса');
        }
    } catch (error) {
        console.error('Balance update error:', error);
        alert('Произошла ошибка при обновлении баланса');
    }
}

// Server management functionality
async function getServers() {
    try {
        const response = await fetch('/api/servers');
        const servers = await response.json();
        return servers;
    } catch (error) {
        console.error('Get servers error:', error);
        return [];
    }
}

// Chat functionality
const chatForm = document.getElementById('chat-form');
const chatMessages = document.getElementById('chat-messages');

if (chatForm && chatMessages) {
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(chatForm);
        const data = {
            message: formData.get('message')
        };

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (result.success) {
                chatForm.reset();
                appendMessage(result.message);
            } else {
                alert(result.message || 'Ошибка отправки сообщения');
            }
        } catch (error) {
            console.error('Chat message error:', error);
            alert('Произошла ошибка при отправке сообщения');
        }
    });

    // Load initial messages
    loadMessages();

    // Poll for new messages
    setInterval(loadMessages, 5000);
}

async function loadMessages() {
    try {
        const response = await fetch('/api/chat');
        const messages = await response.json();
        
        chatMessages.innerHTML = '';
        messages.forEach(message => appendMessage(message));
    } catch (error) {
        console.error('Load messages error:', error);
    }
}

function appendMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="message-author">${message.author}</span>
            <span class="message-time">${new Date(message.timestamp).toLocaleString()}</span>
        </div>
        <div class="message-content">${message.content}</div>
    `;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
} 