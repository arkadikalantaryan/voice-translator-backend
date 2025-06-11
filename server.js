const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const upload = multer({ dest: 'uploads/' });

app.post('/translate', async (req, res) => {
  const { text, source, target } = req.body;
  try {
    const response = await axios.get('https://translate.googleapis.com/translate_a/single', {
      params: {
        client: 'gtx',
        sl: source,
        tl: target,
        dt: 't',
        q: text,
      },
    });

    const translation = response.data[0].map((t) => t[0]).join('');
    res.json({ translation });
  } catch (error) {
    console.error('🛑 Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

app.post('/recognize', upload.single('audio'), async (req, res) => {
  const lang = req.body.lang || 'en';
  const filePath = req.file.path;

  console.log('🎤 [RECOGNIZE] File uploaded:', req.file);
  console.log('🎤 [RECOGNIZE] Lang requested:', lang);

  // Вместо облачного STT — временный заглушка
  return res.status(500).json({ error: 'Speech recognition (server) temporarily disabled' });

  // (Позже можно добавить Web Speech API client-side и использовать это только для загрузки)
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
