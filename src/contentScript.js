// Auto Volume Adjuster Content Script
// Automatically adjusts volume of audio/video elements to stay within min/max thresholds

let settings = {
    enabled: true,
    minVolume: 20,
    maxVolume: 80
};

let isProcessing = false;
let mediaElements = new Set();
let volumeCheckInterval = null;
let webAudioContexts = new Set();
let gainNodes = new Set();

// Load settings from storage
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get({
            enabled: true,
            minVolume: 20,
            maxVolume: 80
        });
        settings = result;
        console.log('Auto Volume: Settings loaded', settings);
    } catch (error) {
        console.error('Auto Volume: Error loading settings', error);
    }
}

// Convert percentage to decimal volume (0-1)
const percentToVolume = (percent) => Math.max(0, Math.min(1, percent / 100));

// Convert decimal volume to percentage
const volumeToPercent = (volume) => Math.round(volume * 100);

// Adjust volume of a media element
const adjustMediaVolume = (element) => {
    if (!element || !settings.enabled) return;
    
    // Skip if element is muted (user choice)
    if (element.muted) return;
    
    const currentVolume = element.volume;
    const currentPercent = volumeToPercent(currentVolume);
    
    let newPercent = currentPercent;
    let adjusted = false;
    let adjustmentType = '';
    
    // Check if volume is below minimum
    if (currentPercent < settings.minVolume) {
        newPercent = settings.minVolume;
        adjusted = true;
        adjustmentType = 'boosted';
        console.log(`Auto Volume: Boosting volume from ${currentPercent}% to ${newPercent}%`);
    }
    // Check if volume is above maximum
    else if (currentPercent > settings.maxVolume) {
        newPercent = settings.maxVolume;
        adjusted = true;
        adjustmentType = 'reduced';
        console.log(`Auto Volume: Reducing volume from ${currentPercent}% to ${newPercent}%`);
    }
    
    if (adjusted) {
        const newVolume = percentToVolume(newPercent);
        
        // Prevent feedback loops by temporarily removing event listeners
        const tempVolumeHandler = () => {};
        element.removeEventListener('volumechange', tempVolumeHandler);
        
        // Set the new volume
        element.volume = newVolume;
        
        // Add a small delay before re-enabling volume change detection
        setTimeout(() => {
            // Re-add event listener if needed (this is handled in findMediaElements)
        }, 100);
        
        // Add visual indicator for a moment
        showVolumeIndicator(element, newPercent, adjustmentType);
        
        // If we're boosting to 100% and it might still be too quiet
        if (newPercent >= 100 && adjustmentType === 'boosted') {
            setTimeout(() => {
                showSystemVolumeHint(element);
            }, 3000); // Show system volume hint 3 seconds after hitting 100%
        }
    }
};

// Show a temporary visual indicator when volume is adjusted
const showVolumeIndicator = (element, volume, adjustmentType = '') => {
    // Remove any existing indicator
    const existingIndicator = element.parentNode?.querySelector('.auto-volume-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // Create volume indicator with appropriate icon
    const indicator = document.createElement('div');
    indicator.className = 'auto-volume-indicator';
    
    let icon = '🔊';
    let color = '#4CAF50';
    if (adjustmentType === 'boosted') {
        icon = '🔊↗️';
        color = '#2196F3';
    } else if (adjustmentType === 'reduced') {
        icon = '🔊↘️';
        color = '#FF9800';
    }
    
    indicator.innerHTML = `${icon} ${volume}%`;
    indicator.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 600;
        z-index: 99999;
        pointer-events: none;
        transition: opacity 0.3s ease;
        border-left: 3px solid ${color};
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    
    // Position relative to the video element
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        if (element.parentNode) {
            const parent = element.parentNode;
            if (parent.style.position === '' || parent.style.position === 'static') {
                parent.style.position = 'relative';
            }
            parent.appendChild(indicator);
            
            // Remove indicator after 2.5 seconds
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.style.opacity = '0';
                    setTimeout(() => {
                        if (indicator.parentNode) {
                            indicator.remove();
                        }
                    }, 300);
                }
            }, 2500);
        }
    }
};

