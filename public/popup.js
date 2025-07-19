// Popup script for Auto Volume Adjuster extension

// Default settings
const DEFAULT_SETTINGS = {
    enabled: true,
    minVolume: 20,
    maxVolume: 80
};

// DOM elements
const enableToggle = document.getElementById('enableToggle');
const minVolumeSlider = document.getElementById('minVolume');
const maxVolumeSlider = document.getElementById('maxVolume');
const minValueDisplay = document.getElementById('minValue');
const maxValueDisplay = document.getElementById('maxValue');
const statusDiv = document.getElementById('status');
const volumeFill = document.getElementById('volumeFill');
const volumeText = document.getElementById('volumeText');
const currentVolumeDiv = document.getElementById('currentVolume');
const systemTip = document.getElementById('systemTip');
const volumeNote = document.getElementById('volumeNote');
const tabsInfo = document.getElementById('tabsInfo');
const tabsList = document.getElementById('tabsList');

// Load settings from background script
async function loadSettings() {
    try {
        const result = await sendMessageToBackground({ type: 'GET_SETTINGS' });
        return result || DEFAULT_SETTINGS;
    } catch (error) {
        console.error('Error loading settings:', error);
        return DEFAULT_SETTINGS;
    }
}

// Save settings via background script
async function saveSettings(settings) {
    try {
        await sendMessageToBackground({ 
            type: 'SETTINGS_UPDATED', 
            settings 
        });
        console.log('Settings saved:', settings);
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// Update UI with current settings
function updateUI(settings) {
    enableToggle.classList.toggle('active', settings.enabled);
    minVolumeSlider.value = settings.minVolume;
    maxVolumeSlider.value = settings.maxVolume;
    minValueDisplay.textContent = `${settings.minVolume}%`;
    maxValueDisplay.textContent = `${settings.maxVolume}%`;
    
    statusDiv.textContent = settings.enabled 
        ? 'Auto volume adjustment is active' 
        : 'Auto volume adjustment is disabled';
    statusDiv.classList.toggle('disabled', !settings.enabled);
}

// Send message to background script
async function sendMessageToBackground(message) {
    try {
        const response = await chrome.runtime.sendMessage(message);
        return response;
    } catch (error) {
        console.error('Error sending message to background script:', error);
        return null;
    }
}

// Request current volume from content script
async function requestCurrentVolume() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { 
            type: 'GET_CURRENT_VOLUME' 
        });
        
        if (response && typeof response.volume === 'number') {
            updateVolumeDisplay(response.volume, response.hasMedia);
        } else {
            updateVolumeDisplay(0, false);
        }
    } catch (error) {
        console.error('Error requesting current volume:', error);
        updateVolumeDisplay(0, false);
    }
}

// Update the volume display
function updateVolumeDisplay(volume, hasMedia = true) {
    if (!volumeFill || !volumeText) return;
    
    if (!hasMedia) {
        volumeFill.style.width = '0%';
        volumeText.textContent = 'No media';
        volumeText.className = 'volume-text no-media';
        if (systemTip) systemTip.style.display = 'none';
        if (volumeNote) volumeNote.textContent = 'Note: No audio/video detected on this page.';
    } else {
        const percentage = Math.round(volume * 100);
        volumeFill.style.width = `${percentage}%`;
        volumeText.textContent = `${percentage}%`;
        volumeText.className = 'volume-text';
        
        // Update note based on current site
        if (volumeNote) {
            const hostname = window.location?.hostname || '';
            if (hostname.includes('soundcloud.com')) {
                volumeNote.textContent = 'Note: SoundCloud detected - Web Audio monitoring active.';
            } else if (hostname.includes('spotify.com')) {
                volumeNote.textContent = 'Note: Spotify detected - monitoring both HTML5 and Web Audio.';
            } else {
                volumeNote.textContent = 'Note: This shows web page volume only. Check your system volume if audio is still too quiet.';
            }
        }
        
        // Color code the volume bar based on current settings
        const settings = {
            minVolume: parseInt(minVolumeSlider?.value || 20),
            maxVolume: parseInt(maxVolumeSlider?.value || 80)
        };
        
        let barColor = '#4CAF50'; // Green for normal
        if (percentage < settings.minVolume) {
            barColor = '#2196F3'; // Blue for boosted
        } else if (percentage > settings.maxVolume) {
            barColor = '#FF9800'; // Orange for reduced
        }
        
        volumeFill.style.background = barColor;
        
        // Show system volume tip if volume is at 100% but might still be too quiet
        if (systemTip) {
            if (percentage >= 95 && settings.minVolume > 80) {
                systemTip.style.display = 'block';
                systemTip.innerHTML = '<strong>💡 Tip:</strong> Volume is at maximum (100%). If still too quiet, increase your system volume or check the browser\'s volume in your system\'s volume mixer.';
            } else if (percentage >= 100) {
                systemTip.style.display = 'block';
                systemTip.innerHTML = '<strong>🔊 Note:</strong> Web page volume is at maximum. For louder audio, increase your system volume.';
            } else {
                systemTip.style.display = 'none';
            }
        }
    }
}

// Update tabs display
async function updateTabsDisplay() {
    if (!tabsList || !tabsInfo) return;
    
    try {
        const tabData = await sendMessageToBackground({ type: 'GET_ALL_TAB_VOLUMES' });
        
        if (tabData && tabData.length > 0) {
            tabsInfo.style.display = 'block';
            tabsList.innerHTML = '';
            
            tabData.forEach(tab => {
                const tabItem = document.createElement('div');
                tabItem.className = 'tab-item';
                
                const title = tab.title || 'Unknown Tab';
                const shortTitle = title.length > 30 ? title.substring(0, 30) + '...' : title;
                
                tabItem.innerHTML = `
                    <span class="tab-title" title="${title}">${shortTitle}</span>
                    <span class="tab-volume">${tab.volume}%</span>
                `;
                
                tabsList.appendChild(tabItem);
            });
        } else {
            tabsInfo.style.display = 'none';
        }
    } catch (error) {
        console.error('Error updating tabs display:', error);
        tabsInfo.style.display = 'none';
    }
}

// Initialize popup
async function init() {
    const settings = await loadSettings();
    updateUI(settings);
    
    // Request current volume
    await requestCurrentVolume();
    await updateTabsDisplay();
    
    // Update volume display more frequently for real-time feedback
    setInterval(async () => {
        await requestCurrentVolume();
        await updateTabsDisplay();
    }, 1000); // Check every 1 second
    
    // Enable/disable toggle
    enableToggle.addEventListener('click', async () => {
        settings.enabled = !settings.enabled;
        await saveSettings(settings);
        updateUI(settings);
    });
    
    // Min volume slider
    minVolumeSlider.addEventListener('input', async (e) => {
        const value = parseInt(e.target.value);
        
        // Ensure min is less than max
        if (value >= settings.maxVolume) {
            settings.maxVolume = Math.min(100, value + 10);
            maxVolumeSlider.value = settings.maxVolume;
        }
        
        settings.minVolume = value;
        await saveSettings(settings);
        updateUI(settings);
    });
    
    // Max volume slider
    maxVolumeSlider.addEventListener('input', async (e) => {
        const value = parseInt(e.target.value);
        
        // Ensure max is greater than min
        if (value <= settings.minVolume) {
            settings.minVolume = Math.max(0, value - 10);
            minVolumeSlider.value = settings.minVolume;
        }
        
        settings.maxVolume = value;
        await saveSettings(settings);
        updateUI(settings);
    });
}

// Start the popup
init();
