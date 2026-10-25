const {test}=require('node:test');const assert=require('node:assert/strict');
const {validateEvent,occurrences,exportCalendar,importCalendar}=require('../out/calendar');
const base=()=>({title:'Planung',start:'2026-01-31T09:00',end:'2026-01-31T10:00',allDay:false,category:'work',location:'Büro',notes:'Zeile 1\nZeile 2; Grüße, Köln',repeat:'none',interval:1,until:'',exceptions:[],reminder:15});
test('validates time ranges, categories, reminders and recurrence',()=>{
 for(const patch of [{title:''},{start:'2026-02-30T09:00'},{end:'2026-01-31T08:00'},{category:'x'},{interval:0},{until:'2025-01-01'},{reminder:7},{exceptions:['bad']},{allDay:true}])assert.throws(()=>validateEvent({...base(),...patch},[]));
});
test('monthly recurrence skips nonexistent month dates rather than drifting',()=>{
 const e=validateEvent({...base(),repeat:'monthly'},[]);const rows=occurrences([e],'2026-02-01T00:00','2026-04-02T00:00');assert.deepEqual(rows.map(e=>e.occurrenceStart),['2026-03-31T09:00']);
});
test('weekly intervals, inclusive end dates, and individual deletions',()=>{
 const e=validateEvent({...base(),repeat:'weekly',interval:2,until:'2026-03-14',exceptions:['2026-02-14']},[]);
 assert.deepEqual(occurrences([e],'2026-01-01T00:00','2026-04-01T00:00').map(e=>e.occurrenceStart),['2026-01-31T09:00','2026-02-28T09:00','2026-03-14T09:00']);
});
test('all-day end is exclusive; multi-day events overlap the visible range',()=>{
 const e=validateEvent({...base(),start:'2026-02-01T00:00',end:'2026-02-04T00:00',allDay:true},[]);
 assert.equal(occurrences([e],'2026-02-03T00:00','2026-02-04T00:00').length,1);
 assert.equal(occurrences([e],'2026-02-04T00:00','2026-02-05T00:00').length,0);
});
test('recurrences preserve morning wall time across daylight saving transitions',()=>{
 const e=validateEvent({...base(),start:'2026-03-27T09:00',end:'2026-03-27T10:00',repeat:'daily'},[]);
 const result=occurrences([e],'2026-03-27T00:00','2026-03-31T00:00');assert.equal(result.length,4);assert.ok(result.every(e=>e.occurrenceStart.endsWith('T09:00')&&e.occurrenceEnd.endsWith('T10:00')));
});
test('ICS round trip preserves Unicode, multiline text, recurrence, alarms, exclusions',()=>{
 const event=validateEvent({...base(),repeat:'weekly',until:'2026-03-01',exceptions:['2026-02-07']},[]);
 const imported=importCalendar(exportCalendar([event]),[]);assert.equal(imported.length,1);
 for(const key of ['id','title','start','end','allDay','category','location','notes','repeat','interval','until','reminder','exceptions'])assert.deepEqual(imported[0][key],event[key],key);
 assert.equal(importCalendar(exportCalendar([event]),imported).length,1);
});
test('ICS all-day and UTC single events import correctly',()=>{
 const event=validateEvent({...base(),start:'2026-02-01T00:00',end:'2026-02-02T00:00',allDay:true},[]);
 assert.equal(importCalendar(exportCalendar([event]),[])[0].allDay,true);
 const source='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:testutc\r\nDTSTART:20260101T120000Z\r\nDTEND:20260101T130000Z\r\nSUMMARY:UTC\r\nEND:VEVENT\r\nEND:VCALENDAR';
 assert.equal(new Date(importCalendar(source,[])[0].start).toISOString(),'2026-01-01T12:00:00.000Z');
});
test('unsupported calendar rules fail atomically instead of losing semantics',()=>{
 const source=exportCalendar([validateEvent({...base(),repeat:'weekly'},[])]).replace('FREQ=WEEKLY','FREQ=WEEKLY;BYDAY=MO,WE');
 assert.throws(()=>importCalendar(source,[]),/Wiederholungsregel/);
 assert.throws(()=>occurrences([],'2026-01-01T00:00','2027-01-01T00:00'),/zeitraum/);
});