// Show a system volume hint when web volume is at maximum
const showSystemVolumeHint = (element) => {
    // Remove any existing hint
    const existingHint = element.parentNode?.querySelector('.auto-volume-system-hint');
    if (existingHint) {
        existingHint.remove();
    }
    
    // Create system volume hint
    const hint = document.createElement('div');
    hint.className = 'auto-volume-system-hint';
    hint.innerHTML = `🔊💻 Web volume at 100%<br><small>Check system volume for louder audio</small>`;
    hint.style.cssText = `
        position: absolute;
        top: 50px;
        left: 10px;
        background: rgba(33, 150, 243, 0.95);
        color: white;
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 500;
        z-index: 99999;
        pointer-events: none;
        transition: opacity 0.3s ease;
        border-left: 3px solid #1976D2;
        box-shadow: 0 3px 12px rgba(0,0,0,0.4);
        max-width: 200px;
        text-align: center;
        line-height: 1.3;
    `;
    
    // Position relative to the video element
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        if (element.parentNode) {
            const parent = element.parentNode;
            if (parent.style.position === '' || parent.style.position === 'static') {
                parent.style.position = 'relative';
            }
            parent.appendChild(hint);
            
            // Remove hint after 4 seconds
            setTimeout(() => {
                if (hint.parentNode) {
                    hint.style.opacity = '0';
                    setTimeout(() => {
                        if (hint.parentNode) {
                            hint.remove();
                        }
                    }, 300);
                }
            }, 4000);
        }
    }
};

// Find and monitor all media elements
const findMediaElements = () => {
    const audioElements = document.querySelectorAll('audio');
    const videoElements = document.querySelectorAll('video');
    
    [...audioElements, ...videoElements].forEach(element => {
        if (!mediaElements.has(element)) {
            mediaElements.add(element);
            
            // Initial volume check
            adjustMediaVolume(element);
            
            // Listen for volume changes and immediately re-adjust
            element.addEventListener('volumechange', () => {
                // Small delay to let the volume change complete, then re-adjust
                setTimeout(() => {
                    if (settings.enabled) {
                        adjustMediaVolume(element);
                    }
                }, 50);
            });
            
            // Listen for when media starts playing
            element.addEventListener('play', () => {
                setTimeout(() => {
                    if (settings.enabled) {
                        adjustMediaVolume(element);
                    }
                }, 50);
            });
            
            // Listen for when media loads
            element.addEventListener('loadeddata', () => {
                setTimeout(() => {
                    if (settings.enabled) {
                        adjustMediaVolume(element);
                    }
                }, 50);
            });
            
            // Listen for when media metadata loads (volume info available)
            element.addEventListener('loadedmetadata', () => {
                setTimeout(() => {
                    if (settings.enabled) {
                        adjustMediaVolume(element);
                    }
                }, 50);
            });
            
            // Listen for when playback rate changes (some sites change volume with playback)
            element.addEventListener('ratechange', () => {
                setTimeout(() => {
                    if (settings.enabled) {
                        adjustMediaVolume(element);
                    }
                }, 50);
            });
            
            console.log('Auto Volume: Monitoring new media element', element.tagName);
        }
    });
};

// Periodic check for volume adjustments
const startVolumeMonitoring = () => {
    if (volumeCheckInterval) {
        clearInterval(volumeCheckInterval);
    }
    
    volumeCheckInterval = setInterval(() => {
        if (settings.enabled) {
            // Monitor HTML5 media elements
            mediaElements.forEach(element => {
                // Remove elements that are no longer in the DOM
                if (!document.contains(element)) {
                    mediaElements.delete(element);
                    return;
                }
                
                // Adjust volume for all media elements, not just playing ones
                // This ensures we catch volume changes immediately
                adjustMediaVolume(element);
            });
            
            // Monitor Web Audio gain nodes
            monitorWebAudioGain();
            
            // Also check for any new media elements that might have appeared
            findMediaElements();
        }
    }, 250); // Check every 250ms for more responsive volume control
};

