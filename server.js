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

        // --- ULTRA-STEALTH ADAPTIVE SCRAPE ---
        const data = await page.evaluate(() => {
            const cleanText = (t) => t ? t.replace(/\s+/g, ' ').trim() : "";
            
            const getBio = () => {
                const spans = Array.from(document.querySelectorAll('span, h1, div'));
                const statsKeywords = ['pengikut', 'diikuti', 'following', 'followers', 'posts', 'postingan'];
                
                // Cari teks yang bukan statistik dan punya panjang yang masuk akal
                const bioEl = spans.find(s => {
                    const t = s.innerText.toLowerCase();
                    return t.length > 3 && 
                           !statsKeywords.some(k => t.includes(k)) && 
                           !t.includes('instagram') &&
                           s.children.length === 0; // Ambil yang paling dalam (leaf node)
                });
                return bioEl ? bioEl.innerText : "Bio tidak ditemukan atau tersembunyi.";
            };

            const getCaptions = () => {
                const imgs = Array.from(document.querySelectorAll('img'));
                const blacklist = ['foto profil', 'profile picture', 'icon', 'logo'];
                return imgs
                    .map(img => img.getAttribute('alt'))
                    .filter(alt => {
                        if (!alt || alt.length < 5) return false;
                        const lowAlt = alt.toLowerCase();
                        return !blacklist.some(b => lowAlt.includes(b));
                    })
                    .slice(0, 15);
            };

            return { bio: cleanText(getBio()), captions: getCaptions() };
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

        const rawAnalysis = JSON.parse(aiResponse.data.choices[0].message.content);
        
        // NORMALISASI SKOR (0-1 -> 0-100)
        const normalizedScores = {};
        if (rawAnalysis.scores) {
            for (const [key, val] of Object.entries(rawAnalysis.scores)) {
                let score = Number(val);
                if (score <= 1.0 && score > 0) score = score * 100; // Jika 0.6 jadi 60
                normalizedScores[key] = Math.round(score);
            }
        }

        res.json({ 
            bio: data.bio, 
            captions: data.captions.join("\n---\n"), 
            scores: normalizedScores, 
            archetype: rawAnalysis.archetype || "Analyst",
            summary: rawAnalysis.summary || "Selesai.",
            narratives: rawAnalysis.narratives || {}
        });

    } catch (error) {
        console.error('[ERR]', error.message);
        res.status(500).json({ error: 'Gagal menembus proteksi Instagram.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Persona AI v3.1 (Mobile Stealth) aktif.`));
