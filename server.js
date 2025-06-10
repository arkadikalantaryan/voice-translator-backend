require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const API_KEY = process.env.GOOGLE_API_KEY;

app.post('/translate', async (req, res) => {
  const { text, target } = req.body;
  try {
    const resp = await axios.post(
      `https://translation.googleapis.com/language/translate/v2`,
      {},
      {
        params: {
          key: API_KEY,
          q: text,
          target: target
        }
      }
    );
    res.json({ translatedText: resp.data.data.translations[0].translatedText });
  } catch (e) {
    console.error(e.toJSON());
    res.status(500).json({ error: 'Translation failed' });
  }
});

app.listen(port, () => console.log(`Server on port ${port}`));
