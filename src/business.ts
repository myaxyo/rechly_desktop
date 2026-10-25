import { randomUUID } from 'node:crypto';

export interface BusinessDocument {
    id: string; title: string; kind: 'letter' | 'minutes' | 'note'; recipient: string;
    body: string; project_id: string; updated_at: number;
}
export interface BusinessProject {
    id: string; name: string; client_id: string; description: string;
    status: 'active' | 'paused' | 'done'; due_date: string; budget: number; updated_at: number;
}
export interface BusinessTask {
    id: string; title: string; project_id: string; assignee: string;
    status: 'todo' | 'doing' | 'done'; priority: 'normal' | 'high'; due_date: string; updated_at: number;
}
export interface BusinessData { documents: BusinessDocument[]; projects: BusinessProject[]; tasks: BusinessTask[]; }
export type BusinessCollection = keyof BusinessData;
export const emptyBusiness = (): BusinessData => ({ documents: [], projects: [], tasks: [] });
export function collection(value: unknown): BusinessCollection {
    if (value !== 'documents' && value !== 'projects' && value !== 'tasks') throw new Error('Unbekannter Arbeitsbereich.');
    return value;
}
const text = (value: unknown, max: number, required = false): string => {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('Bitte prüfen Sie Pflichtfelder und Textlänge.');
    return value.trim();
};
const date = (value: unknown): string => {
    if (value === '') return '';
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new Error('Ungültiges Datum.');
    return value;
};
function choice<T extends string>(value: unknown, options: readonly T[]): T {
    if (!options.includes(value as T)) throw new Error('Ungültiger Status oder Dokumenttyp.');
    return value as T;
}
/** Validate all incoming fields in the main process; never trust renderer record IDs or totals. */
export function saveBusinessRecord(data: BusinessData, key: BusinessCollection, raw: unknown, clients: string[]): BusinessData {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Ungültiger Datensatz.');
    const input = raw as Record<string, unknown>;
    const id = input.id ? text(input.id, 100, true) : randomUUID();
    if (input.id && !data[key].some(row => row.id === id)) throw new Error('Der Datensatz wurde nicht gefunden.');
    const reference = (value: unknown, ids: string[]) => { const ref = text(value,100); if (ref && !ids.includes(ref)) throw new Error('Die Verknüpfung existiert nicht mehr.'); return ref; };
    const base = { id, updated_at: Date.now() };
    const next = structuredClone(data);
    if (key === 'documents') {
        const record: BusinessDocument = { ...base, title:text(input.title,200,true), kind:choice(input.kind,['letter','minutes','note']), recipient:text(input.recipient,1000), body:text(input.body,100000), project_id:reference(input.project_id, data.projects.map(p=>p.id)) };
        next.documents = [record, ...next.documents.filter(r=>r.id!==id)];
    } else if (key === 'projects') {
        if (typeof input.budget !== 'number' || !Number.isFinite(input.budget) || input.budget < 0 || input.budget > 1e12) throw new Error('Ungültiges Projektbudget.');
        const record: BusinessProject = { ...base, name:text(input.name,200,true), description:text(input.description,10000), client_id:reference(input.client_id,clients), status:choice(input.status,['active','paused','done']), due_date:date(input.due_date), budget:Math.round(input.budget*100)/100 };
        next.projects = [record, ...next.projects.filter(r=>r.id!==id)];
    } else {
        const record: BusinessTask = { ...base, title:text(input.title,300,true), assignee:text(input.assignee,200), project_id:reference(input.project_id,data.projects.map(p=>p.id)), status:choice(input.status,['todo','doing','done']), priority:choice(input.priority,['normal','high']), due_date:date(input.due_date) };
        next.tasks = [record, ...next.tasks.filter(r=>r.id!==id)];
    }
    return next;
}
export function deleteBusinessRecord(data: BusinessData, key: BusinessCollection, id: unknown): BusinessData {
    if (typeof id !== 'string' || !data[key].some(r=>r.id===id)) throw new Error('Datensatz nicht gefunden.');
    if (key === 'projects' && (data.tasks.some(t=>t.project_id===id) || data.documents.some(d=>d.project_id===id))) throw new Error('Entfernen Sie zuerst die Projektverknüpfungen in Aufgaben und Dokumenten.');
    const next=structuredClone(data);
    if(key==='projects') next.projects=next.projects.filter(r=>r.id!==id);
    if(key==='tasks') next.tasks=next.tasks.filter(r=>r.id!==id);
    if(key==='documents') next.documents=next.documents.filter(r=>r.id!==id);
    return next;
}
const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function documentHtml(doc: BusinessDocument, company: string): string {
    return `<!doctype html><html lang="de"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>@page{size:A4;margin:22mm}body{font:11pt/1.65 Arial;color:#20322d}header{border-bottom:2px solid #315e53;padding-bottom:12px;margin-bottom:36px;color:#315e53}h1{font-size:22pt;line-height:1.2}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}footer{margin-top:40px;color:#65736d;font-size:9pt}</style><header>${escapeHtml(company)}</header><pre>${escapeHtml(doc.recipient)}</pre><h1>${escapeHtml(doc.title)}</h1><pre>${escapeHtml(doc.body)}</pre><footer>${new Date(doc.updated_at).toLocaleDateString('de-DE')}</footer></html>`;
}
