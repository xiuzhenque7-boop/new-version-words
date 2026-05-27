import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();

// Increase JSON payload size limits to securely transfer photo base64 data strings
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API Route: Generate word details (phonetic, translation, example sentence)
app.post('/api/gemini/generate-word-details', async (req, res) => {
  try {
    const { words } = req.body;

    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of English words.' });
    }

    const prompt = `You are an expert lexicographer and English dictionary helper.
Generate details (phonetic, Chinese translation, example sentence, and sentence translation) for the following words:
${words.join(', ')}

Provide accurate International Phonetic Alphabet (IPA) phonetics. Keep translations brief and easy to memorize.
Formulate illustrative example sentences using each word in appropriate context, and provide their Chinese translation.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "A list of generated dictionary items corresponding to the requested words.",
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING, description: "The original English word (trimmed and normalized)." },
              phonetic: { type: Type.STRING, description: "IPA phonetic transcription, e.g., /ˈbjuːtɪfl/ or /æpl/." },
              translation: { type: Type.STRING, description: "Brief Chinese translation, e.g., '美丽的，漂亮的' or '苹果'." },
              sentence: { type: Type.STRING, description: "An illustrative English sentence containing the word." },
              sentenceTranslation: { type: Type.STRING, description: "The Chinese translation of the illustrative sentence." }
            },
            required: ["word", "phonetic", "translation", "sentence", "sentenceTranslation"]
          }
        }
      }
    });

    const textOutput = response.text || "[]";
    let data = [];
    try {
      data = JSON.parse(textOutput.trim());
    } catch (jsonErr) {
      console.error("JSON parsing error: ", jsonErr, textOutput);
      return res.status(500).json({ error: 'Failed to process AI JSON response.', raw: textOutput });
    }

    res.json({ success: true, results: data });
  } catch (error: any) {
    console.error('API Error in generate-word-details:', error);
    res.status(500).json({ error: error.message || 'Error communicating with Gemini' });
  }
});

// API Route: Intelligent word OCR from photo
app.post('/api/gemini/import-ocr', async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: 'Please upload an image file.' });
    }

    const imagePart = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: base64Data
      }
    };

    const promptPart = {
      text: `You are an assistant specialized in language learning.
Analyze this photo (which could be a vocabulary notebook, a textbook list, handwriting, or flashcards).
Identify and extract all English vocabulary words visible in the image.
Include ONLY actual, meaningful English words (filter out numbers, unrelated symbols, page numbers, or fragmented UI labels).

For EVERY extracted word, automatically retrieve/generate:
1. Standard IPA pronunciation phonetics.
2. The core Chinese translation.
3. An elegant English example sentence showing typical usage.
4. The Chinese translation of that example sentence.

Generate correct and complete structures for all recognized words.`
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, promptPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "A list of dictionary cards extracted from the image.",
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING, description: "The recognized English word, capitalized normally or lowercased." },
              phonetic: { type: Type.STRING, description: "Correct IPA pronunciation, e.g. /æpl/." },
              translation: { type: Type.STRING, description: "Accurate Chinese translation." },
              sentence: { type: Type.STRING, description: "A simple illustrative sentence containing the word." },
              sentenceTranslation: { type: Type.STRING, description: "Chinese translation of the example sentence." }
            },
            required: ["word", "phonetic", "translation", "sentence", "sentenceTranslation"]
          }
        }
      }
    });

    const textOutput = response.text || "[]";
    let data = [];
    try {
      data = JSON.parse(textOutput.trim());
    } catch (jsonErr) {
      console.error("OCR JSON failure:", jsonErr, textOutput);
      return res.status(500).json({ error: 'Failed to parse extracted words from photo OCR.', raw: textOutput });
    }

    res.json({ success: true, results: data });
  } catch (error: any) {
    console.error('API Error in import-ocr:', error);
    res.status(500).json({ error: error.message || 'Error performing OCR with Gemini' });
  }
});

// Export default for Vercel Serverless compatibility
export default app;
