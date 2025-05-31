# Blue Hosting Website

A modern web application for managing hosting services, built with Flask and SQLAlchemy.

## Features

- User authentication (login/register)
- Server management
- Real-time chat support
- Balance management
- Admin panel
- Responsive design

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd <repository-name>
```

2. Create a virtual environment:
```bash
python -m venv venv
```

3. Activate the virtual environment:
- Windows:
```bash
venv\Scripts\activate
```
- Linux/Mac:
```bash
source venv/bin/activate
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Set up environment variables:
Create a `.env` file in the root directory with the following content:
```
FLASK_APP=app.py
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
```

## Running the Application

1. Initialize the database:
```bash
flask db init
flask db migrate
flask db upgrade
```

2. Run the development server:
```bash
flask run
```

The application will be available at `http://localhost:5000`

## Project Structure

```
.
├── app.py              # Main application file
├── requirements.txt    # Python dependencies
├── static/            # Static files (CSS, JS, images)
│   ├── css/
│   ├── js/
│   └── images/
├── templates/         # HTML templates
│   ├── base.html
│   └── index.html
└── instance/         # Instance-specific files (database)
```

## API Endpoints

### Authentication
- `POST /login` - User login
- `POST /register` - User registration
- `GET /logout` - User logout

### Server Management
- `GET /api/servers` - Get user's servers
- `POST /api/servers` - Create new server
- `PUT /api/servers/<id>` - Update server
- `DELETE /api/servers/<id>` - Delete server

### Chat
- `GET /api/chat` - Get chat messages
- `POST /api/chat` - Send new message

### Balance
- `GET /api/balance` - Get user balance
- `POST /api/balance` - Update user balance

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 