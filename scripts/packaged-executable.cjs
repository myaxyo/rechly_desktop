const fs=require('node:fs');const path=require('node:path');
const dir=path.resolve(__dirname,'../dist');
const names=process.platform==='win32'?['win-unpacked/Rechly Desktop.exe']:process.arch==='arm64'?['mac-arm64/Rechly Desktop.app/Contents/MacOS/Rechly Desktop']:['mac/Rechly Desktop.app/Contents/MacOS/Rechly Desktop','mac-x64/Rechly Desktop.app/Contents/MacOS/Rechly Desktop'];
const found=names.map(n=>path.join(dir,n)).find(p=>fs.existsSync(p));if(!found)throw Error('Packaged executable not found for this platform');console.log(found);
