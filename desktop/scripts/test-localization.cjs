const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..');
const runtime=fs.readdirSync(base).filter(f=>f.endsWith('.cjs')).map(f=>path.join(base,f));
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())walk(p);else if(/\.(js|html|css)$/.test(p))runtime.push(p);}}
walk(path.join(base,'renderer'));
for(const file of runtime){const text=fs.readFileSync(file,'utf8');assert(!/[\p{Script=Han}]/u.test(text),'Untranslated text in '+file);if(/\.(js|cjs)$/.test(file))new vm.Script(text,{filename:file});}
const context=vm.createContext({window:{},document:{documentElement:{}}});
vm.runInContext(fs.readFileSync(path.join(base,'renderer/i18n.js'),'utf8'),context);
const i=context.window.GrokI18n;
assert.deepEqual(Object.keys(i.locales).sort(),['en','ru']);
for(const [key,value] of Object.entries(i.locales.en)){
 assert(key in i.locales.ru,'Missing Russian translation '+key);
 assert.deepEqual((value.match(/\{\w+\}/g)||[]).sort(),(i.locales.ru[key].match(/\{\w+\}/g)||[]).sort(),'Placeholders '+key);
}
i.setLocale('ru');assert.equal(context.document.documentElement.lang,'ru');assert.equal(i.t('settings.nav.memory'),'Память');
console.log('Russian localization verified: '+runtime.length+' runtime files, '+Object.keys(i.locales.ru).length+' dictionary entries.');
