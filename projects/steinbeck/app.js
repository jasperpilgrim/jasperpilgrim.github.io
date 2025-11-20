(function () {
	const markdownInput = document.getElementById('markdown-input');
	const markdownPreview = document.getElementById('markdown-preview');
	const clearBtn = document.getElementById('clear-btn');
	const copyBtn = document.getElementById('copy-btn');
	const exportBtn = document.getElementById('export-btn');
	const printBtn = document.getElementById('print-btn');
	const STORAGE_KEY = 'steinbeck-markdown-content';

	function parseMarkdown(text) {
		if (!text.trim()) {
			return '<p class="empty-state">Start typing to see your markdown preview...</p>';
		}

		let html = text;

		html = html.replace(/```([\s\S]*?)```/g, function (match, code) {
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

	function saveContent() {
		try {
			localStorage.setItem(STORAGE_KEY, markdownInput.value);
		} catch (err) {
			console.error('Failed to save content:', err);
		}
	}

	function loadContent() {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved !== null) {
				markdownInput.value = saved;
				updatePreview();
			}
		} catch (err) {
			console.error('Failed to load content:', err);
		}
	}

	function updatePreview() {
		const markdown = markdownInput.value;
		const html = parseMarkdown(markdown);
		markdownPreview.innerHTML = html;
	}

	function clearEditor() {
		markdownInput.value = '';
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch (err) {
			console.error('Failed to clear saved content:', err);
		}
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

	function printPreview() {
		const printWindow = window.open('', '_blank');
		const html = markdownPreview.innerHTML;

		printWindow.document.write(`
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>Print - Steinbeck</title>
				<style>
					* {
						margin: 0;
						padding: 0;
						box-sizing: border-box;
					}
					body {
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', sans-serif;
						line-height: 1.75;
						color: #1a1a1a;
						padding: 2rem;
						max-width: 800px;
						margin: 0 auto;
					}
					h1, h2, h3, h4, h5, h6 {
						margin-top: 1.5em;
						margin-bottom: 0.75em;
						font-weight: 600;
						line-height: 1.3;
					}
					h1 {
						font-size: 2em;
						border-bottom: 2px solid #e0e0e0;
						padding-bottom: 0.5em;
					}
					h2 {
						font-size: 1.5em;
						border-bottom: 1px solid #e0e0e0;
						padding-bottom: 0.5em;
					}
					h3 {
						font-size: 1.25em;
					}
					p {
						margin-bottom: 1em;
					}
					ul, ol {
						margin-bottom: 1em;
						padding-left: 2em;
					}
					li {
						margin-bottom: 0.5em;
					}
					code {
						background-color: #f5f5f5;
						border: 1px solid #e0e0e0;
						border-radius: 3px;
						padding: 0.125rem 0.375rem;
						font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
						font-size: 0.875em;
					}
					pre {
						background-color: #f5f5f5;
						border: 1px solid #e0e0e0;
						border-radius: 6px;
						padding: 1rem;
						overflow-x: auto;
						margin-bottom: 1em;
					}
					pre code {
						background: none;
						border: none;
						padding: 0;
					}
					blockquote {
						border-left: 4px solid #bd93f9;
						padding-left: 1em;
						margin-left: 0;
						margin-bottom: 1em;
						color: #666;
						font-style: italic;
					}
					a {
						color: #bd93f9;
						text-decoration: underline;
					}
					img {
						max-width: 100%;
						height: auto;
						border-radius: 6px;
						margin-bottom: 1em;
					}
					table {
						width: 100%;
						border-collapse: collapse;
						margin-bottom: 1em;
					}
					table th, table td {
						border: 1px solid #e0e0e0;
						padding: 0.5rem;
						text-align: left;
					}
					table th {
						background-color: #f5f5f5;
						font-weight: 600;
					}
					hr {
						border: none;
						border-top: 2px solid #e0e0e0;
						margin: 2em 0;
					}
					@media print {
						body {
							padding: 1rem;
						}
					}
				</style>
			</head>
			<body>
				${html}
			</body>
			</html>
		`);

		printWindow.document.close();

		setTimeout(() => {
			printWindow.print();
		}, 250);
	}

	let saveTimeout;
	markdownInput.addEventListener('input', function () {
		updatePreview();
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(saveContent, 300);
	});

	markdownInput.addEventListener('keydown', function (e) {
		if (e.key === 'Tab') {
			e.preventDefault();
			const start = this.selectionStart;
			const end = this.selectionEnd;
			this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
			this.selectionStart = this.selectionEnd = start + 4;
			saveContent();
		}
	});

	clearBtn.addEventListener('click', clearEditor);
	copyBtn.addEventListener('click', copyToClipboard);
	exportBtn.addEventListener('click', exportMarkdown);
	printBtn.addEventListener('click', printPreview);

	loadContent();
})();

