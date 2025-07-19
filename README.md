# Auto Volume Adjuster

A Chrome extension that automatically adjusts the volume of audio and video elements on web pages to stay within your configured minimum and maximum thresholds.

## Features

- 🔊 **Automatic Volume Control**: Monitors all audio/video elements on web pages
- 📈 **Boost Low Audio**: Automatically increases volume when it falls below your minimum threshold
- 📉 **Limit High Audio**: Automatically reduces volume when it exceeds your maximum threshold
- ⚙️ **Customizable Settings**: Set your own min/max volume levels (0-100%)
- 🎯 **Visual Feedback**: Shows a temporary indicator when volume is adjusted
- 🚀 **Real-time Monitoring**: Continuously monitors playing media elements (every 250ms)
- 💾 **Persistent Settings**: Your preferences are saved across browser sessions
- 💻 **System Volume Awareness**: Provides guidance when web volume reaches limits
- 🎵 **Web Audio API Support**: Works with custom players (SoundCloud, Spotify, etc.)
- 🌐 **Universal Compatibility**: Supports both HTML5 media and Web Audio API
- 🔄 **Background Monitoring**: Active monitoring across ALL browser tabs simultaneously
- 📊 **Multi-Tab Display**: See volume levels of all tabs with audio in the popup

## Important: System Volume Limitations

**This extension can only control web page volume (HTML audio/video elements), not your system volume.** 

- ✅ **What it can do**: Adjust volume of videos/audio on websites (YouTube, Netflix, etc.)
- ❌ **What it cannot do**: Control your computer's master volume or application-level volume
- 💡 **For maximum loudness**: Use this extension to set web volume to 100%, then increase your system volume or browser volume in your system's volume mixer

The extension will show helpful hints when web volume reaches 100% to remind you about system volume controls.

## How It Works

### Architecture
1. **Background Script**: Continuously monitors all browser tabs (every 1 second)
2. **Content Scripts**: Injected into each webpage to detect and control audio
3. **Popup Interface**: Real-time control and monitoring dashboard

### Audio Detection & Control
1. **HTML5 Media**: Scans all web pages for `<audio>` and `<video>` elements
2. **Web Audio API**: Monitors AudioContext and GainNode instances for custom players
3. **Cross-Tab Monitoring**: Background script coordinates volume adjustments across all tabs
4. **Smart Adjustment**: When volume falls below minimum, it automatically boosts it
5. **Volume Limiting**: When volume exceeds maximum, it automatically reduces it
6. **Visual Feedback**: Shows brief indicators when adjustments are made
7. **Site Detection**: Recognizes popular sites (SoundCloud, Spotify) and adapts accordingly

### Supported Audio Types:
- ✅ **HTML5 Video/Audio**: YouTube, Vimeo, HTML5 players
- ✅ **Web Audio API**: SoundCloud, Spotify Web Player, custom audio engines
- ✅ **Mixed Sources**: Sites using both HTML5 and Web Audio
- ⚠️ **Flash/Legacy**: Limited support (deprecated technologies)

## Installation

1. Clone or download this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the extension
4. Open Chrome and go to `chrome://extensions/`
5. Enable "Developer mode" in the top right
6. Click "Load unpacked" and select the `build` folder

## Development

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Build for development with file watching
npm run watch

# Format code
npm run format
```

## Usage

1. Click the extension icon in your browser toolbar
2. Toggle the extension on/off using the switch
3. Adjust the minimum volume threshold (default: 20%)
4. Adjust the maximum volume threshold (default: 80%)
5. The extension will automatically monitor and adjust volumes on all tabs

## Settings

- **Enable Auto Volume**: Toggle the extension on/off
- **Minimum Volume**: The lowest volume level allowed (0-100%)
- **Maximum Volume**: The highest volume level allowed (0-100%)

## Technical Details

- **Manifest Version**: 3
- **Permissions**: `activeTab`, `storage`
- **Content Scripts**: Runs on all HTTP/HTTPS pages
- **Storage**: Uses Chrome's sync storage for settings

## Troubleshooting

- Make sure the extension is enabled in the popup
- Check that your min/max volume settings are reasonable (min < max)
- The extension only affects unmuted media elements
- Some websites may override volume changes - this is normal browser behavior

### If audio is still too quiet:
1. **Check web volume**: The extension shows current web page volume in the popup
2. **Check system volume**: Increase your computer's master volume
3. **Check browser volume**: Some systems have per-application volume controls
4. **Check website controls**: Some sites have their own volume controls

### If audio is too loud:
- Lower the maximum volume setting in the extension
- The extension will automatically cap volume at your set maximum

## Privacy

This extension:
- Does not collect any personal data
- Does not make network requests
- Only accesses audio/video elements on web pages
- Stores settings locally using Chrome's storage API

## License

MIT License - see LICENSE file for details
