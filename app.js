document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-btn');
    const analyzeManualBtn = document.getElementById('analyze-manual-btn');
    const profileUrl = document.getElementById('profile-url');
    const statusMsg = document.getElementById('status-message');
    const statusText = document.getElementById('status-text');
    const instructionText = document.getElementById('instruction-text');
    const resultsSection = document.getElementById('results-section');
    const metadataDisplay = document.getElementById('metadata-display');
    const metadataContent = document.getElementById('metadata-content');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const engineBtns = document.querySelectorAll('.engine-btn');
    
    let oceanChart = null;
    let currentEngine = 'ocean';

    // Tab Logic
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });

    // Engine Selector Logic
    engineBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            engineBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentEngine = btn.dataset.engine;
            console.log("Selected Engine:", currentEngine);
        });
    });

    async function runAnalysis(type, data) {
        instructionText.classList.add('instruction-hidden');
        statusMsg.classList.remove('status-hidden');
        resultsSection.classList.add('results-hidden');
        resultsSection.classList.remove('results-visible');
        metadataDisplay.classList.add('metadata-hidden');

        let finalData;

        if (type === 'manual') {
            statusText.innerText = "Menganalisa input manual...";
            await new Promise(r => setTimeout(r, 500));
            finalData = {
                name: "Manual Analysis",
                type: "Local Profile",
                analysis: "Analisis manual dilakukan berdasarkan data input lokal.",
                tags: ["Manual"],
                scores: { o: 50, c: 50, e: 50, a: 50, n: 50 },
                narratives: { o: "N/A", c: "N/A", e: "N/A", a: "N/A", n: "N/A" }
            };
        } else {
            statusText.innerText = "investigasi profil, caption dan tag terbaru...";
            try {
                const response = await fetch('/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: data.url, engine: currentEngine })
                });

                if (!response.ok) throw new Error('AI Server error.');
                
                const result = await response.json();

                metadataContent.innerText = `BIO:\n${result.bio || 'Tidak ditemukan'}\n\nCAPTIONS:\n${result.captions || 'Tidak ditemukan'}`;
                metadataDisplay.classList.remove('metadata-hidden');
                metadataDisplay.classList.add('metadata-visible');

                const aiPhaseText = currentEngine === 'ocean' ? "Menganalisa Personal DNA (OCEAN)..." : "Mengkalkulasi Professional Fit (DISC)...";
                statusText.innerText = `AGENT AI: ${aiPhaseText}`;
                
                let username = data.url.split('/').filter(p => p).pop() || 'User';
                if (username.includes('?')) username = username.split('?')[0];

                finalData = {
                    name: username,
                    type: result.archetype || "Unknown",
                    analysis: result.summary || "No summary available.",
                    tags: [currentEngine === 'ocean' ? "Personality DNA" : "Professional Fit", "Groq Expert"],
                    scores: result.scores || {},
                    narratives: result.narratives || {},
                    labels: result.labels || {}
                };
                
            } catch (err) {
                console.error("Frontend Error:", err);
                statusText.innerText = "Gagal: Pastikan server.js berjalan.";
                setTimeout(() => {
                    statusMsg.classList.add('status-hidden');
                    instructionText.classList.remove('instruction-hidden');
                }, 3000);
                return;
            }
        }

        statusMsg.classList.add('status-hidden');
        metadataDisplay.classList.add('metadata-hidden');
        displayResults(finalData);
    }

    function displayResults(data) {
        try {
            document.getElementById('profile-name').innerText = `@${data.name}`;
            document.getElementById('profile-type').innerText = data.type;
            document.getElementById('analysis-text').innerText = data.analysis;
            
            const tagsContainer = document.getElementById('tags');
            tagsContainer.innerHTML = '';
            data.tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag';
                span.innerText = `#${tag}`;
                tagsContainer.appendChild(span);
            });

            // Update Trait Cards
            const traitKeys = Object.keys(data.scores);
            const traitGrid = document.querySelector('.traits-narrative-grid');
            traitGrid.innerHTML = ''; 

            const fullLabels = {
                o: "Openness", c: "Conscientiousness", e: "Extraversion", a: "Agreeableness", n: "Neuroticism",
                d: "Dominance", i: "Influence", s: "Steadiness", l: "Leadership"
            };
            
            // Overwrite 'c' for Professional mode
            if (currentEngine === 'disc') fullLabels.c = "Compliance";

            traitKeys.forEach(key => {
                const val = data.scores[key];
                const label = (data.labels && data.labels[key]) || fullLabels[key.toLowerCase()] || key.toUpperCase();
                const nar = data.narratives[key] || "No data.";

                const card = document.createElement('div');
                card.className = 'trait-narrative-card';
                card.innerHTML = `
                    <div class="trait-header">
                        <span class="trait-title">${label}</span>
                        <span class="trait-score">${val}%</span>
                    </div>
                    <div class="mini-bar"><div class="bar" style="width: ${val}%"></div></div>
                    <p class="trait-desc">${nar}</p>
                `;
                traitGrid.appendChild(card);
            });

            renderRadarChart(data.scores, data.labels);
            
            resultsSection.classList.remove('results-hidden');
            resultsSection.classList.add('results-visible');
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        } catch (e) {
            console.error("Display Error:", e);
        }
    }

    function renderRadarChart(scores, labels) {
        const container = document.querySelector('.chart-container');
        container.innerHTML = '<canvas id="oceanChart"></canvas>';
        const ctx = document.getElementById('oceanChart').getContext('2d');

        const traitKeys = Object.keys(scores);
        const fallbackLabels = {
            o: "Openness", c: "Conscientiousness", e: "Extraversion", a: "Agreeableness", n: "Neuroticism",
            d: "Dominance", i: "Influence", s: "Steadiness", l: "Leadership"
        };
        if (currentEngine === 'disc') fallbackLabels.c = "Compliance";

        const dataLabels = traitKeys.map(key => {
            const label = (labels && labels[key]) || fallbackLabels[key.toLowerCase()] || key.toUpperCase();
            return `${label} (${scores[key]}%)`;
        });
        
        const dataValues = traitKeys.map(key => Number(scores[key]));

        if (oceanChart) oceanChart.destroy();

        oceanChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: dataLabels,
                datasets: [{
                    label: 'Profile Analysis',
                    data: dataValues,
                    backgroundColor: 'rgba(255, 0, 128, 0.15)',
                    borderColor: '#FF0080',
                    pointBackgroundColor: '#7A00FF',
                    pointBorderColor: '#FFF',
                    borderWidth: 3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        min: 0, max: 100,
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        angleLines: { color: 'rgba(0, 0, 0, 0.08)' },
                        pointLabels: { 
                            color: '#1e293b', 
                            font: { family: 'Plus Jakarta Sans', size: 10, weight: '700' } 
                        },
                        ticks: { display: false, stepSize: 20 }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    analyzeBtn.addEventListener('click', () => {
        const url = profileUrl.value.trim();
        if (!url) return alert('Masukkan link!');
        runAnalysis('auto', { url });
    });

    analyzeManualBtn.addEventListener('click', () => {
        const bio = document.getElementById('manual-bio').value;
        const captions = document.getElementById('manual-captions').value;
        if (!bio || !captions) return alert('Lengkapi data!');
        runAnalysis('manual', { bio, captions });
    });

    document.getElementById('download-btn').addEventListener('click', () => window.print());
});
