document.addEventListener('DOMContentLoaded', function() {
    const mapsInput = document.getElementById('mapsInput');
    const convertBtn = document.getElementById('convertBtn');
    const resultContainer = document.getElementById('result');
    const errorContainer = document.getElementById('error');
    const coordinatesEl = document.getElementById('coordinates');
    const wazeUrlEl = document.getElementById('wazeUrl');
    const errorMessageEl = errorContainer.querySelector('.error-message');
    const resultTitleEl = document.getElementById('resultTitle');
    const singleResultEl = document.getElementById('singleResult');
    const routeResultEl = document.getElementById('routeResult');
    const routeStepsEl = document.getElementById('routeSteps');
    const routeFullLinkEl = document.getElementById('routeFullLink');
    const googleMapsUrlEl = document.getElementById('googleMapsUrl');
    const routeGoogleMapsUrlEl = document.getElementById('routeGoogleMapsUrl');
    const shareBtn = document.getElementById('shareBtn');
    const shareModal = document.getElementById('shareModal');
    const modalClose = document.getElementById('modalClose');
    const shareUrlInput = document.getElementById('shareUrl');
    const copyBtn = document.getElementById('copyBtn');
    const shareTelegramEl = document.getElementById('shareTelegram');
    const shareWhatsappEl = document.getElementById('shareWhatsapp');
    const shareViberEl = document.getElementById('shareViber');

    let lastResult = null;
    let focusBeforeModal = null;

    const shortUrlCache = new Map();
    const SHORTENER_ENDPOINT = 'https://s.gbitcode.com/api/shorten?source=gmaps_2_waze';
    const SHORTENER_TIMEOUT_MS = 7000;

    // --- URL safety ---

    function safeHref(url) {
        if (typeof url !== 'string') return '#';
        try {
            const parsed = new URL(url);
            return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? url : '#';
        } catch {
            return '#';
        }
    }

    // --- Encode / decode for shareable hash ---

    function encodeResult(data) {
        const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    function decodeResult(encoded) {
        try {
            const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
            const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
            return JSON.parse(decodeURIComponent(escape(atob(padded))));
        } catch {
            return null;
        }
    }

    // --- URL shortener ---

    function normalizeShortUrl(raw) {
        if (typeof raw !== 'string' || !raw) return null;
        return raw.startsWith('http') ? raw : `https://${raw}`;
    }

    async function fetchShortUrl(longUrl) {
        const controller = new AbortController();
        const timerId = setTimeout(() => controller.abort(), SHORTENER_TIMEOUT_MS);
        try {
            const res = await fetch(SHORTENER_ENDPOINT, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ url: longUrl }),
                signal: controller.signal
            });
            const json = await res.json();
            return normalizeShortUrl(json.short_url);
        } catch {
            return null;
        } finally {
            clearTimeout(timerId);
        }
    }

    // --- Modal share link helpers ---

    const channelEls = [shareTelegramEl, shareWhatsappEl, shareViberEl];

    function applyShareLinks(url) {
        const enc = encodeURIComponent(url);
        shareUrlInput.value = url;
        copyBtn.disabled = false;
        shareTelegramEl.href = `https://t.me/share/url?url=${enc}`;
        shareWhatsappEl.href = `https://wa.me/?text=${enc}`;
        shareViberEl.href = `viber://forward?text=${enc}`;
        channelEls.forEach(el => {
            el.removeAttribute('aria-disabled');
            el.style.opacity = '';
            el.style.pointerEvents = '';
        });
    }

    function setModalLoading(loading) {
        if (loading) {
            shareUrlInput.value = 'Shortening…';
            copyBtn.disabled = true;
            channelEls.forEach(el => {
                el.setAttribute('aria-disabled', 'true');
                el.style.opacity = '0.5';
                el.style.pointerEvents = 'none';
            });
        } else {
            copyBtn.disabled = false;
            channelEls.forEach(el => {
                el.removeAttribute('aria-disabled');
                el.style.opacity = '';
                el.style.pointerEvents = '';
            });
        }
    }

    // --- Modal ---

    function openModal() {
        focusBeforeModal = document.activeElement;
        shareModal.hidden = false;
        modalClose.focus();
        document.addEventListener('keydown', handleModalKeydown);
    }

    function closeModal() {
        shareModal.hidden = true;
        document.removeEventListener('keydown', handleModalKeydown);
        if (focusBeforeModal) focusBeforeModal.focus();
    }

    function handleModalKeydown(e) {
        if (e.key === 'Escape') {
            closeModal();
            return;
        }
        if (e.key !== 'Tab') return;
        const focusable = Array.from(shareModal.querySelectorAll('button, input, a[href]'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    shareModal.addEventListener('click', function(e) {
        if (e.target === shareModal) closeModal();
    });

    modalClose.addEventListener('click', closeModal);

    copyBtn.addEventListener('click', async function() {
        const url = shareUrlInput.value;
        try {
            await navigator.clipboard.writeText(url);
            showCopied();
        } catch {
            shareUrlInput.select();
            try {
                document.execCommand('copy');
                showCopied();
            } catch {
                // URL is visible — user can copy manually
            }
        }
    });

    function showCopied() {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 2000);
    }

    shareBtn.addEventListener('click', async function() {
        const encoded = encodeResult(lastResult);
        const longUrl = `${location.origin}${location.pathname}#r=${encoded}`;

        if (typeof gtag !== 'undefined') {
            gtag('event', 'result_shared', {
                'event_category': 'share',
                'event_label': 'web_converter'
            });
        }

        if (shortUrlCache.has(longUrl)) {
            applyShareLinks(shortUrlCache.get(longUrl));
            openModal();
            return;
        }

        setModalLoading(true);
        openModal();

        const shortUrl = await fetchShortUrl(longUrl);
        if (shortUrl) shortUrlCache.set(longUrl, shortUrl);
        applyShareLinks(shortUrl || longUrl);
        setModalLoading(false);
    });

    function trackChannelShare(channel) {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'result_shared_channel', {
                'event_category': 'share',
                'event_label': channel
            });
        }
    }

    shareTelegramEl.addEventListener('click', () => trackChannelShare('telegram'));
    shareWhatsappEl.addEventListener('click', () => trackChannelShare('whatsapp'));
    shareViberEl.addEventListener('click', () => trackChannelShare('viber'));

    // --- Conversion ---

    convertBtn.addEventListener('click', async function() {
        const mapsLink = mapsInput.value.trim();

        if (!mapsLink) {
            showError('Please enter a Google Maps link');
            return;
        }

        hideMessages();
        convertBtn.disabled = true;
        convertBtn.textContent = 'Converting...';

        try {
            const response = await fetch('https://faas-fra1-afec6ce7.doserverless.co/api/v1/web/fn-2147b526-aa08-4de1-a083-670d2a13332a/default/gmap2waze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: {
                        chat: {
                            id: -1
                        },
                        text: mapsLink
                    }
                })
            });

            const data = await response.json();

            if (data.ok && data.coordinates && data.wazeUrl) {
                showResult(data);
            } else {
                showError('Failed to convert the link. Please check if the URL is valid.');
            }
        } catch (error) {
            showError('An error occurred while converting the link. Please try again.');
            console.error('Error:', error);
        } finally {
            convertBtn.disabled = false;
            convertBtn.textContent = 'Convert';
        }
    });

    mapsInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            convertBtn.click();
        }
    });

    // --- Rendering ---

    function isRouteData(data) {
        return (data.format === 'route' || data.url_type === 'combo_route') &&
            Array.isArray(data.waypoints) && data.waypoints.length > 1;
    }

    function showResult(data) {
        lastResult = data;

        if (isRouteData(data)) {
            renderRoute(data);
        } else {
            renderSingle(data);
        }

        resultContainer.style.display = 'block';
        errorContainer.style.display = 'none';

        if (typeof gtag !== 'undefined') {
            gtag('event', 'link_converted_web', {
                'event_category': 'conversion',
                'event_label': 'web_converter'
            });
        }
    }

    function renderSingle(data) {
        const { latitude, longitude } = data.coordinates;
        coordinatesEl.textContent = `${latitude}, ${longitude}`;
        wazeUrlEl.href = safeHref(data.wazeUrl);
        googleMapsUrlEl.href = safeHref(data.googleMapsUrl);

        resultTitleEl.textContent = 'Your link!';
        routeStepsEl.innerHTML = '';
        singleResultEl.style.display = 'block';
        routeResultEl.style.display = 'none';
    }

    function renderRoute(data) {
        const { waypoints, wazeUrl2 } = data;
        const count = waypoints.length;

        resultTitleEl.textContent = `Route (${count} stops)`;

        routeStepsEl.innerHTML = '';

        waypoints.forEach((wp, i) => {
            if (!wp || typeof wp.latitude !== 'number' || !isFinite(wp.latitude) ||
                    typeof wp.longitude !== 'number' || !isFinite(wp.longitude)) return;

            let label;
            if (i === 0) {
                label = 'Start';
            } else if (i === count - 1) {
                label = 'Destination';
            } else {
                label = `Step ${i}`;
            }

            const lat = wp.latitude.toFixed(6);
            const lng = wp.longitude.toFixed(6);

            const li = document.createElement('li');
            li.className = 'route-step';

            const labelEl = document.createElement('span');
            labelEl.className = 'route-step-label';
            labelEl.textContent = label;

            const coordEl = document.createElement('span');
            coordEl.className = 'route-step-coords';
            coordEl.textContent = `${lat}, ${lng}`;

            const linkEl = document.createElement('a');
            linkEl.href = safeHref(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
            linkEl.target = '_blank';
            linkEl.rel = 'noopener';
            linkEl.className = 'waze-link route-step-link';
            linkEl.textContent = 'Open in Waze';

            li.appendChild(labelEl);
            li.appendChild(coordEl);
            li.appendChild(linkEl);
            routeStepsEl.appendChild(li);
        });

        routeFullLinkEl.href = safeHref(wazeUrl2);
        routeGoogleMapsUrlEl.href = safeHref(data.googleMapsUrl);

        singleResultEl.style.display = 'none';
        routeResultEl.style.display = 'block';
    }

    function showError(message) {
        errorMessageEl.textContent = message;
        errorContainer.style.display = 'block';
        resultContainer.style.display = 'none';

        if (typeof gtag !== 'undefined') {
            gtag('event', 'web_conversion_failed', {
                'event_category': 'conversion',
                'event_label': 'web_converter_error'
            });
        }
    }

    function hideMessages() {
        resultContainer.style.display = 'none';
        errorContainer.style.display = 'none';
    }

    // --- Hash-based shared result (runs on page load) ---

    const hash = location.hash;
    if (hash.startsWith('#r=')) {
        const data = decodeResult(hash.slice(3));
        if (data === null) {
            // malformed base64/JSON — silently ignore, show converter form
        } else if (data.ok && data.coordinates && data.wazeUrl) {
            showResult(data);
        } else {
            showError('This share link appears to be invalid or incomplete.');
        }
    }
});
