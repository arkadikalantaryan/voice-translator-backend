require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const { SpeechClient } = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');

const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 10000;

// Перевод (все языки)
app.post('/translate', async (req, res) => {
  const { text, target } = req.body;
  try {
    const resp = await axios.post(
      `https://translation.googleapis.com/language/translate/v2`,
      {},
      {
        params: {
          key: process.env.GOOGLE_API_KEY,
          q: text,
          target: target,
        },
      }
    );
    const translated = resp.data.data.translations[0].translatedText;
    res.json({ translatedText: translated });
  } catch (e) {
    console.error('🔴 Translate error:', e?.response?.data || e.message);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Файлы
const upload = multer({ dest: 'uploads/' });

// Распознавание речи (только для hy)
app.post('/recognize', upload.single('audio'), async (req, res) => {
  const file = req.file;
  const lang = req.body.lang || 'hy';
  console.log('🎤 [RECOGNIZE] File uploaded:', file);
  console.log('🎤 [RECOGNIZE] Lang requested:', lang);

  try {
    const client = new SpeechClient();
    const audioBytes = fs.readFileSync(file.path).toString('base64');
    const audio = { content: audioBytes };
    const config = {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode: lang === 'hy' ? 'hy-AM' : lang,
      model: 'default',
    };

    const [response] = await client.recognize({ audio, config });
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    console.log('✅ [RECOGNIZE] Transcription:', transcription);
    res.json({ text: transcription });
  } catch (err) {
    console.error('🛑 Speech recognition error:', err);
    res.status(500).json({ error: 'Speech recognition failed' });
  } finally {
    fs.unlink(file.path, () => {});
  }
});

// Озвучка (только для hy)
app.post('/speak', async (req, res) => {
  const { text, lang } = req.body;
  console.log(`🔈 TTS request: ${text} → ${lang}`);

  try {
    const client = new textToSpeech.TextToSpeechClient();
    const request = {
      input: { text },
      voice: {
        languageCode: 'hy-AM',
        name: 'hy-AM-Wavenet-A', // можно поменять при необходимости
      },
      audioConfig: { audioEncoding: 'MP3' },
    };

    const [response] = await client.synthesizeSpeech(request);
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.audioContent);
  } catch (err) {
    console.error('🛑 TTS error:', err);
    res.status(500).json({ error: 'TTS failed' });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
