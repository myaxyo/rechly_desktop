// Consistent local-only navigation: no webfonts, remote icons, or account controls.
document.addEventListener('DOMContentLoaded', () => {
  const paths = {
    business:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    calendar:'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h2 M14 14h2 M8 18h2',
    documents:'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',
    projects:'M3 7h7l2-3h9v16H3z M3 10h18',
    tasks:'M9 5h12 M9 12h12 M9 19h12 M3 5l1 1 2-3 M3 12l1 1 2-3 M3 19l1 1 2-3',
    dashboard:'M3 11l9-8 9 8 M5 10v11h14V10 M9 21v-7h6v7',
    invoices:'M5 3h14v18l-3-2-4 2-4-2-3 2z M8 8h8 M8 12h8 M8 16h4',
    offers:'M6 3h12v18H6z M9 7h6 M9 11h6 M9 15h4',
    clients:'M16 21v-3a4 4 0 00-4-4H6a4 4 0 00-4 4v3 M9 10a4 4 0 100-8 4 4 0 000 8 M18 8a3 3 0 010 6 M22 21v-3a4 4 0 00-3-4',
    products:'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 5 9-5 M12 12v9',
    expenses:'M3 6h18v14H3z M3 10h18 M15 15h3',
    datev:'M4 21h16 M6 21V9 M12 21V9 M18 21V9 M3 9h18L12 3z',
    tools:'M5 3h14v18H5z M8 6h8v4H8z M8 14h2 M14 14h2 M8 18h2 M14 18h2',
    settings:'M12 8a4 4 0 100 8 4 4 0 000-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2'
  };
  Object.entries(paths).forEach(([key,path])=>{const icon=document.querySelector(`#nav-${key} .icon`);if(icon)icon.innerHTML=`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;});
  const sidebar=document.querySelector('.sidebar');
  sidebar.insertAdjacentHTML('afterbegin','<div class="app-brand"><span>R</span><div>rechly<small>BUSINESS WORKSPACE</small></div></div>');
  const shortcut=window.rechly?.platform==='darwin'?'⌘':'Strg+';
  document.querySelector('.titlebar-right .btn-primary').textContent=`+ Neue Rechnung (${shortcut}N)`;
  document.querySelector('.sidebar-footer').innerHTML='<div class="vault-status-indicator"><div class="vault-dot"></div><span>Persönlicher Arbeitsplatz</span></div><div>Lokal auf diesem Gerät gespeichert</div>';
  const content=document.getElementById('content-container');
  content.setAttribute('role','main');
  const navigation=document.querySelector('.sidebar');navigation.setAttribute('role','navigation');navigation.setAttribute('aria-label','Hauptnavigation');
});
