(function() {
    const markdownInput = document.getElementById('markdown-input');
    const markdownPreview = document.getElementById('markdown-preview');
    const clearBtn = document.getElementById('clear-btn');
    const copyBtn = document.getElementById('copy-btn');
    const exportBtn = document.getElementById('export-btn');

    function parseMarkdown(text) {
        if (!text.trim()) {
            return '<p class="empty-state">Start typing to see your markdown preview...</p>';
        }

        let html = text;

        html = html.replace(/```([\s\S]*?)```/g, function(match, code) {
            return '\n<CODE_BLOCK>' + escapeHtml(code.trim()) + '</CODE_BLOCK>\n';
        });

        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        html = html.replace(/^### (.*$)/gim, '\n<h3>$1</h3>\n');
        html = html.replace(/^## (.*$)/gim, '\n<h2>$1</h2>\n');
        html = html.replace(/^# (.*$)/gim, '\n<h1>$1</h1>\n');

        html = html.replace(/^> (.*$)/gim, '\n<blockquote>$1</blockquote>\n');

        const lines = html.split('\n');
        let inList = false;
        let listType = '';
        let processedLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const ulMatch = line.match(/^[\-\*] (.*)$/);
            const olMatch = line.match(/^(\d+)\. (.*)$/);

            if (ulMatch) {
                if (!inList || listType !== 'ul') {
                    if (inList) processedLines.push(`</${listType}>`);
                    processedLines.push('<ul>');
                    inList = true;
                    listType = 'ul';
                }
                processedLines.push(`<li>${ulMatch[1]}</li>`);
            } else if (olMatch) {
                if (!inList || listType !== 'ol') {
                    if (inList) processedLines.push(`</${listType}>`);
                    processedLines.push('<ol>');
                    inList = true;
                    listType = 'ol';
                }
                processedLines.push(`<li>${olMatch[2]}</li>`);
            } else {
                if (inList) {
                    processedLines.push(`</${listType}>`);
                    inList = false;
                    listType = '';
                }
                processedLines.push(line);
            }
        }

        if (inList) {
            processedLines.push(`</${listType}>`);
        }

        html = processedLines.join('\n');

        html = html.replace(/^---$/gim, '\n<hr>\n');

        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

        html = html.replace(/<CODE_BLOCK>([\s\S]*?)<\/CODE_BLOCK>/g, '<pre><code>$1</code></pre>');

        html = html.split('\n').map(line => {
            line = line.trim();
            if (!line) return '';
            if (line.startsWith('<') && (line.startsWith('<h') || line.startsWith('<ul') || 
                line.startsWith('<ol') || line.startsWith('<blockquote') || line.startsWith('<pre') || 
                line.startsWith('<hr') || line.startsWith('<img'))) {
                return line;
            }
            return '<p>' + line + '</p>';
        }).join('\n');

        html = html.replace(/\n+/g, '\n').trim();

        return html;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function updatePreview() {
        const markdown = markdownInput.value;
        const html = parseMarkdown(markdown);
        markdownPreview.innerHTML = html;
    }

    function clearEditor() {
        markdownInput.value = '';
        updatePreview();
        markdownInput.focus();
    }

    async function copyToClipboard() {
        try {
            await navigator.clipboard.writeText(markdownInput.value);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    function exportMarkdown() {
        const markdown = markdownInput.value;
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    markdownInput.addEventListener('input', updatePreview);
    markdownInput.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 4;
        }
    });

    clearBtn.addEventListener('click', clearEditor);
    copyBtn.addEventListener('click', copyToClipboard);
    exportBtn.addEventListener('click', exportMarkdown);

    updatePreview();
})();

