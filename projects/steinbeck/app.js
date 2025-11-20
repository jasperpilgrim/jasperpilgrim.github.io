(function () {
	const markdownInput = document.getElementById('markdown-input');
	const markdownPreview = document.getElementById('markdown-preview');
	const editorContainer = document.getElementById('editor-container');
	const editorPanel = document.getElementById('editor-panel');
	const previewPanel = document.getElementById('preview-panel');
	const clearBtn = document.getElementById('clear-btn');
	const copyBtn = document.getElementById('copy-btn');
	const exportBtn = document.getElementById('export-btn');
	const printBtn = document.getElementById('print-btn');
	const shareBtn = document.getElementById('share-btn');
	const editorOnlyBtn = document.getElementById('editor-only-btn');
	const splitViewBtn = document.getElementById('split-view-btn');
	const previewOnlyBtn = document.getElementById('preview-only-btn');
	const fullscreenEditorBtn = document.getElementById('fullscreen-editor-btn');
	const fullscreenPreviewBtn = document.getElementById('fullscreen-preview-btn');
	const exportMenu = document.getElementById('export-menu');
	const toolbarBtns = document.querySelectorAll('.toolbar-btn');
	const STORAGE_KEY = 'steinbeck-markdown-content';
	const VIEW_KEY = 'steinbeck-view-mode';
	let currentView = localStorage.getItem(VIEW_KEY) || 'split';
	let isScrolling = false;

	function parseMarkdown(text) {
		if (!text.trim()) {
			return '<p class="empty-state">Start typing to see your markdown preview...</p>';
		}

		let html = text;

		html = html.replace(/```(\w+)?\s*\n([\s\S]*?)```/g, function (match, lang, code) {
			const language = lang ? lang.trim() : '';
			const codeContent = code.trim();
			return '\n<CODE_BLOCK lang="' + language + '">' + codeContent + '</CODE_BLOCK>\n';
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

		html = html.replace(/<CODE_BLOCK lang="([^"]*)">([\s\S]*?)<\/CODE_BLOCK>/g, function (match, lang, code) {
			const language = lang ? 'language-' + lang : 'language-text';
			let codeContent = escapeHtml(code);

			if (typeof Prism !== 'undefined' && lang && Prism.languages[lang]) {
				try {
					codeContent = Prism.highlight(code, Prism.languages[lang], lang);
				} catch (e) {
					codeContent = escapeHtml(code);
				}
			}

			return '<pre><code class="' + language + '">' + codeContent + '</code></pre>';
		});

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
		syncScroll();
	}

	function insertText(before, after) {
		const start = markdownInput.selectionStart;
		const end = markdownInput.selectionEnd;
		const selected = markdownInput.value.substring(start, end);
		const beforeText = markdownInput.value.substring(0, start);
		const afterText = markdownInput.value.substring(end);

		markdownInput.value = beforeText + before + selected + after + afterText;
		markdownInput.selectionStart = markdownInput.selectionEnd = start + before.length + selected.length + after.length;
		markdownInput.focus();
		updatePreview();
	}

	function handleToolbarAction(action) {
		switch (action) {
			case 'h1':
				insertText('# ', '');
				break;
			case 'h2':
				insertText('## ', '');
				break;
			case 'h3':
				insertText('### ', '');
				break;
			case 'bold':
				insertText('**', '**');
				break;
			case 'italic':
				insertText('*', '*');
				break;
			case 'code':
				insertText('`', '`');
				break;
			case 'link':
				insertText('[', '](url)');
				markdownInput.selectionStart = markdownInput.selectionEnd - 4;
				break;
			case 'list':
				insertText('- ', '');
				break;
			case 'quote':
				insertText('> ', '');
				break;
		}
	}

	function setViewMode(mode) {
		currentView = mode;
		localStorage.setItem(VIEW_KEY, mode);

		editorOnlyBtn.classList.remove('active');
		splitViewBtn.classList.remove('active');
		previewOnlyBtn.classList.remove('active');

		if (mode === 'editor') {
			editorOnlyBtn.classList.add('active');
			editorPanel.style.display = 'flex';
			previewPanel.style.display = 'none';
			editorContainer.style.gridTemplateColumns = '1fr';
		} else if (mode === 'preview') {
			previewOnlyBtn.classList.add('active');
			editorPanel.style.display = 'none';
			previewPanel.style.display = 'flex';
			editorContainer.style.gridTemplateColumns = '1fr';
		} else {
			splitViewBtn.classList.add('active');
			editorPanel.style.display = 'flex';
			previewPanel.style.display = 'flex';
			editorContainer.style.gridTemplateColumns = '1fr 1fr';
		}
	}

	function toggleFullscreen(element) {
		if (!document.fullscreenElement) {
			element.requestFullscreen().catch(err => {
				console.error('Error attempting to enable fullscreen:', err);
			});
		} else {
			document.exitFullscreen();
		}
	}

	function syncScroll() {
		if (isScrolling) return;
		isScrolling = true;

		const editorScroll = markdownInput.scrollTop;
		const editorHeight = markdownInput.scrollHeight - markdownInput.clientHeight;
		const previewHeight = markdownPreview.scrollHeight - markdownPreview.clientHeight;

		if (editorHeight > 0 && previewHeight > 0) {
			const ratio = editorScroll / editorHeight;
			markdownPreview.scrollTop = ratio * previewHeight;
		}

		setTimeout(() => { isScrolling = false; }, 100);
	}

	function exportDocument(format) {
		const markdown = markdownInput.value;
		const html = parseMarkdown(markdown);

		if (format === 'md') {
			const blob = new Blob([markdown], { type: 'text/markdown' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'document.md';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} else if (format === 'html') {
			const fullHtml = `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>Document</title>
	<style>
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.75; }
		h1, h2, h3 { margin-top: 1.5em; }
		code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; }
		pre { background: #f5f5f5; padding: 1rem; border-radius: 6px; overflow-x: auto; }
	</style>
</head>
<body>
${html}
</body>
</html>`;
			const blob = new Blob([fullHtml], { type: 'text/html' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'document.html';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} else if (format === 'pdf') {
			const printWindow = window.open('', '_blank');
			printWindow.document.write(`
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="UTF-8">
					<title>Document</title>
					<style>
						body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.75; }
						h1, h2, h3 { margin-top: 1.5em; }
						code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; }
						pre { background: #f5f5f5; padding: 1rem; border-radius: 6px; overflow-x: auto; }
						@media print { body { padding: 1rem; } }
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
	}

	function shareDocument() {
		const markdown = markdownInput.value;
		const encoded = encodeURIComponent(markdown);
		const shareUrl = window.location.origin + window.location.pathname + '?share=' + encoded;

		navigator.clipboard.writeText(shareUrl).then(() => {
			shareBtn.textContent = 'Copied!';
			setTimeout(() => {
				shareBtn.textContent = 'Share';
			}, 2000);
		}).catch(err => {
			console.error('Failed to copy:', err);
			alert('Share URL: ' + shareUrl);
		});
	}

	function loadSharedContent() {
		const params = new URLSearchParams(window.location.search);
		const shared = params.get('share');
		if (shared) {
			try {
				const decoded = decodeURIComponent(shared);
				markdownInput.value = decoded;
				updatePreview();
			} catch (err) {
				console.error('Failed to load shared content:', err);
			}
		}
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

	markdownInput.addEventListener('scroll', function () {
		if (!isScrolling) {
			isScrolling = true;
			const editorScroll = markdownInput.scrollTop;
			const editorHeight = markdownInput.scrollHeight - markdownInput.clientHeight;
			const previewHeight = markdownPreview.scrollHeight - markdownPreview.clientHeight;

			if (editorHeight > 0 && previewHeight > 0) {
				const ratio = editorScroll / editorHeight;
				markdownPreview.scrollTop = ratio * previewHeight;
			}
			setTimeout(() => { isScrolling = false; }, 100);
		}
	});

	markdownPreview.addEventListener('scroll', function () {
		if (!isScrolling) {
			isScrolling = true;
			const previewScroll = markdownPreview.scrollTop;
			const editorHeight = markdownInput.scrollHeight - markdownInput.clientHeight;
			const previewHeight = markdownPreview.scrollHeight - markdownPreview.clientHeight;

			if (editorHeight > 0 && previewHeight > 0) {
				const ratio = previewScroll / previewHeight;
				markdownInput.scrollTop = ratio * editorHeight;
			}
			setTimeout(() => { isScrolling = false; }, 100);
		}
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

	toolbarBtns.forEach(btn => {
		btn.addEventListener('click', function () {
			handleToolbarAction(this.dataset.action);
		});
	});

	editorOnlyBtn.addEventListener('click', () => setViewMode('editor'));
	splitViewBtn.addEventListener('click', () => setViewMode('split'));
	previewOnlyBtn.addEventListener('click', () => setViewMode('preview'));

	fullscreenEditorBtn.addEventListener('click', () => toggleFullscreen(editorPanel));
	fullscreenPreviewBtn.addEventListener('click', () => toggleFullscreen(previewPanel));

	exportBtn.addEventListener('click', function (e) {
		e.stopPropagation();
		exportMenu.style.display = exportMenu.style.display === 'block' ? 'none' : 'block';
	});

	document.addEventListener('click', function (e) {
		if (!exportBtn.contains(e.target) && !exportMenu.contains(e.target)) {
			exportMenu.style.display = 'none';
		}
	});

	document.querySelectorAll('.export-option').forEach(option => {
		option.addEventListener('click', function (e) {
			e.stopPropagation();
			exportDocument(this.dataset.format);
			exportMenu.style.display = 'none';
		});
	});

	clearBtn.addEventListener('click', clearEditor);
	copyBtn.addEventListener('click', copyToClipboard);
	printBtn.addEventListener('click', printPreview);
	shareBtn.addEventListener('click', shareDocument);

	setViewMode(currentView);
	loadContent();
	loadSharedContent();
})();

