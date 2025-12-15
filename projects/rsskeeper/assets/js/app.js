(function() {
    'use strict';

    // State
    const state = {
        feeds: [],
        currentFeedId: null,
        articles: {},
        unreadCounts: {},
        loadingFeeds: new Set()
    };

    // DOM Elements
    const addFeedBtn = document.getElementById('addFeedBtn');
    const addFeedModal = document.getElementById('addFeedModal');
    const closeAddModal = document.getElementById('closeAddModal');
    const addFeedForm = document.getElementById('addFeedForm');
    const cancelAddBtn = document.getElementById('cancelAddBtn');
    const feedsList = document.getElementById('feedsList');
    const articlesContainer = document.getElementById('articlesContainer');
    const articlesTitle = document.getElementById('articlesTitle');
    const refreshBtn = document.getElementById('refreshBtn');
    const importBtn = document.getElementById('importBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importModal = document.getElementById('importModal');
    const closeImportModal = document.getElementById('closeImportModal');
    const importTextarea = document.getElementById('importTextarea');
    const importFile = document.getElementById('importFile');
    const browseFileBtn = document.getElementById('browseFileBtn');
    const cancelImportBtn = document.getElementById('cancelImportBtn');
    const importSubmitBtn = document.getElementById('importSubmitBtn');
    const exportLink = document.getElementById('exportLink');

    // Initialize
    function init() {
        const isFirstLoad = loadFeeds();
        setupEventListeners();
        renderFeeds();
        
        if (state.feeds.length > 0) {
            if (!state.currentFeedId) {
                selectFeed(state.feeds[0].id);
            }
            
            if (isFirstLoad) {
                const firstFeed = state.feeds[0];
                const otherFeeds = state.feeds.slice(1);
                
                setTimeout(() => {
                    refreshFeed(firstFeed.id, true).catch(err => {
                        console.error(`Failed to load feed ${firstFeed.name}:`, err);
                    });
                }, 100);
                
                if (otherFeeds.length > 0) {
                    setTimeout(() => {
                        Promise.all(
                            otherFeeds.map(feed => refreshFeed(feed.id, true).catch(err => {
                                console.error(`Failed to load feed ${feed.name}:`, err);
                            }))
                        );
                    }, 500);
                }
            }
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        addFeedBtn.addEventListener('click', () => {
            addFeedModal.style.display = 'flex';
            document.getElementById('feedUrl').focus();
        });

        closeAddModal.addEventListener('click', () => {
            addFeedModal.style.display = 'none';
            addFeedForm.reset();
        });

        cancelAddBtn.addEventListener('click', () => {
            addFeedModal.style.display = 'none';
            addFeedForm.reset();
        });

        addFeedForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const urlInput = document.getElementById('feedUrl');
            const nameInput = document.getElementById('feedName');
            const url = urlInput.value.trim();
            const name = nameInput.value.trim();
            
            if (!url) {
                alert('Please enter a feed URL');
                urlInput.focus();
                return;
            }

            try {
                await addFeed(url, name);
                addFeedModal.style.display = 'none';
                addFeedForm.reset();
            } catch (error) {
                console.error('Form submission error:', error);
                // Error is already handled in addFeed function
            }
        });

        refreshBtn.addEventListener('click', async () => {
            if (state.currentFeedId) {
                await refreshFeed(state.currentFeedId);
            }
        });

        importBtn.addEventListener('click', () => {
            importModal.style.display = 'flex';
            importTextarea.value = '';
        });

        closeImportModal.addEventListener('click', () => {
            importModal.style.display = 'none';
        });

        cancelImportBtn.addEventListener('click', () => {
            importModal.style.display = 'none';
        });

        browseFileBtn.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const text = await file.text();
                importTextarea.value = text;
            }
        });

        importSubmitBtn.addEventListener('click', async () => {
            const opmlContent = importTextarea.value.trim();
            if (opmlContent) {
                await importFeeds(opmlContent);
                importModal.style.display = 'none';
                importTextarea.value = '';
            }
        });

        exportBtn.addEventListener('click', () => {
            exportFeeds();
        });

        // Close modals on background click
        addFeedModal.addEventListener('click', (e) => {
            if (e.target === addFeedModal) {
                addFeedModal.style.display = 'none';
            }
        });

        importModal.addEventListener('click', (e) => {
            if (e.target === importModal) {
                importModal.style.display = 'none';
            }
        });
    }

    // Load feeds from localStorage
    function loadFeeds() {
        const saved = localStorage.getItem('rssreader_feeds');
        let isFirstLoad = false;
        if (saved) {
            try {
                state.feeds = JSON.parse(saved);
                // Load articles cache
                const savedArticles = localStorage.getItem('rssreader_articles');
                if (savedArticles) {
                    state.articles = JSON.parse(savedArticles);
                }
                // Load unread counts
                const savedUnread = localStorage.getItem('rssreader_unread');
                if (savedUnread) {
                    state.unreadCounts = JSON.parse(savedUnread);
                }
            } catch (e) {
                console.error('Failed to load feeds:', e);
            }
        } else {
            const defaultFeeds = [
                { id: '1', url: 'https://hnrss.org/frontpage', name: 'Hacker News' },
                { id: '2', url: 'https://www.brainpickings.org/feed/', name: 'Brain Pickings' }
            ];
            state.feeds = defaultFeeds;
            saveFeeds();
            isFirstLoad = true;
        }
        return isFirstLoad;
    }

    // Save feeds to localStorage
    function saveFeeds() {
        localStorage.setItem('rssreader_feeds', JSON.stringify(state.feeds));
        localStorage.setItem('rssreader_articles', JSON.stringify(state.articles));
        localStorage.setItem('rssreader_unread', JSON.stringify(state.unreadCounts));
    }

    // Add feed
    async function addFeed(url, customName = '') {
        try {
            // Check if feed already exists
            if (state.feeds.some(feed => feed.url === url)) {
                alert('This feed is already added.');
                return;
            }

            // Show loading state
            const submitBtn = addFeedForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';

            try {
                const feedData = await fetchFeed(url);
                if (!feedData) {
                    alert('Failed to fetch feed. Please check the URL.');
                    return;
                }

                const feed = {
                    id: Date.now().toString(),
                    url: url,
                    name: customName || feedData.title || 'Untitled Feed',
                    title: feedData.title || 'Untitled Feed',
                    description: feedData.description || '',
                    link: feedData.link || url,
                    addedAt: new Date().toISOString()
                };

                state.feeds.push(feed);
                state.articles[feed.id] = feedData.items || [];
                state.unreadCounts[feed.id] = feedData.items?.length || 0;

                saveFeeds();
                renderFeeds();
                
                // Auto-select the new feed
                selectFeed(feed.id);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        } catch (error) {
            console.error('Error adding feed:', error);
            alert('Failed to add feed: ' + (error.message || 'Please check the URL and try again.'));
        }
    }

    // Fetch with timeout
    async function fetchWithTimeout(url, timeout = 5000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                mode: 'cors',
                headers: {
                    'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml'
                }
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    // Fetch feed from URL
    async function fetchFeed(url) {
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
            `https://corsproxy.io/?${encodeURIComponent(url)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
        ];
        
        try {
            let response;
            let lastError;
            
            try {
                response = await fetchWithTimeout(url, 4000);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (directError) {
                lastError = directError;
                let proxySuccess = false;
                
                for (const proxyUrl of proxies) {
                    try {
                        const proxyResponse = await fetchWithTimeout(proxyUrl, 4000);
                        if (proxyResponse.ok) {
                            response = proxyResponse;
                            proxySuccess = true;
                            break;
                        }
                        lastError = new Error(`Proxy returned HTTP ${proxyResponse.status}`);
                    } catch (proxyError) {
                        lastError = proxyError;
                        continue;
                    }
                }
                
                if (!proxySuccess) {
                    throw lastError;
                }
            }

            let text = await response.text();
            if (!text || text.trim().length === 0) {
                throw new Error('Empty response from feed');
            }

            try {
                const jsonData = JSON.parse(text);
                if (jsonData.contents) {
                    text = jsonData.contents;
                }
            } catch (e) {
            }

            const parsed = parseRSS(text);
            if (!parsed) {
                throw new Error('Failed to parse feed XML');
            }

            return parsed;
        } catch (error) {
            console.error('Error fetching feed:', error);
            throw new Error(error.message || 'Failed to fetch feed');
        }
    }

    // Parse RSS/Atom XML
    function parseRSS(xmlText) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, 'text/xml');
        
        // Check for parse errors
        const parseError = xml.querySelector('parsererror');
        if (parseError) {
            throw new Error('Invalid XML format');
        }

        // Determine feed type (RSS or Atom)
        const isAtom = xml.querySelector('feed') !== null;
        
        if (isAtom) {
            return parseAtom(xml);
        } else {
            return parseRSSFeed(xml);
        }
    }

    // Parse RSS feed
    function parseRSSFeed(xml) {
        const channel = xml.querySelector('channel');
        if (!channel) return null;

        const title = channel.querySelector('title')?.textContent || '';
        const description = channel.querySelector('description')?.textContent || '';
        const link = channel.querySelector('link')?.textContent || '';

        const items = Array.from(channel.querySelectorAll('item')).map(item => {
            const itemTitle = item.querySelector('title')?.textContent || 'Untitled';
            const itemDescription = item.querySelector('description')?.textContent || '';
            const itemLink = item.querySelector('link')?.textContent || '';
            const pubDate = item.querySelector('pubDate')?.textContent || '';
            const guid = item.querySelector('guid')?.textContent || itemLink || itemTitle;

            return {
                id: guid,
                title: itemTitle,
                description: itemDescription,
                link: itemLink,
                pubDate: pubDate,
                read: false
            };
        });

        return {
            title,
            description,
            link,
            items
        };
    }

    // Parse Atom feed
    function parseAtom(xml) {
        const feed = xml.querySelector('feed');
        if (!feed) return null;

        const title = feed.querySelector('title')?.textContent || '';
        const subtitle = feed.querySelector('subtitle')?.textContent || '';
        const link = feed.querySelector('link[rel="alternate"]')?.getAttribute('href') || 
                    feed.querySelector('link')?.getAttribute('href') || '';

        const entries = Array.from(feed.querySelectorAll('entry')).map(entry => {
            const entryTitle = entry.querySelector('title')?.textContent || 'Untitled';
            const entrySummary = entry.querySelector('summary')?.textContent || 
                               entry.querySelector('content')?.textContent || '';
            const entryLink = entry.querySelector('link[rel="alternate"]')?.getAttribute('href') ||
                            entry.querySelector('link')?.getAttribute('href') || '';
            const updated = entry.querySelector('updated')?.textContent || '';
            const id = entry.querySelector('id')?.textContent || entryLink || entryTitle;

            return {
                id,
                title: entryTitle,
                description: entrySummary,
                link: entryLink,
                pubDate: updated,
                read: false
            };
        });

        return {
            title,
            description: subtitle,
            link,
            items: entries
        };
    }

    // Refresh feed
    async function refreshFeed(feedId, silent = false) {
        const feed = state.feeds.find(f => f.id === feedId);
        if (!feed) return;

        state.loadingFeeds.add(feedId);
        renderFeeds();

        if (!silent && refreshBtn) {
            refreshBtn.classList.add('loading');
            refreshBtn.disabled = true;
        }

        try {
            const feedData = await fetchFeed(feed.url);
            if (feedData) {
                // Update feed info
                feed.title = feedData.title || feed.title;
                feed.description = feedData.description || feed.description;
                feed.link = feedData.link || feed.link;

                // Merge new articles with existing ones
                const existingArticles = state.articles[feedId] || [];
                const existingIds = new Set(existingArticles.map(a => a.id));
                
                const newArticles = (feedData.items || []).filter(item => !existingIds.has(item.id));
                const allArticles = [...newArticles, ...existingArticles].sort((a, b) => {
                    const dateA = new Date(a.pubDate || 0);
                    const dateB = new Date(b.pubDate || 0);
                    return dateB - dateA;
                });

                state.articles[feedId] = allArticles;
                
                // Update unread count
                const unread = allArticles.filter(a => !a.read).length;
                state.unreadCounts[feedId] = unread;

                saveFeeds();
                renderFeeds();
                
                if (state.currentFeedId === feedId) {
                    renderArticles(feedId);
                }
            }
        } catch (error) {
            console.error('Error refreshing feed:', error);
            if (!silent) {
                alert('Failed to refresh feed: ' + (error.message || 'Please try again.'));
            }
        } finally {
            state.loadingFeeds.delete(feedId);
            renderFeeds();
            if (state.currentFeedId === feedId) {
                renderArticles(feedId);
            }
            if (!silent && refreshBtn) {
                refreshBtn.classList.remove('loading');
                refreshBtn.disabled = false;
            }
        }
    }

    // Select feed
    function selectFeed(feedId) {
        state.currentFeedId = feedId;
        renderFeeds();
        renderArticles(feedId);
        refreshBtn.style.display = 'flex';
    }

    // Render feeds list
    function renderFeeds() {
        feedsList.innerHTML = '';

        if (state.feeds.length === 0) {
            feedsList.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--text-secondary);">
                    <p>No feeds yet. Click + to add one.</p>
                </div>
            `;
            return;
        }

        state.feeds.forEach(feed => {
            const feedItem = document.createElement('div');
            const isLoading = state.loadingFeeds.has(feed.id);
            feedItem.className = `feed-item ${state.currentFeedId === feed.id ? 'active' : ''} ${isLoading ? 'loading' : ''}`;
            
            const unreadCount = state.unreadCounts[feed.id] || 0;
            
            feedItem.innerHTML = `
                <div class="feed-info">
                    <div class="feed-name">${escapeHtml(feed.name)}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    ${isLoading ? '<div class="feed-loading-spinner"></div>' : ''}
                    ${unreadCount > 0 ? `<span class="feed-unread">${unreadCount}</span>` : ''}
                    <div class="feed-actions">
                        <button class="feed-action-btn" data-action="refresh" title="Refresh" ${isLoading ? 'disabled' : ''}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                            </svg>
                        </button>
                        <button class="feed-action-btn" data-action="delete" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;

            feedItem.addEventListener('click', (e) => {
                if (!e.target.closest('.feed-actions')) {
                    selectFeed(feed.id);
                }
            });

            // Handle feed actions
            feedItem.querySelector('[data-action="refresh"]').addEventListener('click', async (e) => {
                e.stopPropagation();
                await refreshFeed(feed.id);
            });

            feedItem.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete "${feed.name}"?`)) {
                    deleteFeed(feed.id);
                }
            });

            feedsList.appendChild(feedItem);
        });
    }

    // Delete feed
    function deleteFeed(feedId) {
        state.feeds = state.feeds.filter(f => f.id !== feedId);
        delete state.articles[feedId];
        delete state.unreadCounts[feedId];
        
        if (state.currentFeedId === feedId) {
            state.currentFeedId = null;
            renderArticles(null);
            refreshBtn.style.display = 'none';
        }
        
        saveFeeds();
        renderFeeds();
    }

    // Render articles
    function renderArticles(feedId) {
        // Add fade transition
        articlesContainer.style.opacity = '0';
        
        setTimeout(() => {
            if (!feedId) {
                articlesTitle.textContent = 'Select a feed';
                articlesContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📰</div>
                        <div class="empty-title">No feed selected</div>
                        <div class="empty-message">Add a feed or select one from the sidebar to get started</div>
                    </div>
                `;
                articlesContainer.style.opacity = '1';
                return;
            }

            const feed = state.feeds.find(f => f.id === feedId);
            if (!feed) {
                articlesContainer.style.opacity = '1';
                return;
            }

            articlesTitle.textContent = feed.name;
            const articles = state.articles[feedId] || [];
            
            if (articles.length === 0) {
                articlesContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📰</div>
                        <div class="empty-title">No articles</div>
                        <div class="empty-message">Click refresh to fetch articles</div>
                    </div>
                `;
                articlesContainer.style.opacity = '1';
                return;
            }

            articlesContainer.innerHTML = articles.map(article => {
                const isUnread = !article.read;
                const date = article.pubDate ? formatDate(article.pubDate) : '';
                
                return `
                    <div class="article-item ${isUnread ? 'unread' : ''}" data-article-id="${escapeHtml(article.id)}">
                        <div class="article-header">
                            <h3 class="article-title">${escapeHtml(article.title)}</h3>
                            ${date ? `<div class="article-date">${escapeHtml(date)}</div>` : ''}
                        </div>
                        ${article.description ? `<div class="article-description">${escapeHtml(stripHtml(article.description))}</div>` : ''}
                        <div class="article-footer">
                            <a href="${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer" class="article-link">
                                Read more
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                </svg>
                            </a>
                            <div class="article-actions">
                                ${isUnread ? `<button class="article-action-btn mark-read-btn">Mark as read</button>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Add event listeners
            articlesContainer.querySelectorAll('.mark-read-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const articleItem = e.target.closest('.article-item');
                    const articleId = articleItem.dataset.articleId;
                    markAsRead(feedId, articleId);
                });
            });

            articlesContainer.querySelectorAll('.article-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (!e.target.closest('.article-actions') && !e.target.closest('.article-link')) {
                        const link = item.querySelector('.article-link');
                        if (link) {
                            window.open(link.href, '_blank', 'noopener,noreferrer');
                            markAsRead(feedId, item.dataset.articleId);
                        }
                    }
                });
            });

            // Fade in articles
            articlesContainer.style.opacity = '1';
        }, 150);
    }

    // Mark article as read
    function markAsRead(feedId, articleId) {
        const articles = state.articles[feedId] || [];
        const article = articles.find(a => a.id === articleId);
        if (article && !article.read) {
            article.read = true;
            state.unreadCounts[feedId] = (state.unreadCounts[feedId] || 0) - 1;
            saveFeeds();
            renderFeeds();
            renderArticles(feedId);
        }
    }

    // Format date
    function formatDate(dateString) {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diff = now - date;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));

            if (days === 0) return 'Today';
            if (days === 1) return 'Yesterday';
            if (days < 7) return `${days} days ago`;
            if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
            if (days < 365) return `${Math.floor(days / 30)} months ago`;
            return date.toLocaleDateString();
        } catch (e) {
            return dateString;
        }
    }

    // Strip HTML tags
    function stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    // Import feeds from OPML
    async function importFeeds(opmlContent) {
        try {
            const parser = new DOMParser();
            const xml = parser.parseFromString(opmlContent, 'text/xml');
            
            const outlines = xml.querySelectorAll('outline[type="rss"], outline[xmlUrl]');
            let imported = 0;
            let errors = 0;

            for (const outline of outlines) {
                const url = outline.getAttribute('xmlUrl') || outline.getAttribute('url');
                const name = outline.getAttribute('title') || outline.getAttribute('text') || '';
                
                if (url && !state.feeds.some(f => f.url === url)) {
                    try {
                        await addFeed(url, name);
                        imported++;
                    } catch (e) {
                        console.error('Error importing feed:', e);
                        errors++;
                    }
                }
            }

            if (imported > 0) {
                alert(`Successfully imported ${imported} feed${imported > 1 ? 's' : ''}${errors > 0 ? ` (${errors} failed)` : ''}.`);
            } else {
                alert('No new feeds found to import.');
            }
        } catch (error) {
            console.error('Error importing feeds:', error);
            alert('Failed to import feeds. Please check the OPML format.');
        }
    }

    // Export feeds to OPML
    function exportFeeds() {
        const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
    <head>
        <title>rssKeeper Export</title>
        <dateCreated>${new Date().toUTCString()}</dateCreated>
    </head>
    <body>
${state.feeds.map(feed => `        <outline type="rss" text="${escapeXml(feed.name)}" title="${escapeXml(feed.name)}" xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.link)}"/>`).join('\n')}
    </body>
</opml>`;

        const blob = new Blob([opml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        exportLink.href = url;
        exportLink.download = `rss-feeds-${new Date().toISOString().split('T')[0]}.opml`;
        exportLink.click();
        URL.revokeObjectURL(url);
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Escape XML
    function escapeXml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // Initialize
    init();
})();

