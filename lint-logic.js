/**
 * SMS Linter - Modular, Data-Driven Architecture
 * Cherry Blossom Labs
 * 
 * Architecture:
 * - charset: GSM-7 tables, Unicode helpers
 * - segmenter: septet/codeunit counting, segment math
 * - rules: data-driven rule definitions by category
 * - scanner: tokenization + regex matching
 * - resolver: overlap resolution, context escalation
 * - highlighter: preview HTML generation
 * - ui: event handlers, DOM updates
 */

(function () {
	'use strict';

	// ========== CONFIGURATION ==========
	const config = {
		whitelistWords: ['kush consulting', 'acme kush llc'], // Exact match, case-insensitive
		whitelistDomains: ['example.com'], // Add branded domains here
		caseSensitiveWhitelist: false,
		maxUppercaseRatio: 0.15,
		allCapsMinLen: 3, // Minimum 3 characters for all-caps detection (catches AND, NOT, etc.)
		debounceMs: 50,
		// ONLY actual abbreviations/acronyms that are ALWAYS written in caps
		commonAbbreviations: new Set([
			// Geographic codes
			'GPS', 'USA',
			// State abbreviations (2-letter codes only)
			'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL',
			'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT',
			'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
			'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
			// Currency codes
			'USD', 'CAN', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY',
			// Healthcare certifications/titles
			'RN', 'LPN', 'CNA', 'EMT', 'MD', 'DO', 'NP', 'RT', 'CPR',
			'BLS', 'ACLS', 'PALS', 'ICU', 'CCU', 'NICU', 'PRN',
			// Time abbreviations
			'AM', 'PM', 'EST', 'CST', 'MST', 'PST', 'EDT', 'CDT', 'MDT', 'PDT',
			// Business entity types
			'LLC', 'INC', 'LTD', 'CORP',
			// Technical/business acronyms
			'CEO', 'CFO', 'CTO', 'COO', 'VP', 'HR', 'IT', 'PR', 'QA',
			'ASAP', 'ETA', 'FYI', 'FAQ', 'URL', 'PDF', 'SMS', 'MMS', 'API', 'SQL',
			// Common business terms
			'TEAM', 'STAFF', 'FULL', 'STEAM'
		])
	};

	// ========== MODULE: CHARSET ==========
	const charset = {
		GSM7_BASIC: "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
		GSM7_EXTENDED: "^{}\\[~]|€",

		normalize(text) {
			// Normalize to NFC (composed form)
			return text.normalize('NFC');
		},

		isGSM7(text) {
			const allChars = this.GSM7_BASIC + this.GSM7_EXTENDED;
			for (let i = 0; i < text.length; i++) {
				if (!allChars.includes(text[i])) {
					return false;
				}
			}
			return true;
		},

		isExtendedChar(char) {
			return this.GSM7_EXTENDED.includes(char);
		}
	};

	// ========== MODULE: SEGMENTER ==========
	const segmenter = {
		countGSM7Septets(text) {
			let septets = 0;
			for (let i = 0; i < text.length; i++) {
				const char = text[i];
				if (charset.isExtendedChar(char)) {
					septets += 2; // Extended chars consume 2 septets
				} else {
					septets += 1;
				}
			}
			return septets;
		},

		countUnicodeCUs(text) {
			// Count UTF-16 code units (surrogate pairs = 2 units)
			let codeUnits = 0;
			for (let i = 0; i < text.length; i++) {
				const code = text.charCodeAt(i);
				if (code >= 0xD800 && code <= 0xDBFF) {
					// High surrogate
					codeUnits += 2;
					i++; // Skip low surrogate
				} else {
					codeUnits += 1;
				}
			}
			return codeUnits;
		},

		analyze(text) {
			if (!text || text.length === 0) {
				return {
					encoding: 'GSM-7',
					characters: 0,
					segments: 0,
					isGSM7: true,
					units: 0
				};
			}

			const normalized = charset.normalize(text);
			const isGSM = charset.isGSM7(normalized);
			const characters = text.length;

			if (isGSM) {
				const septets = this.countGSM7Septets(normalized);
				let segments;
				if (septets <= 160) {
					segments = 1;
				} else {
					segments = Math.ceil(septets / 153);
				}
				return {
					encoding: 'GSM-7',
					characters,
					segments,
					isGSM7: true,
					units: septets
				};
			} else {
				const codeUnits = this.countUnicodeCUs(normalized);
				let segments;
				if (codeUnits <= 70) {
					segments = 1;
				} else {
					segments = Math.ceil(codeUnits / 67);
				}
				return {
					encoding: 'Unicode',
					characters,
					segments,
					isGSM7: false,
					units: codeUnits
				};
			}
		}
	};

	// ========== MODULE: RULES ==========
	const rules = {
		// Category 1: High-risk language (consolidated - includes financial, gambling, drugs, alcohol, adult, health)
		financial: {
			id: 'financial',
			category: 'High-risk language',
			severity: 'warn',
			pattern: /\b(win|winner|prize|claim\s+your\s+prize|cash|loan|debt\s*relief|credit\s+repair|refinance|work\s+from\s+home|make\s+money|passive\s+income|guaranteed\s+return|double\s+your\s+money|investment\s+opportunity|apply\s+now|act\s+now|limited\s+time|limited\s+offer|last\s+chance|hurry|exclusive|urgent|reply\s+now|buy\s+now|subscribe\s+now|casino|bet|gamble|jackpot|slots|poker|sportsbook|free\s+bet|spin\s+to\s+win|kush|weed|marijuana|cannabis|thc|cbd|vape|vaping|heroin|cocaine|meth|fentanyl|xanax|percocet|oxycodone|molly|adderall|alcohol|beer|wine|liquor|tobacco|cigarettes?|e-?cig(arette)?|porn|xxx|escort|hookup|adult|nude|erotic|viagra|cialis|sildenafil|tadalafil|cure|miracle\s+cure|lose\s+weight\s+(fast|now)|burn\s+fat|guaranteed\s+cure|no\s+prescription)\b/gi,
			label: 'High-risk language',
			hint: 'High-risk language may trigger spam filters.'
		},


		// Category 8a: All URLs (RISK for shorteners, WARN for others)
		urls: {
			id: 'urls',
			category: 'URLs',
			severity: 'warn',
			pattern: /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(?<!@)(\b[a-z0-9-]+\.(?:com|org|net|edu|gov|io|co|app|dev|ai|xyz|me|tv|info|biz)(?:\/[^\s]*)?)/gi,
			label: 'URLs / Website Links',
			hint: 'Links can trigger additional carrier scrutiny. Avoid URL shortening services (bit.ly, tinyurl, etc.) as they are frequently flagged.',
			context: (match, text, config) => {
				// Skip if this is part of an email address
				const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
				const matchIndex = text.indexOf(match);
				if (matchIndex > 0) {
					const before = text.substring(Math.max(0, matchIndex - 30), matchIndex);
					if (before.includes('@') && emailPattern.test(before + match)) {
						return null; // Skip this match
					}
				}

				// Check if it's a known shortener
				const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'ow.ly', 'rebrand.ly', 'cutt.ly'];
				const lowerMatch = match.toLowerCase();

				for (const shortener of shorteners) {
					if (lowerMatch.includes(shortener)) {
						// Check if domain is whitelisted
						const domain = match.match(/([a-z0-9-]+\.[a-z]{2,})/i);
						if (domain && config.whitelistDomains.includes(domain[1])) {
							return 'warn';
						}
						return 'risk';
					}
				}

				return 'warn';
			}
		},

		// Category 9a: Dollar sign
		dollarSign: {
			id: 'dollar_sign',
			category: 'Symbols',
			severity: 'warn',
			pattern: /\$/g,
			label: 'Currency symbols',
			hint: 'Consider using "USD" or "CAN" instead.'
		},

		// Category 9b: Email / @ symbol
		email: {
			id: 'email',
			category: 'Symbols',
			severity: 'warn',
			pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|@/g,
			label: 'Email addresses / @ symbols',
			hint: 'Email addresses and @ symbols may reduce deliverability.'
		},

		// Category 9c: All-caps words
		allCaps: {
			id: 'all_caps',
			category: 'Formatting',
			severity: 'warn',
			pattern: null, // Custom function
			matcher: (text, config) => {
				const matches = [];
				const minLen = config.allCapsMinLen || 3;
				const regex = new RegExp(`\\b[A-Z]{${minLen},}\\b`, 'g');
				let match;
				while ((match = regex.exec(text)) !== null) {
					const word = match[0];
					// Skip if it's a common abbreviation
					if (!config.commonAbbreviations.has(word)) {
						matches.push({
							start: match.index,
							end: match.index + match[0].length,
							text: match[0]
						});
					}
				}
				return matches;
			},
			label: 'Uppercase words',
			hint: 'Excessive capitalization may appear aggressive or be flagged by carriers.'
		},


		// Category 9e: Excessive punctuation - precise rules
		excessivePunctuation: {
			id: 'excessive_punctuation',
			category: 'Formatting',
			severity: 'warn',
			pattern: null,
			matcher: (text) => {
				const matches = [];

				// Find all punctuation sequences
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
								char: currentSequence[0] // First character to identify type
							});
							currentSequence = '';
							currentStart = -1;
						}
					}
				}

				// Handle sequence at end of text
				if (currentSequence.length > 0) {
					punctuationSequences.push({
						start: currentStart,
						end: text.length,
						text: currentSequence,
						length: currentSequence.length,
						char: currentSequence[0]
					});
				}

				// Apply specific rules
				punctuationSequences.forEach(seq => {
					if (seq.length >= 2) {
						// Always flag consecutive punctuation (!!, ??, !?, ?!, ...)
						matches.push({
							start: seq.start,
							end: seq.end,
							text: seq.text,
							type: 'consecutive'
						});
					} else if (seq.length === 1 && seq.char === '!') {
						// For single ! - only flag if there are multiple ! anywhere in message
						const totalExclamations = punctuationSequences.filter(s => s.char === '!').length;
						if (totalExclamations > 1) {
							matches.push({
								start: seq.start,
								end: seq.end,
								text: seq.text,
								type: 'multiple_exclamations',
								totalCount: totalExclamations
							});
						}
					}
					// Single ? and . are always OK (no action needed)
				});

				return matches;
			},
			label: 'Excessive punctuation',
			hint: 'Excessive punctuation may appear unprofessional and be flagged by carriers.'
		},


		// Category 9g: Non-GSM characters
		nonGSM: {
			id: 'non_gsm',
			category: 'Encoding',
			severity: 'warn',
			pattern: null,
			matcher: (text) => {
				if (charset.isGSM7(text)) return [];

				const matches = [];
				const allGSM = charset.GSM7_BASIC + charset.GSM7_EXTENDED;
				const seen = new Set(); // Track positions to avoid counting multi-codepoint emojis twice

				// Use Array.from to properly handle surrogate pairs and multi-codepoint emojis
				const codePoints = Array.from(text);
				let position = 0;

				for (let i = 0; i < codePoints.length; i++) {
					const char = codePoints[i];
					const charLen = char.length; // Could be 1 or 2 (surrogate pair)

					if (!allGSM.includes(char) && char.trim() !== '') {
						const code = char.codePointAt(0);
						if (code > 0x7F) { // Non-ASCII
							// Check if we haven't already processed this position
							if (!seen.has(position)) {
								seen.add(position);
								const isEmoji = code > 0x1F000;
								matches.push({
									start: position,
									end: position + charLen,
									text: char,
									charDesc: isEmoji ? 'emoji/special character' : `character (U+${code.toString(16).toUpperCase()})`
								});
							}
						}
					}

					position += charLen;
				}

				return matches;
			},
			label: 'Emojis or special characters',
			hint: 'Using emojis or special characters switches your message to Unicode encoding, which cuts segment capacity from 160 to 70 characters per segment. Long multipart messages are more likely to be flagged as spam, delayed, or dropped entirely by carriers.'
		}
	};

	// ========== MODULE: SCANNER ==========
	const scanner = {
		scan(text, config) {
			if (!text) return [];

			const normalized = charset.normalize(text);
			const issues = [];

			// Process each rule
			for (const [key, rule] of Object.entries(rules)) {
				if (rule.matcher) {
					// Custom matcher function
					const matches = rule.matcher(normalized, config);
					matches.forEach(match => {
						let hint = rule.hint;
						// Replace placeholders
						if (match.count !== undefined) {
							hint = hint.replace('{count}', match.count);
						}
						if (match.ratio !== undefined) {
							hint = hint.replace('{percent}', Math.round(match.ratio * 100));
						}
						if (match.charDesc !== undefined) {
							hint = hint.replace('{charDesc}', match.charDesc);
						}
						if (match.text && !match.charDesc) {
							hint = hint.replace('{char}', match.text);
						}

						issues.push({
							id: rule.id,
							category: rule.category,
							label: rule.label,
							severity: rule.severity,
							start: match.start,
							end: match.end,
							text: match.text || '',
							hint: hint,
							needsEscalation: rule.needsEscalation || false
						});
					});
				} else if (rule.pattern) {
					// Regex pattern
					rule.pattern.lastIndex = 0; // Reset regex
					let match;
					while ((match = rule.pattern.exec(normalized)) !== null) {
						let severity = rule.severity;

						// Apply context function if defined
						if (rule.context) {
							severity = rule.context(match[0], normalized, config);
						}

						issues.push({
							id: rule.id,
							category: rule.category,
							label: rule.label,
							severity: severity,
							start: match.index,
							end: match.index + match[0].length,
							text: match[0],
							hint: rule.hint,
							needsEscalation: rule.needsEscalation || false
						});
					}
				}
			}

			return this.aggregateIssues(issues);
		},

		aggregateIssues(issues) {
			// Group issues by ID to combine similar ones - ONE WARNING PER CATEGORY
			const grouped = {};
			const aggregated = [];
			const shouldAggregate = new Set([
				// Content/keyword categories
				'financial',
				// Formatting categories
				'all_caps',
				'excessive_punctuation', // Unified punctuation category
				// Technical categories
				'urls',
				'dollar_sign',
				'email',
				'non_gsm'
			]);

			// Special handling: aggregate all_caps words only
			const capsIssues = issues.filter(i => i.id === 'all_caps');
			const punctIssues = issues.filter(i => i.id === 'excessive_punctuation');
			const otherIssues = issues.filter(i =>
				i.id !== 'all_caps' &&
				i.id !== 'excessive_punctuation'
			);

			// Merge capitalization issues
			if (capsIssues.length > 0) {
				const allCapsWords = capsIssues.filter(i => i.id === 'all_caps');

				allCapsWords.forEach(issue => {
					otherIssues.push(issue);
				});
			}

			// Merge punctuation issues into one 'excessive_punctuation' category
			if (punctIssues.length > 0) {
				// All punctuation issues are already unified under 'excessive_punctuation'
				punctIssues.forEach(issue => {
					otherIssues.push(issue);
				});
			}

			const processedIssues = otherIssues;

			processedIssues.forEach(issue => {
				if (shouldAggregate.has(issue.id)) {
					if (!grouped[issue.id]) {
						grouped[issue.id] = [];
					}
					grouped[issue.id].push(issue);
				} else {
					// Don't aggregate these, add as-is
					aggregated.push(issue);
				}
			});

			// Create aggregated issues
			for (const [id, group] of Object.entries(grouped)) {
				if (group.length === 1 && id !== 'excessive_punctuation') {
					// Only one, add as-is with highlight marker (except for punctuation which always gets unified)
					aggregated.push({
						...group[0],
						isHighlightOnly: false,
						examples: group[0].text ? [group[0].text] : []
					});
				} else {
					// Multiple - create a summary issue and keep individual highlights
					const first = group[0];
					const count = group.length;

					// Special handling for different types
					let summaryLabel = first.label;
					let summaryHint = first.hint;
					let summaryExamples = [];

					if (id === 'excessive_punctuation') {
						// Unified punctuation warning - collect all examples
						const punctuationExamples = [];
						group.forEach(issue => {
							if (issue.text) {
								punctuationExamples.push(issue.text);
							}
						});

						summaryLabel = 'Excessive punctuation';
						summaryHint = 'Excessive punctuation may appear unprofessional and be flagged by carriers.';
						// Store all actual instances to match highlighting
						summaryExamples = punctuationExamples;
					} else if (id === 'all_caps') {
						// List words found (limit to 10 for readability when there are many)
						const words = group.map(g => g.text).filter(t => t);
						const displayWords = words.slice(0, 10);
						const moreCount = words.length > 10 ? ` (+${words.length - 10} more)` : '';

						summaryLabel = `Uppercase words (${count} found)`;
						summaryHint = `Found ${count} uppercase word${count > 1 ? 's' : ''}: ${displayWords.join(', ')}${moreCount}. Excessive capitalization may appear aggressive or be flagged by carriers.`;
						// Store examples for easy extraction
						summaryExamples = words;
					} else if (id === 'urls') {
						const urls = group.map(g => g.text).filter(t => t);
						summaryLabel = `URLs / Website Links (${count} found)`;
						summaryHint = `Found ${count} URL${count > 1 ? 's' : ''}: ${urls.join(', ')}. Links can trigger additional carrier scrutiny. Avoid URL shortening services (bit.ly, tinyurl, etc.) as they are frequently flagged.`;
						// Store examples for easy extraction
						summaryExamples = urls;
					} else if (id === 'email') {
						const allMatches = group.map(g => g.text).filter(t => t);
						const emails = allMatches.filter(t => t.length > 1);
						const atSymbols = allMatches.filter(t => t === '@');

						const examples = [...emails, ...atSymbols];

						summaryLabel = `Email addresses / @ symbols (${count} found)`;
						summaryHint = `Found ${count} ${count > 1 ? 'instances' : 'instance'}: ${examples.join(', ')}. Email addresses and @ symbols may reduce deliverability.`;
						// Store examples for easy extraction
						summaryExamples = examples;
					} else if (id === 'unicode_emoji') {
						const emojis = group.map(g => g.text).filter(t => t);
						summaryLabel = `Emojis or special characters (${count} found)`;
						summaryHint = `Using emojis or special characters switches your message to Unicode encoding, which cuts segment capacity from 160 to 70 characters per segment. Long multipart messages are more likely to be flagged as spam, delayed, or dropped entirely by carriers.`;
						// Store examples for easy extraction
						summaryExamples = emojis;
					} else if (id === 'dollar_sign') {
						// Keep individual $ symbols as separate instances
						const allSymbols = group.map(g => g.text).filter(t => t);
						summaryLabel = `Currency symbols (${count} found)`;
						summaryHint = `Consider using "USD" or "CAN" instead.`;
						// Store examples for easy extraction - keep individual symbols
						summaryExamples = allSymbols;
					} else if (id === 'financial') {
						// High-risk language - limit examples for readability
						const terms = group.map(g => g.text).filter(t => t);
						const displayTerms = terms.slice(0, 5);
						const moreCount = terms.length > 5 ? ` (+${terms.length - 5} more)` : '';
						summaryLabel = `${first.label} (${count} found)`;
						const baseHint = first.hint.replace(/\.$/, '');
						summaryHint = `Found ${count} instance${count > 1 ? 's' : ''}: "${displayTerms.join('", "')}"${moreCount}${displayTerms.length > 0 ? '. ' : ''}${baseHint}.`;
						// Store examples for easy extraction
						summaryExamples = terms;
					} else {
						// For any other categories, collect all examples
						const allExamples = group.map(g => g.text).filter(t => t);
						summaryLabel = first.label + ` (${count} found)`;
						summaryHint = first.hint;
						// Store examples for easy extraction
						summaryExamples = allExamples;
					}

					// Add a summary issue (no position)
					aggregated.push({
						id: first.id,
						category: first.category,
						label: summaryLabel,
						severity: first.severity,
						start: 0,
						end: 0,
						text: '',
						hint: summaryHint,
						needsEscalation: first.needsEscalation,
						isSummary: true,
						examples: summaryExamples || []
					});

					// Add individual positioned issues for highlighting
					group.forEach(issue => {
						aggregated.push({
							...issue,
							isHighlightOnly: true // Mark for highlighting but don't show in issues list
						});
					});
				}
			}

			return aggregated;
		}
	};

	// ========== MODULE: RESOLVER ==========
	const resolver = {
		evaluateContext(issues, text, config) {
			// Count issues by category and severity
			const categoryCounts = {};
			const promoTerms = ['free', 'discount', 'click', 'limited'];
			const hasPromoTerms = promoTerms.some(term =>
				text.toLowerCase().includes(term)
			);

			issues.forEach(issue => {
				categoryCounts[issue.category] = (categoryCounts[issue.category] || 0) + 1;
			});

			const distinctCategories = Object.keys(categoryCounts).length;

			// No escalation rules - all warnings are treated equally

			return issues;
		},

		resolveOverlaps(issues) {
			if (issues.length === 0) return [];

			// Separate positioned and non-positioned issues (summaries)
			const positioned = issues.filter(i => i.start !== i.end || i.text);
			const nonPositioned = issues.filter(i => i.start === i.end && !i.text);

			// Sort positioned issues by: span length (longer first), then start position
			const sorted = [...positioned].sort((a, b) => {

				// Compare span length
				const aLen = a.end - a.start;
				const bLen = b.end - b.start;
				if (bLen !== aLen) return bLen - aLen;

				// Compare start position
				return a.start - b.start;
			});

			// Sweep-line merge: keep highest-ranked, drop overlapping
			const resolved = [];
			const occupied = new Set();

			for (const issue of sorted) {
				// Check if any index in this span is already occupied
				let hasOverlap = false;
				for (let i = issue.start; i < issue.end; i++) {
					if (occupied.has(i)) {
						hasOverlap = true;
						break;
					}
				}

				if (!hasOverlap) {
					resolved.push(issue);
					// Mark indices as occupied
					for (let i = issue.start; i < issue.end; i++) {
						occupied.add(i);
					}
				}
			}

			// Sort resolved by start position for rendering
			resolved.sort((a, b) => a.start - b.start);

			// Add back non-positioned issues (summaries)
			return [...nonPositioned, ...resolved];
		}
	};

	// ========== MODULE: HIGHLIGHTER ==========
	const highlighter = {
		buildDOM(text, issues) {
			// Build and return DOM element with proper emoji support
			const container = document.createElement('div');

			if (!text) {
				const placeholder = document.createElement('span');
				placeholder.className = 'preview-placeholder';
				placeholder.textContent = 'Your message will appear here with highlighted issues...';
				container.appendChild(placeholder);
				return container;
			}

			// Filter out issues with no position (overall stats)
			// Also skip non-GSM character highlighting (too many emojis would clutter the preview)
			const positionedIssues = issues.filter(issue =>
				(issue.start !== issue.end || issue.text) && issue.id !== 'non_gsm'
			);

			if (positionedIssues.length === 0) {
				// No issues - just add the text safely
				container.textContent = text;
				return container;
			}

			// Build preview with highlighted spans
			let lastIndex = 0;

			for (const issue of positionedIssues) {
				// Add text before the issue
				if (issue.start > lastIndex) {
					const beforeText = text.substring(lastIndex, issue.start);
					container.appendChild(document.createTextNode(beforeText));
				}

				// Add flagged span
				const span = document.createElement('span');
				span.className = 'flag flag--warn';
				span.title = issue.hint;
				const flaggedText = text.substring(issue.start, issue.end);
				span.textContent = flaggedText;
				container.appendChild(span);

				lastIndex = issue.end;
			}

			// Add remaining text
			if (lastIndex < text.length) {
				const remainingText = text.substring(lastIndex);
				container.appendChild(document.createTextNode(remainingText));
			}

			return container;
		},

		escapeHtml(str) {
			// Helper for other parts of the code that need HTML escaping
			const div = document.createElement('div');
			div.textContent = str;
			return div.innerHTML;
		}
	};

	// ========== MODULE: UI ==========
	const ui = {
		// DOM references (will be initialized in init())
		messageInput: null,
		highlightOverlay: null,
		encodingDisplay: null,
		charCount: null,
		charLimit: null,
		charProgress: null,
		segmentCount: null,
		segmentTrend: null,
		issueCount: null,
		srAnnouncements: null,
		pasteBtn: null,
		copyBtn: null,
		clearBtn: null,
		historyBtn: null,
		exportBtn: null,
		toast: null,
		historyModal: null,
		tabWarnings: null,
		tabSegments: null,
		tabPreview: null,
		tabSuggestions: null,
		tabHistory: null,
		tabCompliance: null,

		debounceTimer: null,
		previousValues: {
			encoding: '',
			characters: 0,
			segments: 0,
			issues: 0
		},
		messageHistory: [],

		announce(message) {
			if (this.srAnnouncements) {
				this.srAnnouncements.textContent = message;
				// Clear after a short delay
				setTimeout(() => {
					this.srAnnouncements.textContent = '';
				}, 1000);
			}
		},

		showToast(message, type = 'success') {
			if (!this.toast) return;

			const toastMessage = this.toast.querySelector('.toast-message');
			if (toastMessage) {
				toastMessage.textContent = message;
			}

			this.toast.className = `toast ${type}`;
			this.toast.classList.remove('hidden');

			setTimeout(() => {
				this.toast.classList.add('hidden');
			}, 3000);
		},

		showButtonSuccess(button) {
			if (!button) return;

			button.classList.add('success');

			setTimeout(() => {
				button.classList.remove('success');
			}, 400);
		},

		showButtonError(button) {
			if (!button) return;

			button.classList.add('error');

			setTimeout(() => {
				button.classList.remove('error');
			}, 400);
		},

		updateProgressBar(current, max, encoding) {
			if (!this.charProgress || !this.charLimit) return;

			const percentage = (current / max) * 100;
			this.charProgress.style.width = `${Math.min(percentage, 100)}%`;

			// Color code based on usage
			this.charProgress.classList.remove('warning', 'danger');
			if (percentage >= 90) {
				this.charProgress.classList.add('danger');
			} else if (percentage >= 75) {
				this.charProgress.classList.add('warning');
			}

			// Update character limit display
			this.charLimit.textContent = `/${max}`;
		},

		updateSegmentTrend(current, previous) {
			if (!this.segmentTrend) return;

			if (current > previous && previous > 0) {
				this.segmentTrend.textContent = '+1';
				this.segmentTrend.className = 'stat-trend up visible';
				setTimeout(() => {
					this.segmentTrend.classList.remove('visible');
				}, 2000);
			} else {
				this.segmentTrend.classList.remove('visible');
			}
		},

		updateEncodingBadge(encoding) {
			const badge = this.encodingDisplay.querySelector('.encoding-badge');
			if (!badge) {
				this.encodingDisplay.innerHTML = `<span class="encoding-badge ${encoding === 'GSM-7' ? 'encoding-gsm' : 'encoding-unicode'}">${encoding}</span>`;
			} else {
				badge.textContent = encoding;
				badge.className = `encoding-badge ${encoding === 'GSM-7' ? 'encoding-gsm' : 'encoding-unicode'}`;
			}
		},

		animateStatChange(element) {
			if (!element) return;
			element.classList.remove('updated');
			void element.offsetWidth; // Force reflow
			element.classList.add('updated');
		},


		updateSegmentBreakdown(text, segments, encoding) {
			const segmentBreakdown = document.getElementById('segmentBreakdown');
			const segmentCountBadge = document.getElementById('segmentCountBadge');

			if (!segmentBreakdown) return;

			if (segments > 1 && text.length > 0) {
				// Show badge and update count
				if (segmentCountBadge) {
					segmentCountBadge.classList.remove('hidden');
					segmentCountBadge.textContent = segments;
				}

				// Calculate segment sizes
				const segmentSize = encoding === 'GSM-7' ? 153 : 67;
				let textHtml = '';

				// Show full segment breakdown with text
				for (let i = 0; i < segments; i++) {
					const start = i * segmentSize;
					const end = Math.min(start + segmentSize, text.length);
					const segmentText = text.substring(start, end);
					const charCount = segmentText.length;

					textHtml += `
						<div class="segment-text-block">
							<div class="segment-text-header">
								<span>Segment ${i + 1}</span>
								<span>${charCount} characters</span>
							</div>
							<div class="segment-text-content">${this.escapeHtml(segmentText)}</div>
						</div>
					`;
				}

				segmentBreakdown.innerHTML = textHtml;
			} else {
				// Hide badge
				if (segmentCountBadge) {
					segmentCountBadge.classList.add('hidden');
				}

				// Show empty state
				segmentBreakdown.innerHTML = `
					<div class="empty-state">
						<div class="empty-icon">📄</div>
						<p class="empty-text">Single segment</p>
						<p class="empty-subtext">No breakdown needed</p>
					</div>
				`;
			}
		},

		update() {
			if (!this.messageInput) {
				console.error('messageInput not available in update()');
				return;
			}
			const text = this.messageInput.value || '';
			const normalized = charset.normalize(text);

			// Analyze message
			const analysis = segmenter.analyze(normalized);

			// Scan for issues
			let issues = scanner.scan(normalized, config);

			// Apply context evaluation
			issues = resolver.evaluateContext(issues, normalized, config);

			// Resolve overlaps
			const resolvedIssues = resolver.resolveOverlaps(issues);

			// Update encoding with badge
			this.updateEncodingBadge(analysis.encoding);

			// Animate if changed
			if (this.previousValues.encoding !== analysis.encoding) {
				this.animateStatChange(this.encodingDisplay);
			}

			// Update character count with animation
			if (this.charCount) {
				this.charCount.textContent = analysis.characters;
				if (this.previousValues.characters !== analysis.characters) {
					this.animateStatChange(this.charCount);
				}
			}

			// Update progress bar - always show initial segment limit
			const maxChars = analysis.encoding === 'GSM-7' ? 160 : 70;
			this.updateProgressBar(analysis.characters, maxChars, analysis.encoding);

			// Update segment count with trend
			if (this.segmentCount) {
				this.segmentCount.textContent = analysis.segments;
				if (analysis.segments > 2) {
					this.segmentCount.classList.add('segment-count-warning');
				} else {
					this.segmentCount.classList.remove('segment-count-warning');
				}
				if (this.previousValues.segments !== analysis.segments) {
					this.animateStatChange(this.segmentCount);
					this.updateSegmentTrend(analysis.segments, this.previousValues.segments);
				}
			}

			// Update segment breakdown
			this.updateSegmentBreakdown(normalized, analysis.segments, analysis.encoding);

			// Update preview
			this.updatePreview();

			// Update suggestions
			this.updateSuggestions();

			// Update compliance
			this.updateComplianceChecklist();

			// Store previous values
			this.previousValues.encoding = analysis.encoding;
			this.previousValues.characters = analysis.characters;
			this.previousValues.segments = analysis.segments;

			// Update stats issue count
			const statsIssueCount = document.getElementById('issueCount');
			const warningCountBadge = document.getElementById('warningCountBadge');
			const statCardIssues = document.querySelector('.stat-item-warnings');

			// Filter out highlight-only issues for display count
			const displayableIssues = issues.filter(i => !i.isHighlightOnly);
			if (displayableIssues.length === 0) {
				if (statsIssueCount) statsIssueCount.textContent = '0';
				if (warningCountBadge) warningCountBadge.textContent = '0';
				if (statCardIssues) statCardIssues.classList.remove('has-issues');
				this.updateMasterDetailDisplay([]);
			} else {
				// Group issues by category to get the number of categories
				const categories = {};
				displayableIssues.forEach(issue => {
					if (!categories[issue.category]) {
						categories[issue.category] = [];
					}
					categories[issue.category].push(issue);
				});

				const categoryCount = Object.keys(categories).length;
				// Show the number of categories, not individual issues
				if (statsIssueCount) {
					statsIssueCount.textContent = categoryCount;
					if (this.previousValues.issues !== categoryCount) {
						this.animateStatChange(statsIssueCount);
					}
				}
				if (warningCountBadge) warningCountBadge.textContent = categoryCount;
				if (statCardIssues) statCardIssues.classList.add('has-issues');

				// Store previous issues count
				this.previousValues.issues = categoryCount;

				// Pass ALL issues (including positioned ones) to updateMasterDetailDisplay
				this.updateMasterDetailDisplay(issues);
			}

			// Save to history (debounced)
			if (text.length > 0) {
				this.saveToHistory(text, analysis);
			}

			// Simple approach - no dynamic scaling needed
		},

		createExcerpt(text) {
			// Return plain text for warning details to avoid double styling
			return text;
		},

		extractExcerptFromHint(hint) {
			// Try to extract examples from hint text (e.g., "Found 4 instances: example1, example2...")
			const match = hint.match(/(?:instances|words|marks|emails?|URLs?):\s*(.+?)(?:\.\s+[A-Z]|$)/i);
			if (match && match[1]) {
				let examples = match[1].trim();
				// Remove trailing period if present
				if (examples.endsWith('.')) {
					examples = examples.slice(0, -1);
				}
				// Limit display length for readability
				if (examples.length > 200) {
					const truncated = examples.substring(0, 200);
					const lastComma = truncated.lastIndexOf(',');
					examples = (lastComma > 0 ? truncated.substring(0, lastComma) : truncated) + '...';
				}
				const code = document.createElement('code');
				code.className = 'issue-excerpt';
				code.textContent = examples;
				return code.outerHTML;
			}
			return '';
		},

		formatHint(hint) {
			// Remove the excerpt portion from hint if it exists
			// Updated pattern to handle sentences ending with capital letter
			let cleaned = hint.replace(/Found \d+ (?:instance|instances|words|uppercase words|emails?|URLs?):\s*[^.]+?(?=\.\s+[A-Z]|\.\s*$)/i, '').trim();
			// Clean up any leading punctuation
			cleaned = cleaned.replace(/^\.\s*/, '').trim();
			return cleaned;
		},

		handleInput() {
			// Clear category selection when user types
			this.currentSelectedCategory = null;
			this.clearHighlights();

			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer);
			}
			this.debounceTimer = setTimeout(() => this.update(), config.debounceMs);
		},

		handleCopy() {
			const text = this.messageInput.value;
			if (!text) return;

			navigator.clipboard.writeText(text).then(() => {
				this.showButtonSuccess(this.copyBtn);
				this.announce('Text copied to clipboard');
			}).catch(err => {
				console.error('Failed to copy:', err);
				this.showButtonError(this.copyBtn);
			});
		},

		handleClear() {
			this.messageInput.value = '';
			this.clearHighlights();
			this.update();
			this.messageInput.focus();
			this.showButtonSuccess(this.clearBtn);
			this.announce('Message cleared');
		},

		async handlePaste() {
			try {
				const text = await navigator.clipboard.readText();
				if (text) {
					this.messageInput.value = text;
					this.update();
					this.messageInput.focus();
					this.showButtonSuccess(this.pasteBtn);
					this.announce('Text pasted from clipboard');
				}
			} catch (err) {
				console.error('Failed to paste:', err);
				this.messageInput.focus();
				this.showButtonError(this.pasteBtn);
				this.announce('Please paste manually (Ctrl+V or Cmd+V)');
			}
		},

		handleHistory() {
			const modal = this.historyModal;
			if (!modal) return;

			const historyList = modal.querySelector('#historyList');
			if (!historyList) return;

			// Load history from localStorage
			this.loadHistory();

			if (this.messageHistory.length === 0) {
				historyList.innerHTML = '<div class="history-empty">No message history yet</div>';
			} else {
				let html = '';
				this.messageHistory.slice().reverse().forEach((item, index) => {
					html += `
						<div class="history-item" data-index="${this.messageHistory.length - 1 - index}">
							<div class="history-item-text">${this.escapeHtml(item.text)}</div>
							<div class="history-item-meta">${item.encoding} • ${item.characters} chars • ${item.segments} segments</div>
						</div>
					`;
				});
				historyList.innerHTML = html;

				// Add click handlers
				historyList.querySelectorAll('.history-item').forEach(item => {
					item.addEventListener('click', () => {
						const index = parseInt(item.dataset.index);
						const historyItem = this.messageHistory[index];
						if (historyItem) {
							this.messageInput.value = historyItem.text;
							this.update();
							this.closeModal();
							this.showToast('Message loaded from history', 'success');
						}
					});
				});
			}

			// Show modal
			modal.classList.remove('hidden');
		},

		closeModal() {
			if (this.historyModal) {
				this.historyModal.classList.add('hidden');
			}
		},

		handleExport() {
			const text = this.messageInput.value;
			if (!text) {
				this.showToast('No message to export', 'error');
				return;
			}

			const analysis = segmenter.analyze(charset.normalize(text));
			const issues = scanner.scan(charset.normalize(text), config);

			const report = {
				message: text,
				encoding: analysis.encoding,
				characters: analysis.characters,
				segments: analysis.segments,
				warnings: issues.map(i => ({
					category: i.category,
					text: i.text,
					hint: i.hint
				})),
				timestamp: new Date().toISOString()
			};

			const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `sms-linter-report-${Date.now()}.json`;
			a.click();
			URL.revokeObjectURL(url);

			this.showToast('Report exported', 'success');
		},


		saveToHistory(text, analysis) {
			// Debounced save - don't save on every keystroke
			clearTimeout(this.historySaveTimer);
			this.historySaveTimer = setTimeout(() => {
				// Don't save duplicates or empty messages
				if (!text || this.messageHistory.some(h => h.text === text)) return;

				const historyItem = {
					text: text,
					encoding: analysis.encoding,
					characters: analysis.characters,
					segments: analysis.segments,
					timestamp: Date.now()
				};

				this.messageHistory.push(historyItem);

				// Keep only last 20 messages
				if (this.messageHistory.length > 20) {
					this.messageHistory = this.messageHistory.slice(-20);
				}

				// Save to localStorage
				try {
					localStorage.setItem('smsLinterHistory', JSON.stringify(this.messageHistory));
				} catch (e) {
					console.error('Failed to save history:', e);
				}
			}, 2000);
		},

		loadHistory() {
			try {
				const saved = localStorage.getItem('smsLinterHistory');
				if (saved) {
					this.messageHistory = JSON.parse(saved);
				}
			} catch (e) {
				console.error('Failed to load history:', e);
				this.messageHistory = [];
			}
		},

		setupKeyboardShortcuts() {
			document.addEventListener('keydown', (e) => {
				// Cmd/Ctrl + K to clear
				if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
					e.preventDefault();
					this.handleClear();
				}

				// Cmd/Ctrl + H for history
				if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
					e.preventDefault();
					this.handleHistory();
				}

				// Escape to close modal
				if (e.key === 'Escape') {
					this.closeModal();
				}
			});
		},



		init() {
			// Initialize DOM references
			this.messageInput = document.getElementById('messageInput');
			this.highlightOverlay = document.getElementById('highlightOverlay');
			this.encodingDisplay = document.getElementById('encodingDisplay');
			this.charCount = document.getElementById('charCount');
			this.charLimit = document.getElementById('charLimit');
			this.charProgress = document.getElementById('charProgress');
			this.segmentCount = document.getElementById('segmentCount');
			this.segmentTrend = document.getElementById('segmentTrend');
			this.issueCount = document.getElementById('issueCount');
			this.srAnnouncements = document.getElementById('srAnnouncements');
			this.pasteBtn = document.getElementById('pasteBtn');
			this.copyBtn = document.getElementById('copyBtn');
			this.clearBtn = document.getElementById('clearBtn');
			this.historyBtn = document.getElementById('historyBtn');
			this.exportBtn = document.getElementById('exportBtn');
			this.toast = document.getElementById('toast');
			this.historyModal = document.getElementById('historyModal');
			this.tabWarnings = document.getElementById('tabWarnings');
			this.tabSegments = document.getElementById('tabSegments');
			this.tabPreview = document.getElementById('tabPreview');
			this.tabSuggestions = document.getElementById('tabSuggestions');
			this.tabHistory = document.getElementById('tabHistory');
			this.tabCompliance = document.getElementById('tabCompliance');

			// Wait for DOM to be ready
			if (!this.messageInput) {
				console.error('messageInput not found');
				return;
			}

			// Load history from localStorage
			this.loadHistory();

			// Sync overlay with textarea (desktop only - disabled on mobile)
			const syncOverlay = () => {
				if (this.highlightOverlay && this.messageInput) {
					const computedStyle = window.getComputedStyle(this.messageInput);
					const textareaRect = this.messageInput.getBoundingClientRect();

					this.highlightOverlay.style.height = this.messageInput.scrollHeight + 'px';
					this.highlightOverlay.style.width = computedStyle.width;
					this.highlightOverlay.style.padding = computedStyle.padding;
					this.highlightOverlay.style.fontFamily = computedStyle.fontFamily;
					this.highlightOverlay.style.fontSize = computedStyle.fontSize;
					this.highlightOverlay.style.fontWeight = computedStyle.fontWeight;
					this.highlightOverlay.style.lineHeight = computedStyle.lineHeight;
					this.highlightOverlay.style.letterSpacing = computedStyle.letterSpacing;
					this.highlightOverlay.style.wordSpacing = computedStyle.wordSpacing;
					this.highlightOverlay.style.whiteSpace = computedStyle.whiteSpace;
					this.highlightOverlay.style.wordWrap = computedStyle.wordWrap;
					this.highlightOverlay.style.wordBreak = computedStyle.wordBreak;
				}
			};

			// Sync scroll between textarea and overlay (only on desktop)
			const handleScroll = () => {
				if (this.highlightOverlay && this.messageInput && window.innerWidth >= 768) {
					this.highlightOverlay.scrollTop = this.messageInput.scrollTop;
					this.highlightOverlay.scrollLeft = this.messageInput.scrollLeft;
				}
			};

			if (this.messageInput) {
				this.messageInput.addEventListener('scroll', handleScroll);
			}

			// Initial sync
			syncOverlay();

			// Bind events
			if (this.messageInput) {
				this.messageInput.addEventListener('input', () => {
					this.handleInput();
					if (window.innerWidth >= 768) {
						setTimeout(syncOverlay, 0);
					}
				});
			} else {
				console.error('Cannot attach input event listener: messageInput is null');
			}

			// Sync on window resize
			let resizeTimeout;
			window.addEventListener('resize', () => {
				clearTimeout(resizeTimeout);
				resizeTimeout = setTimeout(() => {
					if (window.innerWidth >= 768) {
						syncOverlay();
					}
				}, 100);
			});

			// Bind button events
			this.pasteBtn.addEventListener('click', () => this.handlePaste());
			this.copyBtn.addEventListener('click', () => this.handleCopy());
			this.clearBtn.addEventListener('click', () => this.handleClear());

			// Bind new button events
			if (this.historyBtn) this.historyBtn.addEventListener('click', () => this.handleHistory());
			if (this.exportBtn) this.exportBtn.addEventListener('click', () => this.handleExport());

			// Bind tab switching
			if (this.tabWarnings) this.tabWarnings.addEventListener('click', () => this.switchTab('warnings'));
			if (this.tabSegments) this.tabSegments.addEventListener('click', () => this.switchTab('segments'));
			if (this.tabPreview) this.tabPreview.addEventListener('click', () => this.switchTab('preview'));
			if (this.tabSuggestions) this.tabSuggestions.addEventListener('click', () => this.switchTab('suggestions'));
			if (this.tabHistory) this.tabHistory.addEventListener('click', () => this.switchTab('history'));
			if (this.tabCompliance) this.tabCompliance.addEventListener('click', () => this.switchTab('compliance'));

			// Bind modal close buttons
			if (this.historyModal) {
				const closeBtn = this.historyModal.querySelector('.modal-close');
				const overlay = this.historyModal.querySelector('.modal-overlay');
				if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
				if (overlay) overlay.addEventListener('click', () => this.closeModal());
			}

			// Setup keyboard shortcuts
			this.setupKeyboardShortcuts();

			// Initial update
			console.log('SMS Linter: Initializing, calling update()...');
			console.log('SMS Linter: messageInput found:', !!this.messageInput);
			console.log('SMS Linter: charCount found:', !!this.charCount);
			this.update();
			console.log('SMS Linter: Initial update complete');

			// Initialize mobile nav toggle
			this.initMobileNav();
		},


		updateMasterDetailDisplay(issues) {
			const warningsAll = document.getElementById('warningsAll');

			if (issues.length === 0) {
				warningsAll.innerHTML = `
					<div class="empty-state">
						<div class="empty-icon">✓</div>
						<p class="empty-text">No issues detected</p>
						<p class="empty-subtext">Your message looks clean!</p>
					</div>
				`;
				return;
			}

			// Group issues by category
			const categories = {};
			issues.forEach(issue => {
				if (issue.isSummary || (!issue.isHighlightOnly && !issue.isSummary)) {
					if (!categories[issue.category]) {
						categories[issue.category] = [];
					}
					categories[issue.category].push(issue);
				}
			});

			// Store all individual positioned issues separately for highlighting
			this.allPositionedIssues = issues.filter(issue => !issue.isSummary);

			// Render all warnings inline with full details
			let warningsHTML = '';
			Object.keys(categories).forEach(category => {
				const categoryIssues = categories[category];
				const categoryPositionedIssues = this.allPositionedIssues.filter(issue => issue.category === category);
				const actualCount = categoryPositionedIssues.length;

				// Get examples
				const rawExamples = categoryPositionedIssues.map(issue => issue.text).filter(text => text);
				let examples = rawExamples;

				// Group examples for Formatting and Symbols
				if (category === 'Formatting') {
					const groupedExamples = {};
					rawExamples.forEach(example => {
						if (example === '!' || example === '!!') {
							groupedExamples['!'] = (groupedExamples['!'] || 0) + 1;
						} else {
							groupedExamples[example] = (groupedExamples[example] || 0) + 1;
						}
					});
					examples = Object.keys(groupedExamples);
				} else if (category === 'Symbols') {
					const groupedExamples = {};
					rawExamples.forEach(example => {
						if (example === '$') {
							groupedExamples['$'] = (groupedExamples['$'] || 0) + 1;
						} else if (example === '@') {
							groupedExamples['@'] = (groupedExamples['@'] || 0) + 1;
						} else {
							groupedExamples[example] = (groupedExamples[example] || 0) + 1;
						}
					});
					examples = Object.keys(groupedExamples);
				}

				// Get description
				const description = this.getRuleHint(category);

				// Format examples for display (limit to 5 unique examples, show more if needed)
				let examplesDisplay = '';
				if (examples.length > 0) {
					const uniqueExamples = [...new Set(examples)].slice(0, 5);
					const remainingCount = examples.length - uniqueExamples.length;
					examplesDisplay = `
						<div class="warning-item-examples">
							<div class="warning-examples-list">
								${uniqueExamples.map(ex => `
									<span class="warning-example-item">${this.escapeHtml(ex)}</span>
								`).join('')}
								${remainingCount > 0 ? `<span class="warning-example-more">+${remainingCount}</span>` : ''}
						</div>
						</div>
					`;
				}

				// Build elegant warning card with examples
				warningsHTML += `
					<div class="warning-item-inline" data-category="${category}">
						<div class="warning-item-header">
							<span class="warning-item-name-inline">${category}</span>
							<span class="warning-item-badge-inline">${actualCount}</span>
						</div>
						<div class="warning-item-description-inline">${description}</div>
						${examplesDisplay}
					</div>
				`;
			});

			warningsAll.innerHTML = warningsHTML;

			// Auto-highlight all warnings
			this.highlightAllWarnings();
		},

		highlightAllWarnings() {
			// Skip highlighting on mobile
			if (window.innerWidth < 768) {
				return;
			}

			if (!this.highlightOverlay || !this.allPositionedIssues || !this.messageInput) {
				return;
			}

			// Get the current text
			const text = this.messageInput.value || '';
			if (!text) {
				this.clearHighlights();
				return;
			}

			// Get all positioned issues with valid positions
			const positionedIssues = this.allPositionedIssues.filter(issue =>
				issue.start !== undefined &&
				issue.end !== undefined &&
				issue.start >= 0 &&
				issue.end <= text.length &&
				issue.start < issue.end
			);

			if (positionedIssues.length === 0) {
				this.clearHighlights();
				return;
			}

			// Ensure overlay is perfectly aligned with textarea
			const computedStyle = window.getComputedStyle(this.messageInput);
			this.highlightOverlay.style.height = this.messageInput.scrollHeight + 'px';
			this.highlightOverlay.style.width = computedStyle.width;
			this.highlightOverlay.style.padding = computedStyle.padding;
			this.highlightOverlay.style.fontFamily = computedStyle.fontFamily;
			this.highlightOverlay.style.fontSize = computedStyle.fontSize;
			this.highlightOverlay.style.fontWeight = computedStyle.fontWeight;
			this.highlightOverlay.style.lineHeight = computedStyle.lineHeight;
			this.highlightOverlay.style.letterSpacing = computedStyle.letterSpacing;
			this.highlightOverlay.style.wordSpacing = computedStyle.wordSpacing;
			this.highlightOverlay.style.whiteSpace = computedStyle.whiteSpace;
			this.highlightOverlay.style.wordWrap = computedStyle.wordWrap;
			this.highlightOverlay.style.wordBreak = computedStyle.wordBreak;
			this.highlightOverlay.style.textAlign = computedStyle.textAlign;

			// Sort by start position
			positionedIssues.sort((a, b) => a.start - b.start);

			// Merge overlapping positions to avoid nested highlights
			const mergedRanges = [];
			for (const issue of positionedIssues) {
				if (mergedRanges.length === 0) {
					mergedRanges.push({ start: issue.start, end: issue.end });
				} else {
					const last = mergedRanges[mergedRanges.length - 1];
					if (issue.start <= last.end) {
						// Overlapping or adjacent - merge
						last.end = Math.max(last.end, issue.end);
					} else {
						// Non-overlapping - add new range
						mergedRanges.push({ start: issue.start, end: issue.end });
					}
				}
			}

			// Build highlighted HTML using exact positions
			let highlightedHTML = '';
			let lastIndex = 0;

			for (const range of mergedRanges) {
				// Add text before highlight
				if (range.start > lastIndex) {
					highlightedHTML += this.escapeHtml(text.substring(lastIndex, range.start));
				}

				// Add highlighted text
				const highlightText = text.substring(range.start, range.end);
				if (highlightText.length > 0) {
					highlightedHTML += `<span class="warning-highlight">${this.escapeHtml(highlightText)}</span>`;
				}

				lastIndex = range.end;
			}

			// Add remaining text
			if (lastIndex < text.length) {
				highlightedHTML += this.escapeHtml(text.substring(lastIndex));
			}

			// Set the overlay content
			this.highlightOverlay.innerHTML = highlightedHTML;

			// Sync scroll position after highlighting
			this.highlightOverlay.scrollTop = this.messageInput.scrollTop;
			this.highlightOverlay.scrollLeft = this.messageInput.scrollLeft;
		},

		clearHighlights() {
			if (this.highlightOverlay) {
				this.highlightOverlay.innerHTML = '';
			}
		},

		getRuleHint(category) {
			const hints = {
				'URLs': 'Links can trigger additional carrier scrutiny. Avoid URL shortening services (bit.ly, tinyurl, etc.) as they are frequently flagged.',
				'High-risk language': 'High-risk language may trigger spam filters.',
				'Symbols': 'Currency symbols and email addresses may reduce deliverability. Consider using "USD" or "CAN" instead of $ symbols.',
				'Encoding': 'Using emojis or special characters switches your message to Unicode encoding, which cuts segment capacity from 160 to 70 characters per segment. Long multipart messages are more likely to be flagged as spam, delayed, or dropped entirely by carriers.',
				'Formatting': 'Excessive capitalization, multiple punctuation marks (!!, ???), or aggressive formatting may be flagged by carriers as potential spam.'
			};
			return hints[category] || 'This content may trigger spam filters.';
		},

		_old_showWarningDetail(issues, category) {
			const warningDetail = document.getElementById('warningDetail');

			console.log(`DEBUG: showWarningDetail called for ${category} with ${issues.length} issues:`, issues);

			// Collect examples from positioned issues (what gets highlighted) for consistency
			const categoryPositionedIssues = this.allPositionedIssues.filter(issue => issue.category === category);
			const rawExamples = categoryPositionedIssues.map(issue => issue.text).filter(text => text);

			// For formatting category, group similar punctuation types elegantly
			let examples = rawExamples;
			if (category === 'Formatting') {
				const groupedExamples = {};
				rawExamples.forEach(example => {
					// Group single ! and consecutive !! together as "exclamation marks"
					if (example === '!' || example === '!!') {
						groupedExamples['!'] = (groupedExamples['!'] || 0) + 1;
					} else {
						groupedExamples[example] = (groupedExamples[example] || 0) + 1;
					}
				});

				// Create clean examples without counts in the text
				examples = Object.keys(groupedExamples);
			} else if (category === 'Symbols') {
				const groupedExamples = {};
				rawExamples.forEach(example => {
					// Group individual $ symbols
					if (example === '$') {
						groupedExamples['$'] = (groupedExamples['$'] || 0) + 1;
					} else if (example === '@') {
						groupedExamples['@'] = (groupedExamples['@'] || 0) + 1;
					} else {
						// For email addresses or other symbols, keep as is
						groupedExamples[example] = (groupedExamples[example] || 0) + 1;
					}
				});

				// Create clean examples without counts in the text
				examples = Object.keys(groupedExamples);
			}

			console.log(`DEBUG: Category ${category} positioned issues for examples:`, categoryPositionedIssues);
			console.log(`DEBUG: Raw examples:`, rawExamples);
			console.log(`DEBUG: Final examples array for ${category}:`, examples);

			// Create highlighted examples display
			let examplesHTML = '';
			let descriptionHTML = '';

			if (examples.length > 0) {
				// Count based on positioned issues (what gets highlighted) for consistency
				const categoryPositionedIssues = this.allPositionedIssues.filter(issue => issue.category === category);
				const totalExamples = categoryPositionedIssues.length;

				console.log(`DEBUG: Category ${category} positioned issues for detail:`, categoryPositionedIssues);
				console.log(`DEBUG: Total examples calculated:`, totalExamples);

				const instanceText = totalExamples === 1 ? 'issue' : 'issues';

				// For formatting category, create elegant display with separate counts
				let exampleSpans = '';
				if (category === 'Formatting') {
					// Group examples and show counts separately
					const groupedExamples = {};
					rawExamples.forEach(example => {
						if (example === '!' || example === '!!') {
							groupedExamples['!'] = (groupedExamples['!'] || 0) + 1;
						} else {
							groupedExamples[example] = (groupedExamples[example] || 0) + 1;
						}
					});

					exampleSpans = Object.entries(groupedExamples).map(([punct, count]) => {
						const countText = count > 1 ? ` <span class="warning-detail-count">(${count})</span>` : '';
						return `<span class="warning-detail-example">${punct}${countText}</span>`;
					}).join('');
				} else if (category === 'Symbols') {
					// Group symbols and show counts separately
					const groupedExamples = {};
					rawExamples.forEach(example => {
						if (example === '$') {
							groupedExamples['$'] = (groupedExamples['$'] || 0) + 1;
						} else if (example === '@') {
							groupedExamples['@'] = (groupedExamples['@'] || 0) + 1;
						} else {
							// For email addresses or other symbols, keep as is
							groupedExamples[example] = (groupedExamples[example] || 0) + 1;
						}
					});

					exampleSpans = Object.entries(groupedExamples).map(([symbol, count]) => {
						const countText = count > 1 ? ` <span class="warning-detail-count">(${count})</span>` : '';
						return `<span class="warning-detail-example">${symbol}${countText}</span>`;
					}).join('');
				} else {
					// For other categories, use simple display
					exampleSpans = examples.map(example =>
						`<span class="warning-detail-example">${example}</span>`
					).join('');
				}

				examplesHTML = `
					<div class="warning-detail-examples">
						<div class="warning-detail-examples-title">Found ${totalExamples} ${instanceText}:</div>
						${exampleSpans}
					</div>
				`;
			}

			// Create description - use the hint from the rule, not from individual issues
			if (issues.length > 0) {
				// Get the hint from the rule definition, not from the issue
				const ruleHint = this.getRuleHint(category);
				descriptionHTML = `
					<div class="warning-detail-description">
						<p>${ruleHint}</p>
					</div>
				`;
			}

			warningDetail.innerHTML = `
				<div class="warning-detail-content">
					<div class="warning-detail-header">
					<h3 class="warning-detail-title">${category}</h3>
					</div>
					${examplesHTML}
					${descriptionHTML}
				</div>
			`;
		},


		// OLD COMPLEX FUNCTION (DISABLED):
		_old_highlightWarningText(issues, category) {
			console.log('=== HIGHLIGHTING CATEGORY:', category, '===');
			console.log('Category type:', typeof category);
			console.log('Category length:', category ? category.length : 'null');

			// Clear any existing highlights FIRST
			this.clearHighlights();

			// Get the current text content from textarea
			const text = this.messageInput.value;
			if (!text) {
				console.log('No text to highlight');
				return;
			}

			// Get positioned issues for this specific category ONLY
			console.log('Filtering for category:', category);
			console.log('All positioned issues before filter:', this.allPositionedIssues);
			const categoryPositionedIssues = this.allPositionedIssues.filter(issue => {
				const matches = issue.category === category;
				console.log('Checking issue:', issue.text, 'category:', `"${issue.category}"`, 'target:', `"${category}"`, 'matches:', matches);
				return matches;
			});
			console.log('Positioned issues for', category, ':', categoryPositionedIssues);

			if (categoryPositionedIssues.length === 0) {
				console.log('No positioned issues found for category:', category);
				return;
			}

			// Collect examples to highlight for this specific category ONLY
			const examplesToHighlight = [];
			categoryPositionedIssues.forEach(issue => {
				if (issue.text) {
					examplesToHighlight.push(issue.text);
				}
			});

			console.log('Examples to highlight for', category, ':', examplesToHighlight);

			if (examplesToHighlight.length === 0) {
				console.log('No examples found for category:', category);
				return;
			}

			// Remove duplicates
			const uniqueExamples = [...new Set(examplesToHighlight)];
			console.log('Unique examples for', category, ':', uniqueExamples);

			// Test: Let's also try to highlight ALL issues to see if the problem is with filtering
			console.log('TESTING: Highlighting ALL issues to verify mark.js works');
			if (typeof Mark !== 'undefined' && this.highlightOverlay) {
				// Set the overlay content to match textarea
				this.highlightOverlay.innerHTML = this.escapeHtml(text);

				// Create mark instance
				const markInstance = new Mark(this.highlightOverlay);

				// Highlight ALL examples from ALL categories (for testing)
				const allExamples = this.allPositionedIssues.map(issue => issue.text).filter(text => text);
				console.log('ALL examples from ALL categories:', allExamples);

				// Clear first
				markInstance.unmark();

				// Highlight all examples
				markInstance.mark(allExamples, {
					element: 'span',
					className: 'warning-highlight',
					separateWordSearch: false,
					done: function () {
						console.log('TEST: Highlighting ALL examples completed');
					}
				});

				return; // Exit early for testing
			}

			// Use mark.js library for reliable highlighting
			if (typeof Mark !== 'undefined' && this.highlightOverlay) {
				// Set the overlay content to match textarea
				this.highlightOverlay.innerHTML = this.escapeHtml(text);

				// Create mark instance
				const markInstance = new Mark(this.highlightOverlay);

				// Highlight only the examples for this category
				markInstance.mark(uniqueExamples, {
					element: 'span',
					className: 'warning-highlight',
					separateWordSearch: false,
					done: function () {
						console.log('Highlighting completed for', category);
					}
				});

				// Ensure perfect alignment
				this.updateOverlayAlignment();
			} else {
				console.log('Mark.js not available or overlay missing');
			}
		},

		escapeRegExp(string) {
			return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		},

		getCategoryClass(category) {
			const categoryClasses = {
				'High-risk language': 'high-risk',
				'URLs': 'urls',
				'Symbols': 'symbols',
				'Formatting': 'formatting',
				'Encoding': 'encoding'
			};
			return categoryClasses[category] || 'warning-highlight';
		},

		escapeHtml(text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		},

		clearHighlights() {
			// Skip on mobile
			if (window.innerWidth < 768) {
				return;
			}

			// Clear the highlight overlay
			if (this.highlightOverlay) {
				this.highlightOverlay.innerHTML = '';
			}
		},

		updateOverlayAlignment() {
			console.log('ALIGNING OVERLAY');
			console.log('Overlay element:', this.highlightOverlay);
			console.log('Textarea element:', this.messageInput);

			// Ensure overlay stays perfectly aligned with textarea
			if (this.highlightOverlay && this.messageInput) {
				// Copy all computed styles from textarea to overlay
				const computedStyle = window.getComputedStyle(this.messageInput);
				console.log('Computed styles:', {
					fontSize: computedStyle.fontSize,
					padding: computedStyle.padding,
					width: computedStyle.width,
					height: computedStyle.height
				});

				this.highlightOverlay.style.fontFamily = computedStyle.fontFamily;
				this.highlightOverlay.style.fontSize = computedStyle.fontSize;
				this.highlightOverlay.style.fontWeight = computedStyle.fontWeight;
				this.highlightOverlay.style.lineHeight = computedStyle.lineHeight;
				this.highlightOverlay.style.letterSpacing = computedStyle.letterSpacing;
				this.highlightOverlay.style.wordSpacing = computedStyle.wordSpacing;
				this.highlightOverlay.style.padding = computedStyle.padding;
				this.highlightOverlay.style.margin = computedStyle.margin;
				this.highlightOverlay.style.border = computedStyle.border;
				this.highlightOverlay.style.borderRadius = computedStyle.borderRadius;
				this.highlightOverlay.style.boxSizing = computedStyle.boxSizing;
				this.highlightOverlay.style.width = computedStyle.width;
				this.highlightOverlay.style.height = computedStyle.height;
				this.highlightOverlay.style.whiteSpace = computedStyle.whiteSpace;
				this.highlightOverlay.style.wordWrap = computedStyle.wordWrap;
				this.highlightOverlay.style.wordBreak = computedStyle.wordBreak;
				this.highlightOverlay.style.overflow = computedStyle.overflow;
				this.highlightOverlay.style.overflowX = computedStyle.overflowX;
				this.highlightOverlay.style.overflowY = computedStyle.overflowY;
				this.highlightOverlay.style.textAlign = computedStyle.textAlign;
				this.highlightOverlay.style.direction = computedStyle.direction;
				this.highlightOverlay.style.unicodeBidi = computedStyle.unicodeBidi;

				console.log('Overlay aligned');
			} else {
				console.log('MISSING ELEMENTS FOR ALIGNMENT');
			}
		},

		// Simple approach - no dynamic scaling needed

		updatePreview() {
			const messagePreview = document.getElementById('messagePreview');
			if (!messagePreview) return;

			const text = this.messageInput.value || '';
			const normalized = charset.normalize(text);
			const analysis = segmenter.analyze(normalized);

			const segments = analysis.segments;

			let previewHTML = '<div class="phone-preview">';
			previewHTML += '<div class="iphone-frame">';
			previewHTML += '<div class="iphone-notch"></div>';
			previewHTML += '<div class="iphone-screen">';
			previewHTML += '<div class="iphone-status-bar"></div>'; // status-bar
			previewHTML += '<div class="phone-messages">';

			if (text) {
				if (segments <= 2) {
					// Safe segment count (<= 2) - show as one message bubble
					previewHTML += `
					<div class="message-bubble">
						<div class="message-text">${this.escapeHtml(text)}</div>
					</div>
				`;
				} else {
					// Multiple segments (> 2) - show as separate bubbles
					// Use same calculation as segment breakdown
					const segmentSize = analysis.encoding === 'GSM-7' ? 153 : 67;
					for (let i = 0; i < segments; i++) {
						const start = i * segmentSize;
						const end = Math.min(start + segmentSize, text.length);
						const segmentText = text.substring(start, end);

						previewHTML += `
						<div class="message-bubble">
							<div class="message-text">${this.escapeHtml(segmentText)}</div>
							${i < segments - 1 ? '<div class="message-continuation">···</div>' : ''}
						</div>
					`;
					}
				}
			}

			previewHTML += '</div>'; // phone-messages
			previewHTML += '<div class="iphone-home-indicator"></div>';
			previewHTML += '</div>'; // iphone-screen
			previewHTML += '</div>'; // iphone-frame
			previewHTML += '</div>'; // phone-preview

			if (segments > 2) {
				previewHTML += `
				<div class="preview-info">
					<span class="preview-segment-count">${segments} segment${segments > 1 ? 's' : ''}</span>
					<span class="preview-scroll-hint">Scroll to view all</span>
				</div>
			`;
			}

			messagePreview.innerHTML = previewHTML;

			// Initialize drag-to-scroll for phone messages
			this.initDragScroll();
		},

		initDragScroll() {
			const phoneMessages = document.querySelector('.phone-messages');
			if (!phoneMessages) return;

			// Remove existing listeners if any
			const newPhoneMessages = phoneMessages.cloneNode(true);
			phoneMessages.parentNode.replaceChild(newPhoneMessages, phoneMessages);

			let isDragging = false;
			let startY = 0;
			let scrollTop = 0;

			newPhoneMessages.addEventListener('mousedown', (e) => {
				isDragging = true;
				startY = e.pageY;
				scrollTop = newPhoneMessages.scrollTop;
				newPhoneMessages.style.cursor = 'grabbing';
				e.preventDefault();
			});

			document.addEventListener('mouseleave', () => {
				if (isDragging) {
					isDragging = false;
					newPhoneMessages.style.cursor = 'grab';
				}
			});

			document.addEventListener('mouseup', () => {
				if (isDragging) {
					isDragging = false;
					newPhoneMessages.style.cursor = 'grab';
				}
			});

			document.addEventListener('mousemove', (e) => {
				if (!isDragging) return;
				e.preventDefault();
				const y = e.pageY;
				const walk = (y - startY) * 1.5;
				newPhoneMessages.scrollTop = scrollTop - walk;
			});
		},

		updateSuggestions() {
			const messageSuggestions = document.getElementById('messageSuggestions');
			if (!messageSuggestions) return;

			const text = this.messageInput.value || '';
			if (!text) {
				messageSuggestions.innerHTML = `
					<div class="empty-state">
						<div class="empty-icon">💡</div>
						<p class="empty-text">Smart suggestions</p>
						<p class="empty-subtext">Get recommendations to improve your message</p>
					</div>
				`;
				return;
			}

			const normalized = charset.normalize(text);
			const analysis = segmenter.analyze(normalized);
			const issues = scanner.scan(normalized, config);
			const displayableIssues = issues.filter(i => !i.isHighlightOnly);

			if (displayableIssues.length === 0) {
				messageSuggestions.innerHTML = `
					<div class="empty-state">
						<div class="empty-icon">✓</div>
						<p class="empty-text">No suggestions</p>
						<p class="empty-subtext">Your message looks great!</p>
					</div>
				`;
				return;
			}

			let suggestionsHTML = '<div class="suggestions-list">';

			displayableIssues.forEach(issue => {
				let suggestion = '';
				let action = '';

				if (issue.category === 'Symbols' && issue.text === '$') {
					suggestion = 'Replace "$" with "USD" or "dollars"';
					action = 'Replace $ with USD';
				} else if (issue.category === 'Symbols' && issue.text === '@') {
					suggestion = 'Email addresses may trigger spam filters';
					action = 'Remove email';
				} else if (issue.category === 'URLs') {
					suggestion = 'Avoid URL shorteners (bit.ly, tinyurl, etc.)';
					action = 'Use full URL';
				} else if (issue.category === 'Formatting') {
					suggestion = 'Reduce excessive punctuation or capitalization';
					action = 'Simplify formatting';
				} else if (issue.category === 'Encoding') {
					suggestion = 'Emojis reduce segment capacity from 160 to 70 characters';
					action = 'Remove emojis';
				} else if (issue.category === 'High-Risk Language') {
					suggestion = 'High-risk words may trigger spam filters';
					action = 'Use alternative wording';
				} else {
					suggestion = issue.hint || 'Review this element';
					action = 'Review';
				}

				suggestionsHTML += `
					<div class="suggestion-item">
						<div class="suggestion-content">
							<div class="suggestion-text">${this.escapeHtml(suggestion)}</div>
							${issue.text ? `<div class="suggestion-example">Example: "${this.escapeHtml(issue.text)}"</div>` : ''}
						</div>
						<button class="suggestion-action" data-action="${this.escapeHtml(action)}">${this.escapeHtml(action)}</button>
					</div>
				`;
			});

			suggestionsHTML += '</div>';
			messageSuggestions.innerHTML = suggestionsHTML;
		},

		updateInlineHistory() {
			const inlineHistory = document.getElementById('inlineHistory');
			if (!inlineHistory) return;

			const history = JSON.parse(localStorage.getItem('smsLinterHistory') || '[]');

			if (history.length === 0) {
				inlineHistory.innerHTML = `
					<div class="empty-state">
						<div class="empty-icon">🕐</div>
						<p class="empty-text">No history</p>
						<p class="empty-subtext">Your recent messages will appear here</p>
					</div>
				`;
				return;
			}

			let historyHTML = `
				<div class="history-header">
					<div class="history-header-title">Message History</div>
					<button class="history-clear-all-btn" aria-label="Clear all history">Clear All</button>
				</div>
				<div class="history-list">
			`;

			history.slice(0, 10).forEach((item, displayIndex) => {
				const actualIndex = displayIndex;
				const date = new Date(item.timestamp);
				const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
				const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

				historyHTML += `
					<div class="history-item" data-index="${actualIndex}">
						<div class="history-content">
							<div class="history-text">${this.escapeHtml(item.text.substring(0, 100))}${item.text.length > 100 ? '...' : ''}</div>
							<div class="history-meta">
								<span>${item.segments} segment${item.segments !== 1 ? 's' : ''}</span>
								<span>•</span>
								<span>${item.encoding}</span>
								<span>•</span>
								<span>${dateStr} ${timeStr}</span>
							</div>
						</div>
						<div class="history-actions">
							<button class="history-restore-btn" data-text="${this.escapeHtml(item.text)}">Apply</button>
							<button class="history-delete-btn" data-index="${actualIndex}" aria-label="Delete this message" title="Delete this message">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<line x1="18" y1="6" x2="6" y2="18"></line>
									<line x1="6" y1="6" x2="18" y2="18"></line>
								</svg>
							</button>
						</div>
					</div>
				`;
			});

			historyHTML += '</div>';
			inlineHistory.innerHTML = historyHTML;

			// Bind restore buttons
			inlineHistory.querySelectorAll('.history-restore-btn').forEach(btn => {
				btn.addEventListener('click', () => {
					const text = btn.dataset.text;
					this.messageInput.value = text;
					this.update();
					this.messageInput.focus();
					this.switchTab('warnings');
				});
			});

			// Bind delete buttons
			inlineHistory.querySelectorAll('.history-delete-btn').forEach(btn => {
				btn.addEventListener('click', () => {
					const index = parseInt(btn.dataset.index);
					this.deleteHistoryItem(index);
				});
			});

			// Bind clear all button
			const clearAllBtn = inlineHistory.querySelector('.history-clear-all-btn');
			if (clearAllBtn) {
				clearAllBtn.addEventListener('click', () => {
					if (confirm('Are you sure you want to clear all message history?')) {
						this.clearAllHistory();
					}
				});
			}
		},

		deleteHistoryItem(index) {
			const history = JSON.parse(localStorage.getItem('smsLinterHistory') || '[]');
			if (index >= 0 && index < history.length) {
				history.splice(index, 1);
				localStorage.setItem('smsLinterHistory', JSON.stringify(history));
				this.updateInlineHistory();
			}
		},

		clearAllHistory() {
			localStorage.removeItem('smsLinterHistory');
			this.updateInlineHistory();
		},

		updateComplianceChecklist() {
			const complianceChecklist = document.getElementById('complianceChecklist');
			if (!complianceChecklist) return;

			const text = this.messageInput.value || '';
			const normalized = charset.normalize(text);
			const analysis = segmenter.analyze(normalized);
			const issues = scanner.scan(normalized, config);
			const displayableIssues = issues.filter(i => !i.isHighlightOnly);

			const checklist = [
				{ id: 'opt-out', label: 'Include opt-out instructions', required: true, passed: text.toLowerCase().includes('stop') || text.toLowerCase().includes('unsubscribe') },
				{ id: 'length', label: 'Message fits within segment limits', required: true, passed: analysis.segments <= 1 },
				{ id: 'no-shorteners', label: 'No URL shorteners (bit.ly, tinyurl, etc.)', required: true, passed: !/(?:bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly)/i.test(text) },
				{ id: 'no-risky', label: 'No high-risk language', required: false, passed: !displayableIssues.some(i => i.category === 'High-Risk Language') },
				{ id: 'encoding', label: 'Prefer GSM-7 encoding when possible', required: false, passed: analysis.encoding === 'GSM-7' },
				{ id: 'formatting', label: 'Professional formatting', required: false, passed: !displayableIssues.some(i => i.category === 'Formatting') }
			];

			const requiredPassed = checklist.filter(c => c.required && c.passed).length;
			const requiredTotal = checklist.filter(c => c.required).length;
			const allPassed = checklist.filter(c => c.passed).length;

			let complianceHTML = `
				<div class="compliance-summary">
					<div class="compliance-score">
						<div class="score-value">${requiredPassed}/${requiredTotal}</div>
						<div class="score-label">Required checks passed</div>
					</div>
					<div class="compliance-overall">
						${allPassed === checklist.length ? '✓' : '⚠'} ${allPassed}/${checklist.length} total
					</div>
				</div>
				
				<div class="checklist-items">
			`;

			checklist.forEach(item => {
				complianceHTML += `
					<div class="checklist-item ${item.passed ? 'passed' : 'failed'} ${item.required ? 'required' : ''}">
						<div class="checklist-icon">${item.passed ? '✓' : '✗'}</div>
						<div class="checklist-content">
							<div class="checklist-label">
								${this.escapeHtml(item.label)}
								${item.required ? '<span class="checklist-required">Required</span>' : ''}
							</div>
						</div>
					</div>
				`;
			});

			complianceHTML += '</div>';
			complianceChecklist.innerHTML = complianceHTML;
		},

		switchTab(tabName) {
			// Update tab buttons
			const tabs = document.querySelectorAll('.analysis-tab');
			tabs.forEach(tab => {
				if (tab.dataset.tab === tabName) {
					tab.classList.add('active');
				} else {
					tab.classList.remove('active');
				}
			});

			// Update tab content
			const tabContents = document.querySelectorAll('.tab-content');
			tabContents.forEach(content => {
				const contentId = content.id;
				if (
					(tabName === 'warnings' && contentId === 'warningsView') ||
					(tabName === 'segments' && contentId === 'segmentsView') ||
					(tabName === 'preview' && contentId === 'previewView') ||
					(tabName === 'suggestions' && contentId === 'suggestionsView') ||
					(tabName === 'history' && contentId === 'historyView') ||
					(tabName === 'compliance' && contentId === 'complianceView')
				) {
					content.classList.add('active');
				} else {
					content.classList.remove('active');
				}
			});

			// Update tab-specific content
			if (tabName === 'preview') {
				this.updatePreview();
			} else if (tabName === 'suggestions') {
				this.updateSuggestions();
			} else if (tabName === 'history') {
				this.updateInlineHistory();
			} else if (tabName === 'compliance') {
				this.updateComplianceChecklist();
			}
		},

		initMobileNav() {
		}
	};

	// ========== INITIALIZATION ==========
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			ui.init();
		});
	} else {
		ui.init();
	}

})();