// Set up mutation observer to detect new media elements
const setupMutationObserver = () => {
    const observer = new MutationObserver((mutations) => {
        if (isProcessing) return;
        isProcessing = true;
        
        setTimeout(() => {
            findMediaElements();
            isProcessing = false;
        }, 100);
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
};

// Web Audio API monitoring and control
const setupWebAudioMonitoring = () => {
    // Hook into AudioContext creation
    const originalAudioContext = window.AudioContext || window.webkitAudioContext;
    if (originalAudioContext) {
        const AudioContextProxy = function(...args) {
            const ctx = new originalAudioContext(...args);
            webAudioContexts.add(ctx);
            
            // Hook into createGain to monitor gain nodes
            const originalCreateGain = ctx.createGain.bind(ctx);
            ctx.createGain = function() {
                const gainNode = originalCreateGain();
                gainNodes.add(gainNode);
                
                // Monitor gain changes
                const originalGainValue = gainNode.gain.value;
                Object.defineProperty(gainNode.gain, 'value', {
                    get() {
                        return this._value || originalGainValue;
                    },
                    set(newValue) {
                        this._value = newValue;
                        if (settings.enabled) {
                            setTimeout(() => adjustWebAudioGain(gainNode), 50);
                        }
                    }
                });
                
                return gainNode;
            };
            
            console.log('Auto Volume: Monitoring Web Audio Context');
            return ctx;
        };
        
        // Replace the global constructors
        window.AudioContext = AudioContextProxy;
        if (window.webkitAudioContext) {
            window.webkitAudioContext = AudioContextProxy;
        }
    }
};

// Adjust Web Audio API gain nodes
const adjustWebAudioGain = (gainNode) => {
    if (!gainNode || !settings.enabled) return;
    
    const currentGain = gainNode.gain.value;
    const currentPercent = Math.round(currentGain * 100);
    
    let newPercent = currentPercent;
    let adjusted = false;
    let adjustmentType = '';
    
    // Check if gain is below minimum
    if (currentPercent < settings.minVolume) {
        newPercent = settings.minVolume;
        adjusted = true;
        adjustmentType = 'boosted';
        console.log(`Auto Volume: Boosting Web Audio gain from ${currentPercent}% to ${newPercent}%`);
    }
    // Check if gain is above maximum  
    else if (currentPercent > settings.maxVolume) {
        newPercent = settings.maxVolume;
        adjusted = true;
        adjustmentType = 'reduced';
        console.log(`Auto Volume: Reducing Web Audio gain from ${currentPercent}% to ${newPercent}%`);
    }
    
    if (adjusted) {
        const newGain = newPercent / 100;
        gainNode.gain.setValueAtTime(newGain, gainNode.context.currentTime);
        
        // Show visual indicator if we can find a related media element
        const mediaElement = findRelatedMediaElement();
        if (mediaElement) {
            showVolumeIndicator(mediaElement, newPercent, adjustmentType);
        } else {
            showFloatingVolumeIndicator(newPercent, adjustmentType);
        }
    }
};

// Find a media element that might be related to Web Audio
const findRelatedMediaElement = () => {
    // Look for any video or audio element that might be playing
    const allMedia = document.querySelectorAll('video, audio');
    for (const element of allMedia) {
        if (!element.paused && !element.muted) {
            return element;
        }
    }
    
    // If no playing media, return the first video element we find
    const firstVideo = document.querySelector('video');
    if (firstVideo) return firstVideo;
    
    // Look for common player containers
    const playerContainers = document.querySelectorAll(
        '.player, .video-player, .audio-player, [class*="player"], [id*="player"]'
    );
    if (playerContainers.length > 0) {
        return playerContainers[0];
    }
    
    return null;
};

// Show floating volume indicator when no media element is available
const showFloatingVolumeIndicator = (volume, adjustmentType = '') => {
    // Remove any existing floating indicator
    const existingIndicator = document.querySelector('.auto-volume-floating-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // Create floating volume indicator
    const indicator = document.createElement('div');
    indicator.className = 'auto-volume-floating-indicator';
    
    let icon = '🔊';
    let color = '#4CAF50';
    if (adjustmentType === 'boosted') {
        icon = '🔊↗️';
        color = '#2196F3';
    } else if (adjustmentType === 'reduced') {
        icon = '🔊↘️';
        color = '#FF9800';
    }
    
    indicator.innerHTML = `${icon} ${volume}%`;
    indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 600;
        z-index: 999999;
        pointer-events: none;
        transition: opacity 0.3s ease;
        border-left: 4px solid ${color};
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(indicator);
    
    // Remove indicator after 2.5 seconds
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.remove();
                }
            }, 300);
        }
    }, 2500);
};

