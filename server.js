const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const speech = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

const speechClient = new speech.SpeechClient();
const ttsClient = new textToSpeech.TextToSpeechClient();

// 🔧 временно отключаем использование Google Cloud API для этих языков
const specialCloudLangs = []; // можно снова включить ['hy']

// 🎧 РАСПОЗНАВАНИЕ РЕЧИ
app.post('/recognize', upload.single('audio'), async (req, res) => {
  console.log('🎤 [RECOGNIZE] File uploaded:', req.file);
  const lang = req.body.lang || 'en';
  console.log('🎤 [RECOGNIZE] Lang requested:', lang);

  if (!specialCloudLangs.includes(lang)) {
    return res.status(400).json({ error: 'Speech recognition for this language is not supported by Cloud API.' });
  }

  const audioBytes = fs.readFileSync(req.file.path).toString('base64');

  const request = {
    audio: { content: audioBytes },
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000, // автоопределяется
      languageCode: lang,
    },
  };

  try {
    const [response] = await speechClient.recognize(request);
    const transcription = response.results?.map(r => r.alternatives[0].transcript).join('\n') || '';
    console.log('✅ [RECOGNIZE] Transcription:', transcription);
    res.json({ text: transcription });
  } catch (error) {
    console.error('🛑 Speech recognition error:', error);
    res.status(500).json({ error: 'Ошибка распознавания (сервер)' });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// 🌐 ПЕРЕВОД
app.post('/translate', async (req, res) => {
  const { text, from, to } = req.body;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await axios.get(url);
    const translatedText = response.data[0][0][0];
    console.log(`🌐 [TRANSLATE] ${text} → ${translatedText}`);
    res.json({ text: translatedText });
  } catch (error) {
    console.error('🛑 Translation error:', error);
    res.status(500).json({ error: 'Ошибка перевода' });
  }
});

// 🔊 ОЗВУЧКА
app.post('/speak', async (req, res) => {
  const { text, lang } = req.body;
  console.log(`🔈 TTS request: ${text} → ${lang}`);

  if (!specialCloudLangs.includes(lang)) {
    return res.status(400).json({ error: 'Озвучка этого языка поддерживается только в браузере' });
  }

  let voiceName = null;
  if (lang === 'hy') voiceName = 'hy-AM-Wavenet-A';

  const request = {
    input: { text },
    voice: {
      languageCode: lang,
      name: voiceName,
    },
    audioConfig: {
      audioEncoding: 'MP3',
    },
  };

  try {
    const [response] = await ttsClient.synthesizeSpeech(request);
    res.set('Content-Type', 'audio/mp3');
    res.send(response.audioContent);
  } catch (error) {
    console.error('🛑 TTS error:', error);
    res.status(500).json({ error: 'Ошибка озвучки (сервер)' });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
