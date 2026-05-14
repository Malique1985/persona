require('dotenv').config();
const express = require('express');
const path = require('path');
const { chromium, devices } = require('playwright');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const CONFIG = {
    API_KEY: process.env.GROQ_API_KEY,
    MODEL: "llama-3.3-70b-versatile",
    URL: "https://api.groq.com/openai/v1/chat/completions"
};

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/scrape', async (req, res) => {
    let { url, engine } = req.body;
    if (url && !url.startsWith('http')) url = 'https://' + url;
    engine = engine || 'ocean';

    console.log(`\n[LOG] ULTRA-STEALTH SCRAPE: ${url}`);

    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] 
        });

        // MENYAMAR SEBAGAI IPHONE 13
        const iPhone = devices['iPhone 13'];
        const context = await browser.newContext({
            ...iPhone,
            locale: 'id-ID',
            timezoneId: 'Asia/Jakarta',
        });

        const page = await context.newPage();
        
        // Menuju profil dengan timeout lebih lama
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Simulasi interaksi manusia
        await page.waitForTimeout(2000 + Math.random() * 2000);
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(1000);

        // SCRAPING LOGIC (MOBILE OPTIMIZED)
        const data = await page.evaluate(() => {
            const getBio = () => {
                // Mencari bio di berbagai kemungkinan struktur IG Mobile
                const candidates = [
                    document.querySelector('header section div:nth-child(3) span'),
                    document.querySelector('main header section div span'),
                    document.querySelector('meta[property="og:description"]'),
                    ...Array.from(document.querySelectorAll('span')).filter(s => s.innerText.length > 10)
                ];
                for (const el of candidates) {
                    if (el) {
                        const txt = el.tagName === 'META' ? el.getAttribute('content') : el.innerText;
                        if (txt && !txt.includes('Instagram')) return txt;
                    }
                }
                return "Profil terproteksi / Login Wall aktif.";
            };

            const getCaptions = () => {
                // Mengambil dari alt text gambar (paling konsisten di server)
                const imgs = Array.from(document.querySelectorAll('img'));
                return imgs
                    .map(img => img.getAttribute('alt'))
                    .filter(alt => alt && alt.length > 20 && !alt.includes('profile picture'))
                    .slice(0, 12);
            };

            return { bio: getBio(), captions: getCaptions() };
        });

        await browser.close();

        // --- AI ANALYSIS ---
        const systemPrompt = engine === 'ocean' 
            ? "Anda adalah Pakar Psikologi OCEAN." 
            : "Anda adalah Senior HR Director. Gunakan model DISC.";
            
        const userPrompt = `Analisis Karakter dari Data Media Sosial:
        Bio: "${data.bio}"
        Captions: "${data.captions.join(' | ')}"
        
        Berikan analisa mendalam. Jika data sangat sedikit, buatlah estimasi berdasarkan gaya bahasa dan vibe konten.
        OUTPUT JSON: { "scores": ${engine === 'ocean' ? '{o,c,e,a,n}' : '{d,i,s,c,l}'}, "archetype", "summary", "narratives": ${engine === 'ocean' ? '{o,c,e,a,n}' : '{d,i,s,c,l}'} }. Bahasa: Indonesia.`;

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
        
        res.json({ 
            bio: data.bio, 
            captions: data.captions.join("\n---\n"), 
            scores: analysis.scores || {}, 
            archetype: analysis.archetype || "Analyst",
            summary: analysis.summary || "Selesai.",
            narratives: analysis.narratives || {}
        });

    } catch (error) {
        console.error('[ERR]', error.message);
        res.status(500).json({ error: 'Gagal menembus proteksi Instagram.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Persona AI v3.1 (Mobile Stealth) aktif.`));
