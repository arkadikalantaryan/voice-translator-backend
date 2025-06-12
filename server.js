require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Настройка CORS
app.use(cors({
  origin: [
    'https://myglobalinfo.com',
    'https://vtranslator.myglobalinfo.com'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// Обработка preflight-запросов
app.options('*', cors());

app.use(express.json());

const port = process.env.PORT || 3000;
const API_KEY = process.env.GOOGLE_API_KEY;

app.post('/translate', async (req, res) => {
  const { text, source, target } = req.body;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await axios.get(url);
    const translatedText = response.data[0].map(item => item[0]).join('');
    res.json({ translatedText });
  } catch (error) {
    console.error('[TRANSLATE ERROR]', error.toJSON ? error.toJSON() : error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

app.listen(port, () => console.log(`Server on port ${port}`));
