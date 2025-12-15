document.addEventListener('DOMContentLoaded', function() {
    const mapsInput = document.getElementById('mapsInput');
    const convertBtn = document.getElementById('convertBtn');
    const resultContainer = document.getElementById('result');
    const errorContainer = document.getElementById('error');
    const coordinatesEl = document.getElementById('coordinates');
    const wazeUrlEl = document.getElementById('wazeUrl');
    const errorMessageEl = errorContainer.querySelector('.error-message');

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

    function showResult(data) {
        const { latitude, longitude } = data.coordinates;
        coordinatesEl.textContent = `${latitude}, ${longitude}`;

        wazeUrlEl.href = data.wazeUrl;

        resultContainer.style.display = 'block';
        errorContainer.style.display = 'none';

        // Track conversion event in Google Analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'link_converted_web', {
                'event_category': 'conversion',
                'event_label': 'web_converter'
            });
        }
    }

    function showError(message) {
        errorMessageEl.textContent = message;
        errorContainer.style.display = 'block';
        resultContainer.style.display = 'none';

        // Track failed conversion event in Google Analytics
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
});
