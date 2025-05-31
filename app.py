from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    balance = db.Column(db.Float, default=0.0)
    role = db.Column(db.String(20), default='user')
    servers = db.relationship('Server', backref='owner', lazy=True)
    messages = db.relationship('Message', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Server(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    game = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Float, nullable=False)
    period = db.Column(db.String(20), nullable=False)
    features = db.Column(db.Text)
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    is_from_support = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user)
            return jsonify({'success': True})
        return jsonify({'success': False, 'error': 'Invalid username or password'})
    return render_template('login.html')

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'success': False, 'error': 'Username already exists'})
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'success': False, 'error': 'Email already registered'})
    
    user = User(username=data['username'], email=data['email'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/api/balance', methods=['GET', 'POST'])
@login_required
def handle_balance():
    if request.method == 'POST':
        amount = float(request.json.get('amount', 0))
        current_user.balance += amount
        db.session.commit()
        return jsonify({'success': True, 'balance': current_user.balance})
    return jsonify({'balance': current_user.balance})

@app.route('/api/servers', methods=['GET'])
@login_required
def get_servers():
    servers = Server.query.filter_by(user_id=current_user.id).all()
    return jsonify([{
        'id': s.id,
        'name': s.name,
        'game': s.game,
        'price': s.price,
        'period': s.period,
        'features': s.features,
        'status': s.status,
        'created_at': s.created_at.isoformat()
    } for s in servers])

@app.route('/api/chat', methods=['GET', 'POST'])
@login_required
def handle_chat():
    if request.method == 'POST':
        content = request.json.get('content')
        message = Message(
            content=content,
            user_id=current_user.id,
            is_from_support=current_user.role == 'admin'
        )
        db.session.add(message)
        db.session.commit()
        return jsonify({'success': True})
    
    messages = Message.query.filter_by(user_id=current_user.id).order_by(Message.timestamp).all()
    return jsonify([{
        'id': m.id,
        'content': m.content,
        'timestamp': m.timestamp.isoformat(),
        'is_from_support': m.is_from_support
    } for m in messages])

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True) 