// Surface actionable desktop test failures in the GitHub Checks API as well as logs.
const {spawnSync}=require('node:child_process');
const tests=process.argv.slice(2);
for(const file of tests){
 const result=spawnSync(process.execPath,[file],{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024,env:process.env});
 process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
 if(result.error||result.status!==0){
  const detail=(result.error?.message||result.stderr||result.stdout||'Desktop test failed').slice(-5500).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A');
  if(process.env.GITHUB_ACTIONS)console.log(`::error title=Desktop test failure (${file})::${detail}`);
  process.exit(result.status||1);
 }
}
