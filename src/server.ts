import express from 'express';
import { initDb } from './services/db';
import routes from './routes';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// Serve dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dashboard.html'));
});

// Serve test page
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'test_qr.html'));
});

// Routes
app.use('/api', routes);

// Initialize DB
initDb();

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Dashboard available at: http://localhost:${PORT}`);
});
