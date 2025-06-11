require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');
const textToSpeech = require('@google-cloud/text-to-speech');
const speech = require('@google-cloud/speech');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

const port = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// 🔐 Авторизация через JSON в переменной окружения
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
const auth = new GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

// 🎤 Распознавание речи через Google Cloud
app.post('/recognize', upload.single('audio'), async (req, res) => {
  console.log('🎤 [RECOGNIZE] File uploaded:', req.file);
  const file = fs.readFileSync(req.file.path);
  const audioBytes = file.toString('base64');
  const lang = req.body.lang || 'hy';
  console.log('🎤 [RECOGNIZE] Lang requested:', lang);

  try {
    const client = new speech.SpeechClient({ auth });
    const [response] = await client.recognize({
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: lang,
      },
      audio: {
        content: audioBytes,
      },
    });

    const transcription = response.results.map(r => r.alternatives[0].transcript).join('\n');
    console.log('✅ [RECOGNIZE] Transcription:', transcription);
    res.json({ transcription });
  } catch (error) {
    console.error('🛑 Speech recognition error:', error);
    res.status(500).json({ error: 'Speech recognition failed' });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// 🔈 Озвучка перевода через Google Cloud TTS
app.post('/speak', async (req, res) => {
  const { text, lang } = req.body;
  console.log(`🔈 TTS request: ${text} → ${lang}`);

  try {
    const client = new textToSpeech.TextToSpeechClient({ auth });
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode: lang, ssmlGender: 'FEMALE' },
      audioConfig: { audioEncoding: 'MP3' },
    });

    res.set('Content-Type', 'audio/mpeg');
    res.send(response.audioContent);
  } catch (error) {
    console.error('🛑 TTS error:', error);
    res.status(500).json({ error: 'Text-to-speech failed' });
  }
});

// 🌍 Перевод текста (через Google Translate API)
app.post('/translate', async (req, res) => {
  const { text, target } = req.body;
  try {
    const resp = await axios.post(
      `https://translation.googleapis.com/language/translate/v2`,
      {},
      {
        params: {
          key: GOOGLE_API_KEY,
          q: text,
          target: target,
        },
      }
    );
    res.json({ translatedText: resp.data.data.translations[0].translatedText });
  } catch (e) {
    console.error(e.toJSON());
    res.status(500).json({ error: 'Translation failed' });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
