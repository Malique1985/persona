require('dotenv').config();
const express = require('express');
const { chromium } = require('playwright');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const CONFIG = {
    API_KEY: process.env.GROQ_API_KEY,
    MODEL: "llama-3.3-70b-versatile",
    URL: "https://api.groq.com/openai/v1/chat/completions"
};

app.post('/scrape', async (req, res) => {
    let { url, engine } = req.body;
    if (url && !url.startsWith('http')) url = 'https://' + url;
    engine = engine || 'ocean';

    console.log(`\n[LOG] ENGINE DETECTED: ${engine.toUpperCase()}`);
    console.log(`[LOG] TARGET URL: ${url}`);

    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 }
        });
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(2000);

        const bio = await page.evaluate(() => {
            const header = document.querySelector('header');
            if (!header) return "Profil terproteksi.";
            const allSpans = Array.from(header.querySelectorAll('span, div, h1'));
            const bioCandidate = allSpans.find(el => {
                const text = el.innerText.trim();
                return text.length > 5 && !/^\d+$/.test(text.replace(/[,.]/g, '')) && !text.includes('followers');
            });
            return bioCandidate ? bioCandidate.innerText : "Bio tidak ditemukan.";
        });

        const captions = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('article img'));
            return images.map(img => img.getAttribute('alt')).filter(alt => alt && alt.length > 10).slice(0, 10);
        });

        await browser.close();

        // --- CONTEXT SENSITIVE PROMPTS ---
        let systemPrompt = "";
        let userPrompt = "";

        if (engine === 'ocean') {
            systemPrompt = "Anda adalah Pakar Psikologi Kepribadian model Big Five (OCEAN).";
            userPrompt = `Analisis Bio: "${bio}" dan Captions: "${captions.join(' | ')}".
            Berikan skor 0-100 untuk Openness, Conscientiousness, Extraversion, Agreeableness, dan Neuroticism.
            FORMAT JSON: { "scores": {o,c,e,a,n}, "archetype", "summary", "narratives": {o,c,e,a,n} }. Language: Indo.`;
        } else {
            systemPrompt = "Anda adalah Senior HR Director & Recruiter Professional. Fokus pada model DISC + Leadership.";
            userPrompt = `Tugas: Evaluasi kandidat untuk rekrutmen. JANGAN gunakan model kepribadian umum.
            Data: Bio: "${bio}" | Captions: "${captions.join(' | ')}".
            
            Hitung skor (0-100) untuk metrik berikut:
            - Dominance (d): Ambisi, hasil, pengambilan risiko.
            - Influence (i): Persuasi, antusiasme, kolaborasi.
            - Steadiness (s): Kesabaran, ketulusan, loyalitas.
            - Compliance (c): Akurasi, standar, logika.
            - Leadership (l): Potensi kepemimpinan.
            
            FORMAT JSON: { "scores": {d,i,s,c,l}, "archetype": "Job Role Personality", "summary": "Executive Summary Rekrutmen", "narratives": {d,i,s,c,l} }. 
            Bahasa: Indonesia Profesional.`;
        }

        console.log(`[LOG] AI PROCESSING START...`);
        const aiResponse = await axios.post(CONFIG.URL, {
            model: CONFIG.MODEL,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0
        }, {
            headers: { 'Authorization': `Bearer ${CONFIG.API_KEY}`, 'Content-Type': 'application/json' }
        });

        const analysis = JSON.parse(aiResponse.data.choices[0].message.content);
        console.log(`[LOG] AI ANALYSIS COMPLETE.`);
        
        res.json({ 
            bio, 
            captions: captions.join("\n---\n"), 
            scores: analysis.scores || {}, 
            archetype: analysis.archetype || "Analyst",
            summary: analysis.summary || "Selesai.",
            narratives: analysis.narratives || {}
        });

    } catch (error) {
        console.error('[ERR]', error.message);
        res.status(500).json({ error: 'Gagal.' });
    }
});

const PORT = 3001; // PINDAH KE PORT 3001
app.listen(PORT, () => {
    console.log(`\n🔥 Persona AI (V3 - Port 3001) Active.`);
});
