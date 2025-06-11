const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { Translate } = require('@google-cloud/translate').v2;
const speech = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');
const util = require('util');
const app = express();

const PORT = process.env.PORT || 10000;
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({ dest: 'uploads/' });
const speechClient = new speech.SpeechClient();
const ttsClient = new textToSpeech.TextToSpeechClient();
const translateClient = new Translate();

// 🔧 Список языков, для которых включены облачные функции (STT/TTS)
const specialCloudLangs = ['hy'];

app.post('/recognize', upload.single('audio'), async (req, res) => {
  const audioPath = req.file.path;
  const languageCode = req.body.lang;

  console.log('🎤 [RECOGNIZE] File uploaded:', req.file);
  console.log('🎤 [RECOGNIZE] Lang requested:', languageCode);

  try {
    const file = fs.readFileSync(audioPath);
    const audioBytes = file.toString('base64');

    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: 'WEBM_OPUS',
        languageCode: languageCode,
        model: 'default'
        // ❌ sampleRateHertz удалён, Google сам определяет его из WebM OPUS
      }
    };

    const [response] = await speechClient.recognize(request);
    const transcription = response.results.map(r => r.alternatives[0].transcript).join('\n');
    console.log('✅ [RECOGNIZE] Transcription:', transcription);

    res.json({ text: transcription });
  } catch (error) {
    console.error('🛑 Speech recognition error:', error);
    res.status(500).json({ error: 'Speech recognition failed (server)' });
  } finally {
    fs.unlink(audioPath, () => {});
  }
});

app.post('/translate', async (req, res) => {
  const { text, source, target } = req.body;

  try {
    const [translation] = await translateClient.translate(text, { from: source, to: target });
    res.json({ translation });
  } catch (error) {
    console.error('🛑 Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

app.post('/speak', async (req, res) => {
  const { text, lang } = req.body;
  console.log(`🔈 TTS request: ${text} → ${lang}`);

  if (lang === 'hy') {
    // Армянский пока не поддерживается в Google TTS
    return res.status(400).json({ error: "TTS for Armenian is not supported yet." });
  }

  try {
    const request = {
      input: { text },
      voice: {
        languageCode: lang,
        ssmlGender: 'MALE'
      },
      audioConfig: {
        audioEncoding: 'MP3'
      }
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    const audioContent = response.audioContent.toString('base64');
    res.json({ audioContent });
  } catch (error) {
    console.error('🛑 TTS error:', error);
    res.status(500).json({ error: 'Speech synthesis failed' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
