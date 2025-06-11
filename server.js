require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const { SpeechClient } = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');

const app = express();
const port = process.env.PORT || 10000;
const API_KEY = process.env.GOOGLE_API_KEY;
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

const upload = multer({ dest: 'uploads/' });
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔧 Список языков, использующих Google Cloud API
const specialCloudLangs = ['hy']; // ← Закомментируй или очисти массив, чтобы отключить

// 🌍 Перевод текста
app.post('/translate', async (req, res) => {
  const { text, target } = req.body;
  try {
    const resp = await axios.post(
      'https://translation.googleapis.com/language/translate/v2',
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
    console.error("🔁 Translation error:", e.toJSON());
    res.status(500).json({ error: 'Translation failed' });
  }
});

// 🎤 Распознавание речи (Google Cloud только для specialCloudLangs)
app.post('/recognize', upload.single('audio'), async (req, res) => {
  console.log("🎤 [RECOGNIZE] File uploaded:", req.file);

  const filePath = req.file.path;
  const languageCode = req.body.lang || 'hy';
  console.log("🎤 [RECOGNIZE] Lang requested:", languageCode);

  if (!specialCloudLangs.includes(languageCode)) {
    return res.status(400).json({ error: "This language is not supported for cloud recognition." });
  }

  const client = new SpeechClient({ credentials });

  try {
    const audioBytes = fs.readFileSync(filePath).toString('base64');

    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 16000,
        languageCode: languageCode,
        model: 'default',
      },
    };

    const [response] = await client.recognize(request);
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');
    
    console.log("✅ [RECOGNIZE] Transcription:", transcription);
    res.json({ text: transcription });
  } catch (error) {
    console.error("🛑 Speech recognition error:", error);
    res.status(500).json({ error: "Speech recognition failed", details: error });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

// 🔈 Озвучка текста
app.post('/speak', async (req, res) => {
  const { text, lang } = req.body;
  console.log(`🔈 TTS request: ${text} → ${lang}`);

  if (!specialCloudLangs.includes(lang)) {
    return res.status(400).json({ error: "Cloud TTS is only enabled for special languages" });
  }

  const client = new textToSpeech.TextToSpeechClient({ credentials });

  try {
    const [result] = await client.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: 'hy-AM',
        name: 'hy-AM-Wavenet-A' // обязательно указываем имя голоса
      },
      audioConfig: {
        audioEncoding: 'MP3'
      }
    });

    res.set('Content-Type', 'audio/mpeg');
    res.send(result.audioContent);
  } catch (error) {
    console.error("🛑 TTS error:", error);
    res.status(500).json({ error: 'Text-to-speech failed', details: error });
  }
});

app.listen(port, () => console.log(`✅ Server running on port ${port}`));
