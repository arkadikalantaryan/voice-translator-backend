
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;
const API_KEY = process.env.GOOGLE_API_KEY;

const upload = multer({ dest: 'uploads/' });

// === Перевод текста ===
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

// === Озвучка текста ===
app.post('/speak', async (req, res) => {
  const { text, lang } = req.body;

  console.log("🔈 TTS request:", text, "→", lang);

  try {
    const ttsResp = await axios.post(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`,
      {
        input: { text },
        voice: {
          languageCode: lang || "hy-AM",
          ssmlGender: "FEMALE"
        },
        audioConfig: {
          audioEncoding: "MP3"
        }
      }
    );

    const audioContent = ttsResp.data.audioContent;
    const buffer = Buffer.from(audioContent, 'base64');
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length
    });
    res.send(buffer);
  } catch (err) {
    console.error("🛑 TTS error:", err.response?.data || err.message);
    res.status(500).json({ error: 'Text-to-speech failed' });
  }
});

// === Распознавание аудио ===
app.post('/recognize', upload.single('audio'), async (req, res) => {
  const audioPath = req.file.path;
  const lang = req.body.lang || 'hy-AM';

  // 🔍 ЛОГИ для отладки
  console.log("🎤 [RECOGNIZE] File uploaded:", req.file);
  console.log("🎤 [RECOGNIZE] Lang requested:", lang);

  try {
    const audioBytes = fs.readFileSync(audioPath).toString('base64');
    const sttResp = await axios.post(
      `https://speech.googleapis.com/v1/speech:recognize?key=${API_KEY}`,
      {
        config: {
          encoding: "WEBM_OPUS",
          sampleRateHertz: 48000,
          languageCode: lang
        },
        audio: { content: audioBytes }
      }
    );

    const transcription = sttResp.data.results?.[0]?.alternatives?.[0]?.transcript || '';
    res.json({ text: transcription });
  } catch (err) {
    console.error("🛑 Speech recognition error:", err.response?.data || err.message);
    res.status(500).json({ error: 'Speech recognition failed' });
  } finally {
    fs.unlink(audioPath, () => {});
  }
});

app.listen(port, () => console.log(`✅ Server running on port ${port}`));
