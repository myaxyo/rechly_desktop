import { randomUUID } from 'node:crypto';
import ICAL from 'ical.js';

export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export interface CalendarEvent {
    id: string; title: string; start: string; end: string; allDay: boolean;
    category: 'work' | 'personal' | 'deadline'; location: string; notes: string;
    repeat: Repeat; interval: number; until: string; exceptions: string[];
    reminder: number; updated_at: number;
}
export interface Occurrence extends CalendarEvent { occurrenceStart: string; occurrenceEnd: string; }
export function localStamp(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
export function validStamp(value: unknown): value is string {
    return typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && value>='1900' && value<'2200' && Number.isFinite(new Date(value).getTime()) && localStamp(new Date(value))===value;
}
const str = (value: unknown, max: number, required=false): string => {
    if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error('Bitte prüfen Sie Titel und Textlängen.');
    return value.trim();
};
export function validateEvent(raw: unknown, existing: CalendarEvent[]): CalendarEvent {
    if(!raw||typeof raw!=='object')throw new Error('Ungültiger Termin.');
    const r=raw as Record<string,unknown>;
    const id=r.id?str(r.id,200,true):randomUUID();
    if(r.id&&!existing.some(e=>e.id===id))throw new Error('Termin nicht gefunden.');
    if(!validStamp(r.start)||!validStamp(r.end)||r.end<=r.start)throw new Error('Das Ende muss nach dem Beginn liegen. Bitte gültige lokale Zeiten wählen.');
    if(dayNumber(r.end)-dayNumber(r.start)>31)throw new Error('Ein Termin darf höchstens 31 Tage dauern.');
    if(typeof r.allDay!=='boolean'||(r.allDay&&(!r.start.endsWith('T00:00')||!r.end.endsWith('T00:00'))))throw new Error('Ganztägige Termine müssen um Mitternacht beginnen und enden.');
    if(!['work','personal','deadline'].includes(String(r.category))||!['none','daily','weekly','monthly','yearly'].includes(String(r.repeat)))throw new Error('Ungültige Kategorie oder Wiederholung.');
    if(!Number.isInteger(r.interval)||Number(r.interval)<1||Number(r.interval)>30)throw new Error('Wiederholungsintervall: 1 bis 30.');
    if(typeof r.until!=='string'||(r.until&&(!validStamp(r.until+'T00:00')||r.until<r.start.slice(0,10))))throw new Error('Das Serienende darf nicht vor dem Beginn liegen.');
    if(![-1,0,5,10,15,30,60,1440].includes(Number(r.reminder))||typeof r.reminder!=='number')throw new Error('Ungültige Erinnerung.');
    if(!Array.isArray(r.exceptions)||r.exceptions.length>5000||r.exceptions.some(v=>!validStamp(v+'T00:00')))throw new Error('Ungültige Serienausnahmen.');
    return {id,title:str(r.title,200,true),start:r.start,end:r.end,allDay:r.allDay,category:r.category as CalendarEvent['category'],repeat:r.repeat as Repeat,interval:Number(r.interval),until:r.until,exceptions:[...new Set(r.exceptions as string[])],location:str(r.location,1000),notes:str(r.notes,20000),reminder:r.reminder,updated_at:Date.now()};
}
function dayNumber(date: string): number {return Date.parse(date.slice(0,10)+'T00:00:00Z')/86400000;}
export function occurrences(events: CalendarEvent[], from: string, to: string): Occurrence[] {
    if(!validStamp(from)||!validStamp(to)||to<=from||dayNumber(to)-dayNumber(from)>100)throw new Error('Kalenderzeitraum muss zwischen 1 und 100 Tagen liegen.');
    const result:Occurrence[]=[];
    for(const event of events){
        const first=new Date(event.start); const offset=dayNumber(event.end)-dayNumber(event.start);
        const cursor=new Date(from);cursor.setDate(cursor.getDate()-offset-1);cursor.setHours(first.getHours(),first.getMinutes(),0,0);
        while(localStamp(cursor)<to){
            const stamp=localStamp(cursor);const date=stamp.slice(0,10);
            const delta=dayNumber(stamp)-dayNumber(event.start);
            const months=(cursor.getFullYear()-first.getFullYear())*12+cursor.getMonth()-first.getMonth();
            const matches=delta>=0&&(event.repeat==='none'?date===event.start.slice(0,10):event.repeat==='daily'?delta%event.interval===0:event.repeat==='weekly'?delta%(7*event.interval)===0:event.repeat==='monthly'?months%event.interval===0&&cursor.getDate()===first.getDate():(cursor.getFullYear()-first.getFullYear())%event.interval===0&&cursor.getMonth()===first.getMonth()&&cursor.getDate()===first.getDate());
            if(matches&&(!event.until||date<=event.until)&&!event.exceptions.includes(date)){
                const end=new Date(cursor);end.setDate(end.getDate()+offset);end.setHours(Number(event.end.slice(11,13)),Number(event.end.slice(14,16)),0,0);
                if(localStamp(end)>from&&stamp<to)result.push({...event,occurrenceStart:stamp,occurrenceEnd:localStamp(end)});
            }
            cursor.setDate(cursor.getDate()+1);cursor.setHours(first.getHours(),first.getMinutes(),0,0);
        }
    }
    return result.sort((a,b)=>a.occurrenceStart.localeCompare(b.occurrenceStart)||a.title.localeCompare(b.title));
}
const freq = {daily:'DAILY',weekly:'WEEKLY',monthly:'MONTHLY',yearly:'YEARLY'};
export function exportCalendar(events:CalendarEvent[]):string {
    const cal=new ICAL.Component(['vcalendar',[],[]]);cal.addPropertyWithValue('version','2.0');cal.addPropertyWithValue('prodid','-//Rechly//Offline Calendar//DE');
    for(const event of events){
        const item=new ICAL.Component('vevent');
        item.addPropertyWithValue('uid',event.id+'@rechly.local');item.addPropertyWithValue('dtstamp',ICAL.Time.fromJSDate(new Date(event.updated_at),true));
        item.addPropertyWithValue('summary',event.title);item.addPropertyWithValue('description',event.notes);item.addPropertyWithValue('location',event.location);
        const time=(s:string)=>ICAL.Time.fromString(event.allDay?s.slice(0,10):s+':00', undefined);
        item.addPropertyWithValue('dtstart',time(event.start));item.addPropertyWithValue('dtend',time(event.end));
        item.addPropertyWithValue('x-rechly-category',event.category);
        if(event.repeat!=='none')item.addPropertyWithValue('rrule',ICAL.Recur.fromString(`FREQ=${freq[event.repeat]};INTERVAL=${event.interval}${event.until?';UNTIL='+event.until.replace(/-/g,'')+(event.allDay?'':'T235959'):''}`));
        for(const date of event.exceptions)item.addPropertyWithValue('exdate',time(date+event.start.slice(10)));
        if(event.reminder>=0){const alarm=new ICAL.Component('valarm');alarm.addPropertyWithValue('action','DISPLAY');alarm.addPropertyWithValue('description',event.title);alarm.addPropertyWithValue('trigger',ICAL.Duration.fromSeconds(-event.reminder*60));item.addSubcomponent(alarm);}
        cal.addSubcomponent(item);
    }
    return cal.toString();
}
/** Import the supported local/UTC subset atomically; refuse unsupported recurrence/time-zone semantics. */
export function importCalendar(source:string,existing:CalendarEvent[]):CalendarEvent[] {
    if(Buffer.byteLength(source)>5*1024*1024)throw new Error('Kalenderdateien dürfen maximal 5 MB groß sein.');
    const cal=new ICAL.Component(ICAL.parse(source));if(cal.name!=='vcalendar')throw new Error('Keine gültige Kalenderdatei.');
    const items=cal.getAllSubcomponents('vevent');if(!items.length||items.length>2000)throw new Error('Die Datei muss 1 bis 2000 Termine enthalten.');
    const result=[...existing];
    for(const component of items){
        if(component.hasProperty('recurrence-id')||component.hasProperty('rdate'))throw new Error('Import enthält einzelne Serienänderungen oder zusätzliche Serientermine. Bitte diese als Einzeltermine exportieren.');
        const start=component.getFirstPropertyValue('dtstart') as ICAL.Time|null; const end=component.getFirstPropertyValue('dtend') as ICAL.Time|null;
        if(!start)throw new Error('Termin ohne Beginn.');
        const tz=component.getFirstProperty('dtstart')?.getParameter('tzid');
        if(tz)throw new Error('Import mit TZID wird noch nicht unterstützt. Bitte als lokale Zeiten oder UTC exportieren.');
        let finish=end;
        if(!finish){finish=start.clone();const duration=component.getFirstPropertyValue('duration') as ICAL.Duration|null;if(duration)finish.addDuration(duration);else finish.adjust(start.isDate?1:0, start.isDate?0:1,0,0);}
        if(start.isDate!==finish.isDate)throw new Error('Beginn und Ende verwenden unterschiedliche Datumsformate.');
        const convert=(time:ICAL.Time)=>time.isDate?time.toString()+'T00:00':time.zone===ICAL.Timezone.utcTimezone?localStamp(time.toJSDate()):time.toString().slice(0,16);
        const rule=component.getFirstPropertyValue('rrule') as ICAL.Recur|null;
        if(rule&&(rule.count||Object.keys(rule.parts).length||!Object.values(freq).includes(rule.freq)))throw new Error('Diese Wiederholungsregel wird noch nicht unterstützt (nur täglich, wöchentlich, monatlich oder jährlich bis Datum).');
        if(rule&&start.zone===ICAL.Timezone.utcTimezone)throw new Error('Wiederholte UTC-Termine bitte vor dem Import in lokale Zeiten umwandeln, damit Sommerzeitregeln erhalten bleiben.');
        let reminder=-1;const alarm=component.getFirstSubcomponent('valarm');
        if(alarm){const trigger=alarm.getFirstPropertyValue('trigger');if(trigger instanceof ICAL.Duration){const minutes=-trigger.toSeconds()/60;if([-1,0,5,10,15,30,60,1440].includes(minutes))reminder=minutes;else throw new Error('Nicht unterstützter Erinnerungsabstand.');}else throw new Error('Absolute Erinnerungen werden nicht unterstützt.');}
        const uid=String(component.getFirstPropertyValue('uid')||randomUUID()).replace(/@rechly\.local$/,'');
        if(result.some(e=>e.id===uid))continue;
        const raw={id:uid,title:String(component.getFirstPropertyValue('summary')||'Ohne Titel'),start:convert(start),end:convert(finish),allDay:start.isDate,category:component.getFirstPropertyValue('x-rechly-category')||'work',location:String(component.getFirstPropertyValue('location')||''),notes:String(component.getFirstPropertyValue('description')||''),repeat:rule?Object.entries(freq).find(([,v])=>v===rule.freq)?.[0]:'none',interval:rule?.interval||1,until:rule?.until?rule.until.toString().slice(0,10):'',exceptions:component.getAllProperties('exdate').flatMap(p=>p.getValues().map(t=>(t as ICAL.Time).toString().slice(0,10))),reminder};
        result.push(validateEvent(raw,[...result,{id:uid} as CalendarEvent]));
    }
    return result;
}
