require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const documentRoutes = require('./routes/document.routes');
const publicRoutes = require('./routes/public.routes');
const settingsRoutes = require('./routes/settings.routes');

const app = express();

// CORS - allow multiple origins 
const allowedOrigins = (process.env.CORS_ORIGIN || 'https://eportal-fze.ae,https://www.eportal-fze.ae')
.split(',')
.map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, Postman, etc.)
    if (!origin) return cb(null, true);
    cb(null, allowedOrigins.some(a => origin.startsWith(a)) || allowedOrigins.includes('*'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// Settings
app.use('/api/settings', settingsRoutes);

// Public PDF route
app.use('/pdf', publicRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../public')));
  app.get('*', (req, res, next) => {
  if (
    req.path === '/health' ||
    req.path.startsWith('/api') ||
    req.path.startsWith('/pdf')
  ) {
    return next();
  }

  res.sendFile(path.join(__dirname, '../public/index.html'));
});
}

// Health check

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});



const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
