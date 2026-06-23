/**
 * Simple static server for ConnectSphere frontend.
 * Serves all static files and redirects all unknown paths to index.html
 * so the SPA client-side router handles navigation.
 *
 * Run: node server.js
 * Opens on: http://localhost:3000
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(express.static(__dirname));

// Catch-all: serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Frontend running at http://localhost:${PORT}`);
});
