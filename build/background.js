// Background script for Auto Volume Adjuster
// Monitors and adjusts volume across all tabs

let settings = {
    enabled: true,
    minVolume: 20,
    maxVolume: 80
};

let monitoringInterval = null;
let tabVolumeData = new Map(); // Store volume data for each tab

// Load settings from storage
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get({
            enabled: true,
            minVolume: 20,
            maxVolume: 80
        });
        settings = result;
        console.log('Auto Volume Background: Settings loaded', settings);
        return settings;
    } catch (error) {
        console.error('Auto Volume Background: Error loading settings', error);
        return settings;
    }
}

// Save settings to storage
async function saveSettings(newSettings) {
    try {
        await chrome.storage.sync.set(newSettings);
        settings = { ...settings, ...newSettings };
        console.log('Auto Volume Background: Settings saved', settings);
    } catch (error) {
        console.error('Auto Volume Background: Error saving settings', error);
    }
}

// Get all active tabs
async function getAllTabs() {
    try {
        return await chrome.tabs.query({});
    } catch (error) {
        console.error('Auto Volume Background: Error getting tabs', error);
        return [];
    }
}

// Send message to a specific tab
async function sendMessageToTab(tabId, message) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, message);
        return response;
    } catch (error) {
        // Tab might not have content script loaded or might be a special page
        return null;
    }
}

// Monitor volume across all tabs
async function monitorAllTabs() {
    if (!settings.enabled) return;
    
    const tabs = await getAllTabs();
    const activeTabPromises = tabs.map(async (tab) => {
        if (!tab.id || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            return;
        }
        
        try {
            // Get current volume from tab
            const volumeInfo = await sendMessageToTab(tab.id, {
                type: 'GET_CURRENT_VOLUME'
            });
            
            if (volumeInfo && volumeInfo.hasMedia) {
                const currentPercent = Math.round(volumeInfo.volume * 100);
                
                // Store volume data for this tab
                tabVolumeData.set(tab.id, {
                    url: tab.url,
                    title: tab.title,
                    volume: currentPercent,
                    hasMedia: volumeInfo.hasMedia,
                    lastUpdate: Date.now()
                });
                
                // Check if adjustment is needed
                let adjustmentNeeded = false;
                let targetVolume = currentPercent;
                let adjustmentType = '';
                
                if (currentPercent < settings.minVolume) {
                    targetVolume = settings.minVolume;
                    adjustmentNeeded = true;
                    adjustmentType = 'boost';
                } else if (currentPercent > settings.maxVolume) {
                    targetVolume = settings.maxVolume;
                    adjustmentNeeded = true;
                    adjustmentType = 'reduce';
                }
                
                if (adjustmentNeeded) {
                    // Send adjustment command to content script
                    await sendMessageToTab(tab.id, {
                        type: 'ADJUST_VOLUME',
                        targetVolume: targetVolume,
                        adjustmentType: adjustmentType
                    });
                    
                    console.log(`Auto Volume Background: ${adjustmentType === 'boost' ? 'Boosted' : 'Reduced'} volume in tab "${tab.title}" from ${currentPercent}% to ${targetVolume}%`);
                }
            }
        } catch (error) {
            // Remove tab data if tab is no longer accessible
            tabVolumeData.delete(tab.id);
        }
    });
    
    await Promise.allSettled(activeTabPromises);
    
    // Clean up old tab data (tabs that were closed)
    const currentTabIds = new Set(tabs.map(tab => tab.id));
    for (const [tabId] of tabVolumeData) {
        if (!currentTabIds.has(tabId)) {
            tabVolumeData.delete(tabId);
        }
    }
}

// Start monitoring all tabs
function startGlobalMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }
    
    if (settings.enabled) {
        console.log('Auto Volume Background: Starting global monitoring');
        monitoringInterval = setInterval(monitorAllTabs, 1000); // Check every 1 second
        
        // Also monitor immediately
        monitorAllTabs();
    }
}

// Stop monitoring
function stopGlobalMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        console.log('Auto Volume Background: Stopped global monitoring');
    }
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'SETTINGS_UPDATED':
            settings = { ...settings, ...message.settings };
            console.log('Auto Volume Background: Settings updated', settings);
            
            if (settings.enabled) {
                startGlobalMonitoring();
            } else {
                stopGlobalMonitoring();
            }
            
            sendResponse({ success: true });
            break;
            
        case 'GET_SETTINGS':
            sendResponse(settings);
            break;
            
        case 'GET_ALL_TAB_VOLUMES':
            const tabData = Array.from(tabVolumeData.entries()).map(([tabId, data]) => ({
                tabId,
                ...data
            }));
            sendResponse(tabData);
            break;
            
        case 'ENABLE_EXTENSION':
            settings.enabled = true;
            saveSettings({ enabled: true });
            startGlobalMonitoring();
            sendResponse({ success: true });
            break;
            
        case 'DISABLE_EXTENSION':
            settings.enabled = false;
            saveSettings({ enabled: false });
            stopGlobalMonitoring();
            sendResponse({ success: true });
            break;
            
        case 'UPDATE_MIN_VOLUME':
            settings.minVolume = message.value;
            saveSettings({ minVolume: message.value });
            sendResponse({ success: true });
            break;
            
        case 'UPDATE_MAX_VOLUME':
            settings.maxVolume = message.value;
            saveSettings({ maxVolume: message.value });
            sendResponse({ success: true });
            break;
            
        default:
            sendResponse({ success: false, error: 'Unknown message type' });
    }
    
    return true; // Will respond asynchronously
});

// Handle tab events
chrome.tabs.onCreated.addListener((tab) => {
    console.log('Auto Volume Background: New tab created', tab.id);
});

chrome.tabs.onRemoved.addListener((tabId) => {
    tabVolumeData.delete(tabId);
    console.log('Auto Volume Background: Tab removed', tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && settings.enabled) {
        // When a tab finishes loading, start monitoring it
        setTimeout(() => {
            monitorAllTabs();
        }, 1000); // Give content script time to load
    }
});

// Handle extension startup/install
chrome.runtime.onStartup.addListener(async () => {
    console.log('Auto Volume Background: Extension startup');
    await loadSettings();
    if (settings.enabled) {
        startGlobalMonitoring();
    }
});

chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Auto Volume Background: Extension installed/updated', details.reason);
    await loadSettings();
    if (settings.enabled) {
        startGlobalMonitoring();
    }
});

// Initialize background script
async function init() {
    console.log('Auto Volume Background: Initializing...');
    await loadSettings();
    
    if (settings.enabled) {
        startGlobalMonitoring();
    }
    
    console.log('Auto Volume Background: Initialization complete');
}

// Start the background script
init();