// Monitor all Web Audio gain nodes periodically
const monitorWebAudioGain = () => {
    gainNodes.forEach(gainNode => {
        try {
            if (gainNode.context && gainNode.context.state !== 'closed') {
                adjustWebAudioGain(gainNode);
            } else {
                // Remove closed/invalid gain nodes
                gainNodes.delete(gainNode);
            }
        } catch (error) {
            // Remove invalid gain nodes
            gainNodes.delete(gainNode);
        }
    });
};

// Get current volume of playing media (including Web Audio)
const getCurrentVolume = () => {
    let maxVolume = 0;
    let hasMedia = false;
    let isAtMaxVolume = false;
    let totalElements = 0;
    
    // Check HTML5 media elements
    mediaElements.forEach(element => {
        if (document.contains(element)) {
            totalElements++;
            if (!element.paused && !element.muted) {
                hasMedia = true;
                maxVolume = Math.max(maxVolume, element.volume);
                if (element.volume >= 0.99) { // Consider 99%+ as max volume
                    isAtMaxVolume = true;
                }
            }
        }
    });
    
    // Check Web Audio gain nodes
    gainNodes.forEach(gainNode => {
        try {
            if (gainNode.context && gainNode.context.state !== 'closed') {
                hasMedia = true;
                totalElements++;
                const gainValue = gainNode.gain.value;
                maxVolume = Math.max(maxVolume, gainValue);
                if (gainValue >= 0.99) {
                    isAtMaxVolume = true;
                }
            }
        } catch (error) {
            // Ignore invalid gain nodes
        }
    });
    
    // If no playing media, check all media elements
    if (!hasMedia && totalElements > 0) {
        mediaElements.forEach(element => {
            if (document.contains(element)) {
                hasMedia = true;
                maxVolume = Math.max(maxVolume, element.volume);
                if (element.volume >= 0.99) {
                    isAtMaxVolume = true;
                }
            }
        });
    }
    
    return { 
        volume: maxVolume, 
        hasMedia, 
        isAtMaxVolume,
        totalElements 
    };
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SETTINGS_UPDATED') {
        settings = message.settings;
        console.log('Auto Volume: Settings updated', settings);
        
        if (!settings.enabled && volumeCheckInterval) {
            clearInterval(volumeCheckInterval);
            volumeCheckInterval = null;
        } else if (settings.enabled && !volumeCheckInterval) {
            startVolumeMonitoring();
        }
        sendResponse({ success: true });
    } else if (message.type === 'GET_CURRENT_VOLUME') {
        const volumeInfo = getCurrentVolume();
        sendResponse(volumeInfo);
    }
    
    return true; // Will respond asynchronously
});

// Initialize the extension
const initExtension = async () => {
    console.log('Auto Volume: Content script loaded');
    
    // Set up Web Audio monitoring first (needs to be early)
    setupWebAudioMonitoring();
    
    await loadSettings();
    findMediaElements();
    setupMutationObserver();
    
    if (settings.enabled) {
        startVolumeMonitoring();
    }
    
    console.log('Auto Volume: Initialization complete');
};

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (volumeCheckInterval) {
        clearInterval(volumeCheckInterval);
    }
});

// Start the extension
initExtension();