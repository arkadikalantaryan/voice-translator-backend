require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { SpeechClient } = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // для статических файлов, если нужно

const upload = multer({ dest: 'uploads/' });
const port = process.env.PORT || 10000;

// === Speech-to-Text client ===
const speechClient = new SpeechClient();

// === Text-to-Speech client ===
const ttsClient = new textToSpeech.TextToSpeechClient();

// === POST /recognize ===
app.post('/recognize', upload.single('audio'), async (req, res) => {
  const file = req.file;
  const lang = req.body.lang || 'hy';

  console.log('🎤 [RECOGNIZE] File uploaded:', file);
  console.log('🎤 [RECOGNIZE] Lang requested:', lang);

  const filePath = path.join(__dirname, file.path);
  const audioBytes = fs.readFileSync(filePath).toString('base64');

  const request = {
    audio: {
      content: audioBytes,
    },
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 16000,
      languageCode: `${lang}-AM`,
      model: 'default',
    },
  };

  try {
    const [response] = await speechClient.recognize(request);
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    console.log('✅ [RECOGNIZE] Transcription:', transcription);
    res.json({ transcript: transcription });
  } catch (err) {
    console.error('🛑 Speech recognition error:', err);
    res.status(500).json({ error: 'Speech recognition failed' });
  } finally {
    fs.unlink(filePath, () => {}); // удалить файл после обработки
  }
});

// === POST /speak ===
app.post('/speak', async (req, res) => {
  const { text, lang } = req.body;
  console.log(`🔈 TTS request: ${text} → ${lang}`);

  try {
    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: { languageCode: `${lang}-AM`, ssmlGender: 'FEMALE' },
      audioConfig: { audioEncoding: 'MP3' },
    });

    res.set('Content-Type', 'audio/mpeg');
    res.send(response.audioContent);
  } catch (err) {
    console.error('🛑 TTS error:', err);
    res.status(500).json({ error: 'Text-to-speech failed' });
  }
});

// === Start Server ===
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
