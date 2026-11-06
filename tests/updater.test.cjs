const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isNewerVersion, matchPlatformAsset } = require('../out/updater');

test('isNewerVersion accurately compares semver strings', () => {
    assert.equal(isNewerVersion('1.3.0', '1.3.1'), true);
    assert.equal(isNewerVersion('1.3.1', '1.3.2'), true);
    assert.equal(isNewerVersion('v1.3.1', 'v1.3.2'), true);
    assert.equal(isNewerVersion('1.3.1', '1.3.1'), false);
    assert.equal(isNewerVersion('1.3.2', '1.3.1'), false);
    assert.equal(isNewerVersion('1.9.5', '1.10.0'), true);
    assert.equal(isNewerVersion('2.0.0', '1.99.99'), false);
    assert.equal(isNewerVersion('0.5.0', '0.5.1'), true);
});

test('matchPlatformAsset resolves correct binary per OS and CPU arch', () => {
    const assets = [
        { name: 'Rechly-Desktop-mac-arm64.dmg', browser_download_url: 'https://github.com/myaxyo/rechly_desktop/releases/download/v1.3.1/Rechly-Desktop-mac-arm64.dmg', size: 100 },
        { name: 'Rechly-Desktop-mac-x64.dmg', browser_download_url: 'https://github.com/myaxyo/rechly_desktop/releases/download/v1.3.1/Rechly-Desktop-mac-x64.dmg', size: 100 },
        { name: 'Rechly-Desktop-Setup-win-x64.exe', browser_download_url: 'https://github.com/myaxyo/rechly_desktop/releases/download/v1.3.1/Rechly-Desktop-Setup-win-x64.exe', size: 100 },
        { name: 'Rechly.Desktop-1.3.1-arm64-mac.zip', browser_download_url: 'https://github.com/myaxyo/rechly_desktop/releases/download/v1.3.1/Rechly.Desktop-1.3.1-arm64-mac.zip', size: 100 },
        { name: 'Rechly.Desktop-1.3.1-mac.zip', browser_download_url: 'https://github.com/myaxyo/rechly_desktop/releases/download/v1.3.1/Rechly.Desktop-1.3.1-mac.zip', size: 100 },
        { name: 'SHA256SUMS.txt', browser_download_url: 'https://github.com/myaxyo/rechly_desktop/releases/download/v1.3.1/SHA256SUMS.txt', size: 400 }
    ];

    // Windows x64
    const winMatch = matchPlatformAsset(assets, 'win32', 'x64');
    assert.equal(winMatch?.name, 'Rechly-Desktop-Setup-win-x64.exe');

    // macOS Apple Silicon (arm64)
    const macArmMatch = matchPlatformAsset(assets, 'darwin', 'arm64');
    assert.equal(macArmMatch?.name, 'Rechly-Desktop-mac-arm64.dmg');

    // macOS Intel (x64)
    const macX64Match = matchPlatformAsset(assets, 'darwin', 'x64');
    assert.equal(macX64Match?.name, 'Rechly-Desktop-mac-x64.dmg');
});
