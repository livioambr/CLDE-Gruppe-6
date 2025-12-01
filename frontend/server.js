const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from the frontend folder root
app.use(express.static(path.join(__dirname, '/')));

// Fallback: serve index.html for unknown routes (good for SPA navigation)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`📦 Frontend static server running: http://localhost:${PORT}`);
});