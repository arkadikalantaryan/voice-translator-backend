const express = require('express');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const { Translate } = require('@google-cloud/translate').v2;
const textToSpeech = require('@google-cloud/text-to-speech');
const speech = require('@google-cloud/speech');
const util = require('util');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
const port = process.env.PORT || 10000;

// Upload setup
const upload = multer({ dest: 'uploads/' });

// Disable Cloud API for all languages
const specialCloudLangs = [];

// Google Cloud credentials
const googleApplicationCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const credentials = googleApplicationCredentials ? JSON.parse(googleApplicationCredentials) : null;

let translateClient = null;
let ttsClient = null;
let speechClient = null;

if (credentials) {
  translateClient = new Translate({ credentials });
  ttsClient = new textToSpeech.TextToSpeechClient({ credentials });
  speechClient = new speech.SpeechClient({ credentials });
}

// ========== ROUTES ==========

app.post('/recognize', upload.single('audio'), async (req, res) => {
  const audioPath = req.file.path;
  const targetLang = req.body.lang;

  try {
    if (!specialCloudLangs.includes(targetLang)) {
      return res.status(501).json({ error: 'Default Web Speech API should handle this language.' });
    }

    const file = fs.readFileSync(audioPath);
    const audioBytes = file.toString('base64');

    const audio = {
      content: audioBytes,
    };

    const config = {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode: targetLang,
    };

    const request = {
      audio: audio,
      config: config,
    };

    const [response] = await speechClient.recognize(request);
    const transcription = response.results.map(result => result.alternatives[0].transcript).join('\n');

    res.json({ text: transcription });
  } catch (error) {
    console.error('🛑 Speech recognition error:', error);
    res.status(500).json({ error: 'Speech recognition failed.' });
  } finally {
    fs.unlink(audioPath, () => {});
  }
});

app.post('/translate', async (req, res) => {
  const { text, from, to } = req.body;

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await axios.get(url);
    const translated = response.data[0].map(obj => obj[0]).join('');
    res.json({ translated });
  } catch (error) {
    console.error('🛑 Translation error:', error);
    res.status(500).json({ error: 'Translation failed.' });
  }
});

app.post('/tts', async (req, res) => {
  const { text, lang } = req.body;

  try {
    if (!specialCloudLangs.includes(lang)) {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
      const response = await axios.get(ttsUrl, { responseType: 'arraybuffer' });
      res.set({ 'Content-Type': 'audio/mpeg' });
      res.send(response.data);
      return;
    }

    const request = {
      input: { text: text },
      voice: { languageCode: lang, name: 'hy-AM-Wavenet-A' },
      audioConfig: { audioEncoding: 'MP3' },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    res.set({ 'Content-Type': 'audio/mpeg' });
    res.send(response.audioContent);
  } catch (error) {
    console.error('🛑 TTS error:', error);
    res.status(500).json({ error: 'Text-to-speech failed.' });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
