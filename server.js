require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Google Cloud Speech and TTS
const speech = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Файлы для распознавания речи
const upload = multer({ dest: 'uploads/' });

// Инициализация клиентов
const speechClient = new speech.SpeechClient();
const ttsClient = new textToSpeech.TextToSpeechClient();

// ✅ Перевод текста
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
          target: target
        }
      }
    );
    res.json({ translatedText: resp.data.data.translations[0].translatedText });
  } catch (e) {
    console.error('🛑 Translation error:', e.toJSON?.() || e.message);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// ✅ Распознавание речи
app.post('/recognize', upload.single('audio'), async (req, res) => {
  console.log('🎤 [RECOGNIZE] File uploaded:', req.file);
  const lang = req.body.lang || 'en';
  console.log('🎤 [RECOGNIZE] Lang requested:', lang);

  const filePath = path.join(__dirname, req.file.path);
  const file = fs.readFileSync(filePath);
  const audioBytes = file.toString('base64');

  const audio = { content: audioBytes };
  const config = {
    encoding: 'WEBM_OPUS',
    sampleRateHertz: 48000,
    languageCode: lang === 'hy' ? 'hy-AM' : lang
  };
  const request = { audio, config };

  try {
    const [response] = await speechClient.recognize(request);
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');
    console.log('✅ [RECOGNIZE] Transcription:', transcription);
    res.json({ transcription });
  } catch (err) {
    console.error('🛑 Speech recognition error:', err);
    res.status(500).json({ error: 'Speech recognition failed' });
  } finally {
    fs.unlinkSync(filePath);
  }
});

// ✅ Озвучка текста
app.post('/speak', async (req, res) => {
  const { text, lang } = req.body;
  console.log(`🔈 TTS request: ${text} → ${lang}`);

  try {
    const request = {
      input: { text },
      voice: {
        languageCode: lang === 'hy' ? 'hy-AM' : lang,
        name: lang === 'hy' ? 'hy-AM-Wavenet-A' : undefined
      },
      audioConfig: {
        audioEncoding: 'MP3'
      }
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.audioContent);
  } catch (error) {
    console.error('🛑 TTS error:', error);
    res.status(500).json({ error: 'Text-to-speech failed' });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
