(function() {
    const smsInput = document.getElementById('sms-input');
    const highlightOverlay = document.getElementById('highlight-overlay');
    const warningsContainer = document.getElementById('warnings-container');
    const charCountEl = document.getElementById('char-count');
    const charMaxEl = document.getElementById('char-max');
    const segmentCountEl = document.getElementById('segment-count');
    const encodingTypeEl = document.getElementById('encoding-badge');
    const warningCountEl = document.getElementById('warning-count');
    const warningsBadgeEl = document.getElementById('warnings-badge');
    const progressFillEl = document.getElementById('progress-fill');
    const tabs = document.querySelectorAll('.tab');
    const tabPanes = document.querySelectorAll('.tab-pane');

    const COMMON_ABBREVIATIONS = new Set([
        'GPS', 'USA',
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL',
        'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT',
        'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
        'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
        'USD', 'CAN', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY',
        'RN', 'LPN', 'CNA', 'EMT', 'MD', 'DO', 'NP', 'RT', 'CPR',
        'BLS', 'ACLS', 'PALS', 'ICU', 'CCU', 'NICU', 'PRN',
        'AM', 'PM', 'EST', 'CST', 'MST', 'PST', 'EDT', 'CDT', 'MDT', 'PDT',
        'LLC', 'INC', 'LTD', 'CORP',
        'CEO', 'CFO', 'CTO', 'COO', 'VP', 'HR', 'IT', 'PR', 'QA',
        'FAQ', 'URL', 'PDF', 'SMS', 'MMS', 'API', 'SQL'
    ]);

    function detectHighRiskLanguage(text) {
        const issues = [];
        const highRiskPattern = /\b(win|winner|prize|claim\s+your\s+prize|cash|loan|debt\s*relief|credit\s+repair|refinance|work\s+from\s+home|make\s+money|passive\s+income|guaranteed\s+return|double\s+your\s+money|investment\s+opportunity|apply\s+now|act\s+now|limited\s+time|limited\s+offer|last\s+chance|hurry|exclusive|urgent|reply\s+now|buy\s+now|subscribe\s+now|casino|bet|gamble|jackpot|slots|poker|sportsbook|free\s+bet|spin\s+to\s+win|kush|weed|marijuana|cannabis|thc|cbd|vape|vaping|heroin|cocaine|meth|fentanyl|xanax|percocet|oxycodone|molly|adderall|alcohol|beer|wine|liquor|tobacco|cigarettes?|e-?cig(arette)?|porn|xxx|escort|hookup|adult|nude|erotic|viagra|cialis|sildenafil|tadalafil|cure|miracle\s+cure|lose\s+weight\s+(fast|now)|burn\s+fat|guaranteed\s+cure|no\s+prescription)\b/gi;
        
        let match;
        while ((match = highRiskPattern.exec(text)) !== null) {
            issues.push({
                type: 'high-risk',
                text: match[0],
                start: match.index,
                end: match.index + match[0].length,
                description: 'High-risk language may trigger spam filters.'
            });
        }
        
        return issues;
    }

    function detectURLs(text) {
        const issues = [];
        const seenIndices = new Set();
        const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'ow.ly', 'rebrand.ly', 'cutt.ly'];
        
        const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\b[a-z0-9-]+\.(?:com|org|net|edu|gov|io|co|app|dev|ai|xyz|me|tv|info|biz)(?:\/[^\s]*)?)/gi;
        
        let match;
        while ((match = urlPattern.exec(text)) !== null) {
            const matchText = match[0];
            const start = match.index;
            const end = start + matchText.length;
            
            if (seenIndices.has(start)) continue;
            
            const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
            if (start > 0) {
                const before = text.substring(Math.max(0, start - 30), start);
                if (before.includes('@') && emailPattern.test(before + matchText)) {
                    continue;
                }
            }
            
            seenIndices.add(start);
            
            issues.push({
                type: 'url',
                text: matchText,
                start: start,
                end: end,
                description: 'Links can trigger additional carrier scrutiny. Avoid URL shortening services (bit.ly, tinyurl, etc.) as they are frequently flagged'
            });
        }
        
        return issues;
    }

    function detectSymbols(text) {
        const issues = [];
        const seenIndices = new Set();
        
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        let match;
        while ((match = emailPattern.exec(text)) !== null) {
            for (let i = match.index; i < match.index + match[0].length; i++) {
                seenIndices.add(i);
            }
            issues.push({
                type: 'symbol',
                text: match[0],
                start: match.index,
                end: match.index + match[0].length,
                description: 'Currency symbols and email addresses may reduce deliverability. Consider using "USD" or "CAN" instead of $ symbols.'
            });
        }
        
        const dollarPattern = /\$/g;
        while ((match = dollarPattern.exec(text)) !== null) {
            if (!seenIndices.has(match.index)) {
                issues.push({
                    type: 'symbol',
                    text: '$',
                    start: match.index,
                    end: match.index + 1,
                    description: 'Currency symbols and email addresses may reduce deliverability. Consider using "USD" or "CAN" instead of $ symbols.'
                });
            }
        }
        
        const atSymbolPattern = /@/g;
        while ((match = atSymbolPattern.exec(text)) !== null) {
            if (!seenIndices.has(match.index)) {
                const beforeChar = match.index > 0 ? text[match.index - 1] : '';
                const afterChar = match.index + 1 < text.length ? text[match.index + 1] : '';
                if (!(beforeChar.match(/[a-zA-Z0-9]/) && afterChar.match(/[a-zA-Z0-9]/))) {
                    issues.push({
                        type: 'symbol',
                        text: '@',
                        start: match.index,
                        end: match.index + 1,
                        description: 'Currency symbols and email addresses may reduce deliverability. Consider using "USD" or "CAN" instead of $ symbols.'
                    });
                }
            }
        }
        
        return issues;
    }

    function detectFormatting(text) {
        const issues = [];
        
        const minLen = 3;
        const regex = new RegExp(`\\b[A-Z]{${minLen},}\\b`, 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
            const word = match[0];
            if (!COMMON_ABBREVIATIONS.has(word)) {
                issues.push({
                    type: 'formatting',
                    text: word,
                    start: match.index,
                    end: match.index + word.length,
                    description: 'Excessive capitalization, multiple punctuation marks (!!, ???), or aggressive formatting may be flagged by carriers as potential spam.'
                });
            }
        }
        
        const punctuationSequences = [];
        let currentSequence = '';
        let currentStart = -1;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '!' || char === '?' || char === '.') {
                if (currentSequence === '') {
                    currentStart = i;
                }
                currentSequence += char;
            } else {
                if (currentSequence.length > 0) {
                    punctuationSequences.push({
                        start: currentStart,
                        end: i,
                        text: currentSequence,
                        length: currentSequence.length,
                        char: currentSequence[0]
                    });
                    currentSequence = '';
                    currentStart = -1;
                }
            }
        }
        
        if (currentSequence.length > 0) {
            punctuationSequences.push({
                start: currentStart,
                end: text.length,
                text: currentSequence,
                length: currentSequence.length,
                char: currentSequence[0]
            });
        }
        
        punctuationSequences.forEach(seq => {
            if (seq.length >= 2) {
                issues.push({
                    type: 'formatting',
                    text: seq.text,
                    start: seq.start,
                    end: seq.end,
                    description: 'Excessive capitalization, multiple punctuation marks (!!, ???), or aggressive formatting may be flagged by carriers as potential spam.'
                });
            } else if (seq.length === 1 && seq.char === '!') {
                const totalExclamations = punctuationSequences.filter(s => s.char === '!').length;
                if (totalExclamations > 1) {
                    issues.push({
                        type: 'formatting',
                        text: seq.text,
                        start: seq.start,
                        end: seq.end,
                        description: 'Excessive capitalization, multiple punctuation marks (!!, ???), or aggressive formatting may be flagged by carriers as potential spam.'
                    });
                }
            }
        });
        
        return issues;
    }

    function detectEncoding(text) {
        const issues = [];
        const GSM7_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
        const GSM7_EXTENDED = "^{}\\[~]|€";
        const allGSM = GSM7_BASIC + GSM7_EXTENDED;
        
        if (text.length === 0) return issues;
        
        const seen = new Set();
        const codePoints = Array.from(text);
        let position = 0;
        
        for (let i = 0; i < codePoints.length; i++) {
            const char = codePoints[i];
            const charLen = char.length;
            
            if (!allGSM.includes(char) && char.trim() !== '') {
                const code = char.codePointAt(0);
                if (code > 0x7F) {
                    if (!seen.has(position)) {
                        seen.add(position);
                        issues.push({
                            type: 'encoding',
                            text: char,
                            start: position,
                            end: position + charLen,
                            description: 'Using emojis or special characters switches your message to Unicode encoding, which cuts segment capacity from 160 to 70 characters per segment. Long multipart messages are more likely to be flagged as spam, delayed, or dropped entirely by carriers.'
                        });
                    }
                }
            }
            
            position += charLen;
        }
        
        return issues;
    }

    function detectAllIssues(text) {
        const allIssues = [
            ...detectHighRiskLanguage(text),
            ...detectURLs(text),
            ...detectSymbols(text),
            ...detectFormatting(text),
            ...detectEncoding(text)
        ];
        
        allIssues.sort((a, b) => a.start - b.start);
        
        return allIssues;
    }

    function hasUnicode(text) {
        return /[^\x00-\x7F]/.test(text);
    }

    function splitIntoSegments(text) {
        if (text.length === 0) return [];
        
        const hasUnicodeChars = hasUnicode(text);
        const segments = [];
        
        if (hasUnicodeChars) {
            const firstSegmentLimit = 70;
            const subsequentSegmentLimit = 67;
            const maxSegments = 10;
            
            let remaining = text;
            let segmentIndex = 0;
            
            while (remaining.length > 0 && segmentIndex < maxSegments) {
                const limit = segmentIndex === 0 ? firstSegmentLimit : subsequentSegmentLimit;
                const segment = remaining.substring(0, limit);
                segments.push({
                    number: segmentIndex + 1,
                    text: segment,
                    length: segment.length,
                    limit: limit
                });
                remaining = remaining.substring(limit);
                segmentIndex++;
            }
        } else {
            const firstSegmentLimit = 160;
            const subsequentSegmentLimit = 153;
            const maxSegments = 10;
            
            let remaining = text;
            let segmentIndex = 0;
            
            while (remaining.length > 0 && segmentIndex < maxSegments) {
                const limit = segmentIndex === 0 ? firstSegmentLimit : subsequentSegmentLimit;
                const segment = remaining.substring(0, limit);
                segments.push({
                    number: segmentIndex + 1,
                    text: segment,
                    length: segment.length,
                    limit: limit
                });
                remaining = remaining.substring(limit);
                segmentIndex++;
            }
        }
        
        return segments;
    }

    function calculateSegments(text) {
        const segments = splitIntoSegments(text);
        return segments.length;
    }

    function updateStats(text) {
        const charCount = text.length;
        const segmentCount = calculateSegments(text);
        const encoding = hasUnicode(text) ? 'Unicode' : 'GSM-7';
        const hasUnicodeChars = hasUnicode(text);
        
        let maxChars, maxTotalChars;
        if (hasUnicodeChars) {
            maxChars = 70;
            maxTotalChars = 737;
        } else {
            maxChars = 160;
            maxTotalChars = 1600;
        }
        
        const progress = Math.min((charCount / maxTotalChars) * 100, 100);
        
        charCountEl.textContent = charCount;
        charMaxEl.textContent = `/${maxChars}`;
        segmentCountEl.textContent = segmentCount;
        encodingTypeEl.textContent = encoding;
        progressFillEl.style.width = `${progress}%`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function mergeRanges(ranges) {
        if (ranges.length === 0) return [];
        
        const sorted = [...ranges].sort((a, b) => a.start - b.start);
        const merged = [sorted[0]];
        
        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            const last = merged[merged.length - 1];
            
            if (current.start <= last.end) {
                last.end = Math.max(last.end, current.end);
                if (!last.types) last.types = new Set([last.type]);
                last.types.add(current.type);
            } else {
                merged.push(current);
            }
        }
        
        return merged;
    }

    function renderHighlights(text, issues) {
        if (!highlightOverlay) {
            console.warn('Highlight overlay not found');
            return;
        }
        
        if (text.length === 0 || issues.length === 0) {
            highlightOverlay.textContent = '';
            return;
        }
        
        const ranges = issues.map(issue => ({
            start: issue.start,
            end: issue.end,
            type: issue.type
        }));
        
        const merged = mergeRanges(ranges);
        
        let html = '';
        let lastIndex = 0;
        
        merged.forEach(range => {
            if (range.start > lastIndex) {
                html += escapeHtml(text.substring(lastIndex, range.start));
            }
            
            const rangeText = text.substring(range.start, range.end);
            const types = range.types ? Array.from(range.types) : [range.type];
            const primaryType = types[0];
            
            html += `<span class="highlight ${primaryType}">${escapeHtml(rangeText)}</span>`;
            lastIndex = range.end;
        });
        
        if (lastIndex < text.length) {
            html += escapeHtml(text.substring(lastIndex));
        }
        
        highlightOverlay.innerHTML = html;
    }

    function syncScroll() {
        if (highlightOverlay && smsInput) {
            highlightOverlay.scrollTop = smsInput.scrollTop;
            highlightOverlay.scrollLeft = smsInput.scrollLeft;
        }
    }

    function groupIssuesByType(issues) {
        const grouped = {};
        issues.forEach(issue => {
            if (!grouped[issue.type]) {
                grouped[issue.type] = [];
            }
            grouped[issue.type].push(issue);
        });
        return grouped;
    }

    function getWarningTitle(type) {
        const titles = {
            'high-risk': 'High-risk language',
            'url': 'URLs',
            'symbol': 'Symbols',
            'formatting': 'Formatting',
            'encoding': 'Encoding'
        };
        return titles[type] || 'Issue';
    }

    function getWarningIcon(type) {
        return '⚠️';
    }

    function renderWarnings(issues) {
        if (issues.length === 0) {
            warningsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">✓</div>
                    <div class="empty-title">No issues detected</div>
                    <div class="empty-message">Your message looks clean!</div>
                </div>
            `;
            return;
        }
        
        const grouped = groupIssuesByType(issues);
        let html = '';
        
        Object.entries(grouped).forEach(([type, typeIssues]) => {
            let uniqueExamples = [...new Set(typeIssues.map(i => i.text))];
            
            if (type === 'formatting') {
                uniqueExamples.sort((a, b) => {
                    const aIsPunct = /^[!?.]+$/.test(a);
                    const bIsPunct = /^[!?.]+$/.test(b);
                    if (aIsPunct && !bIsPunct) return -1;
                    if (!aIsPunct && bIsPunct) return 1;
                    const aHasMixed = a.includes('!') && a.includes('?');
                    const bHasMixed = b.includes('!') && b.includes('?');
                    if (aHasMixed && !bHasMixed) return -1;
                    if (!aHasMixed && bHasMixed) return 1;
                    return b.length - a.length;
                });
            }
            
            uniqueExamples = uniqueExamples.slice(0, 5);
            const description = typeIssues[0].description;
            
            html += `
                <div class="warning-card">
                    <div class="warning-header">
                        <span class="warning-icon">${getWarningIcon(type)}</span>
                        <span class="warning-title">${getWarningTitle(type)}</span>
                    </div>
                    <div class="warning-description">${description}</div>
                    <div class="warning-examples">
                        ${uniqueExamples.map(ex => {
                            const isPunct = type === 'formatting' && /^[!?.]+$/.test(ex);
                            return `<span class="warning-example ${isPunct ? 'punctuation-example' : ''}">${escapeHtml(ex)}</span>`;
                        }).join('')}
                    </div>
                </div>
            `;
        });
        
        warningsContainer.innerHTML = html;
    }

    function renderSegments(text) {
        const segmentsContainer = document.getElementById('segments-tab');
        const segments = splitIntoSegments(text);
        
        if (segments.length === 0) {
            segmentsContainer.innerHTML = '<div class="tab-placeholder">No message to segment</div>';
            return;
        }
        
        let html = '<div class="segments-list">';
        segments.forEach(segment => {
            html += `
                <div class="segment-item">
                    <div class="segment-header">
                        <span class="segment-number">Segment ${segment.number}</span>
                        <span class="segment-length">${segment.length}/${segment.limit}</span>
                    </div>
                    <div class="segment-text">${escapeHtml(segment.text)}</div>
                </div>
            `;
        });
        html += '</div>';
        
        segmentsContainer.innerHTML = html;
    }

    function renderPreview(text) {
        const previewMessageEl = document.getElementById('preview-message');
        if (!previewMessageEl) return;
        
        if (text.length === 0) {
            previewMessageEl.textContent = 'Your message will appear here';
            previewMessageEl.style.opacity = '0.5';
        } else {
            previewMessageEl.textContent = text;
            previewMessageEl.style.opacity = '1';
        }
    }

    function auditText(text) {
        const issues = detectAllIssues(text);
        updateStats(text);
        renderWarnings(issues);
        renderSegments(text);
        renderPreview(text);
        renderHighlights(text, issues);
        syncScroll();
        
        const uniqueCategories = new Set(issues.map(issue => issue.type));
        const warningCount = uniqueCategories.size;
        
        warningCountEl.textContent = warningCount;
        warningsBadgeEl.textContent = warningCount;
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            tabs.forEach(t => t.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });

    document.getElementById('paste-btn').addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            smsInput.value = text;
            auditText(text);
        } catch (err) {
            console.error('Failed to paste:', err);
        }
    });

    document.getElementById('copy-btn').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(smsInput.value);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
        smsInput.value = '';
        auditText('');
    });

    smsInput.addEventListener('input', (e) => {
        const text = e.target.value;
        auditText(text);
    });

    smsInput.addEventListener('paste', (e) => {
        setTimeout(() => {
            const text = e.target.value;
            auditText(text);
        }, 0);
    });

    smsInput.addEventListener('scroll', syncScroll);

    const textareaWrapper = smsInput.closest('.textarea-wrapper');
    if (textareaWrapper) {
        smsInput.addEventListener('focus', () => {
            textareaWrapper.style.borderColor = 'var(--accent)';
            textareaWrapper.style.boxShadow = '0 0 0 2px rgba(189, 147, 249, 0.15)';
            textareaWrapper.style.backgroundColor = 'var(--bg-secondary)';
        });
        
        smsInput.addEventListener('blur', () => {
            textareaWrapper.style.borderColor = 'var(--border)';
            textareaWrapper.style.boxShadow = 'none';
            textareaWrapper.style.backgroundColor = 'var(--card-bg)';
        });
    }

    auditText('');
})();
