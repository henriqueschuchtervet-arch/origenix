(function () {
  "use strict";
let supa = null;
try { supa = window.OrigenixSupabase.createClient(); }
catch(e){ console.error('Falha ao iniciar Supabase', e); }

let authMode = 'login';
let currentUser = null;

function setAuthMode(mode){
  authMode = mode;
  document.querySelectorAll('.login-tab').forEach(el=>el.classList.toggle('active', el.dataset.mode===mode));
  document.getElementById('btnAuth').textContent = mode==='login' ? 'Entrar' : 'Criar Conta';
  document.getElementById('loginMsg').textContent = '';
}

function setLoginMsg(msg, type){
  const el = document.getElementById('loginMsg');
  el.textContent = msg;
  el.className = 'login-msg' + (type ? ' '+type : '');
}



async function handleAuth(){
  const emailInput = document.getElementById('auth_email');
  const passwordInput = document.getElementById('auth_password');
  const validation = window.OrigenixAuth.normalizeCredentials(emailInput.value, passwordInput.value);
  if(!validation.ok){
    setLoginMsg(validation.message, 'error');
    (validation.field === 'email' ? emailInput : passwordInput).focus();
    return;
  }

  const btn = document.getElementById('btnAuth');
  window.OrigenixUI?.setButtonLoading(btn, true, authMode === 'login' ? 'Entrando...' : 'Criando conta...');
  setLoginMsg('');

  try {
    const result = await window.OrigenixAuth.authenticate({
      client: supa,
      mode: authMode === 'login' ? 'login' : 'signup',
      email: validation.email,
      password: validation.password,
      emailRedirectTo: authMode === 'signup'
        ? new URL('origenix-dashboard-v3.html', location.href).href
        : undefined,
    });
    if(!result.ok){ setLoginMsg(result.message, 'error'); return; }
    if(result.requiresEmailConfirmation){
      passwordInput.value = '';
      setLoginMsg('Conta criada! Confira seu e-mail para confirmar o acesso.', 'ok');
    }
  } finally {
    window.OrigenixUI?.setButtonLoading(btn, false);
  }
}

async function handleLogout(){
  const { error } = await window.OrigenixAuth.signOut(supa);
  if(error){ console.error(error); return; }
  currentUser = null;
  document.getElementById('mainApp').classList.add('is-hidden');
  document.getElementById('loginView').classList.remove('is-hidden');
  document.getElementById('auth_password').value = '';
  document.getElementById('auth_email').focus();
}

async function onAuthenticated(user){
  if(!user) return;
  const sameUser = currentUser && currentUser.id === user.id;
  currentUser = user;
  document.getElementById('userEmail').textContent = user.email || 'Usuário';
  document.getElementById('loginView').classList.add('is-hidden');
  document.getElementById('mainApp').classList.remove('is-hidden');
  if(!sameUser) await loadDashboard();
}

async function initAuth(){
  await window.OrigenixAuth.observeSession({
    client: supa,
    onAuthenticated,
    onSignedOut(){
      currentUser = null;
      document.getElementById('mainApp').classList.add('is-hidden');
      document.getElementById('loginView').classList.remove('is-hidden');
    },
    onMissingSession(){
      document.getElementById('loginView').classList.remove('is-hidden');
      document.getElementById('mainApp').classList.add('is-hidden');
    },
    onUnavailable(){ setLoginMsg('Não foi possível conectar ao serviço de autenticação.', 'error'); },
    onError(error){ console.error(error); },
  });
}

function setConnStatus(state, msg){
  const el = document.getElementById('connStatus');
  el.classList.remove('ok','error');
  if(state) el.classList.add(state);
  document.getElementById('connMsg').textContent = msg;
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str||'';
  return d.innerHTML;
}

function timeAgo(dateStr){
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if(diff < 60) return 'agora mesmo';
  if(diff < 3600) return `há ${Math.floor(diff/60)} min`;
  if(diff < 86400) return `há ${Math.floor(diff/3600)}h`;
  return `há ${Math.floor(diff/86400)}d`;
}

function operationalRow(title,meta,time,critical=false){
  return `<div class="operational-row"><span class="operational-marker ${critical?'critical':''}"></span><div class="operational-info"><b>${escapeHtml(title)}</b><span>${escapeHtml(meta)}</span></div><div class="operational-time">${escapeHtml(time)}</div></div>`;
}

function formatDashboardDeadline(value){
  if(!value) return 'Sem prazo';
  const date=new Date(value); const diff=Math.ceil((date-Date.now())/86400000);
  if(diff<0) return 'Vencida há '+Math.abs(diff)+'d';
  if(diff===0) return 'Hoje';
  if(diff===1) return 'Amanhã';
  return 'Em '+diff+' dias';
}

async function loadDashboard(){
  setConnStatus(null,'Atualizando indicadores operacionais...');
  const perfil=await supa.from('perfis').select('papel').eq('user_id',currentUser.id).maybeSingle();
  const isAdmin=perfil.data?.papel==='administrador';
  const today=new Date(); today.setHours(0,0,0,0);
  const nextWeek=new Date(today); nextWeek.setDate(nextWeek.getDate()+7);
  const taskFields='id,empresa_id,titulo,status,prioridade,prazo,empresas(nome)';
  const documentFields='id,titulo,tipo,codigo,status,criado_em,empresas(nome)';
  const requests=[
    supa.from('empresas').select('id,nome,municipio,tipo_estabelecimento,rt_nome,inspecao',{count:'exact'}).order('criado_em',{ascending:false}).limit(8),
    supa.from('documentos').select(documentFields,{count:'exact'}).order('criado_em',{ascending:false}).limit(8),
    supa.from('tarefas').select(taskFields,{count:'exact'}).in('status',['pendente','em_andamento']).gte('prazo',today.toISOString()).lt('prazo',nextWeek.toISOString()).order('prazo').limit(8),
    supa.from('tarefas').select(taskFields,{count:'exact'}).in('status',['pendente','em_andamento']).lt('prazo',new Date().toISOString()).order('prazo').limit(6),
    supa.from('documentos').select(documentFields,{count:'exact'}).eq('status','em_revisao').order('criado_em').limit(6)
  ];
  if(isAdmin) requests.push(
    supa.from('leads').select('id,nome,empresa,telefone,email,status,criado_em',{count:'exact'}).order('criado_em',{ascending:false}).limit(8),
    supa.from('leads').select('id',{count:'exact',head:true}).or('status.eq.novo,status.is.null')
  );
  const [empresasRes,documentosRes,agendaRes,overdueRes,reviewRes,leadsRes={data:[],count:0},novosRes={count:0}]=await Promise.all(requests);
  const results=[perfil,empresasRes,documentosRes,agendaRes,overdueRes,reviewRes,leadsRes,novosRes];
  if(results.some(result=>result?.error)){
    results.filter(result=>result?.error).forEach(result=>console.error('Falha ao carregar dashboard',result.error));
    setConnStatus('error','Alguns dados não foram carregados. Tente atualizar.');
  }else setConnStatus('ok',isAdmin?'Conectado como Administrador':'Conectado com acesso protegido');

  const empresas=empresasRes.data||[],documentos=documentosRes.data||[],agenda=agendaRes.data||[],overdue=overdueRes.data||[],reviews=reviewRes.data||[],leads=leadsRes.data||[];
  const alertCount=(overdueRes.count||0)+(reviewRes.count||0);
  document.getElementById('kpiEmpresas').textContent=empresasRes.count??0;
  document.getElementById('sidebarClientes').textContent=empresasRes.count??0;
  document.getElementById('kpiDocumentos').textContent=documentosRes.count??0;
  document.getElementById('kpiTarefasVencidas').textContent=overdueRes.count??0;
  document.getElementById('kpiDocumentosRevisao').textContent=reviewRes.count??0;
  document.getElementById('sidebarTasks').textContent=(agendaRes.count||0)+(overdueRes.count||0);
  document.getElementById('sidebarAlerts').textContent=alertCount;
  document.getElementById('topAlertDot').classList.toggle('is-hidden', !alertCount);

  document.getElementById('empresasTableBody').innerHTML=empresas.length?empresas.map(e=>`<tr><td class="client-cell"><b>${escapeHtml(e.nome)}</b><span>${escapeHtml(e.municipio||'—')}</span></td><td>${escapeHtml(e.tipo_estabelecimento||'—')}</td><td>${escapeHtml(e.rt_nome||'—')}</td><td>${escapeHtml(e.inspecao||'—')}</td></tr>`).join(''):'<tr><td colspan="4" class="empty-row">Nenhum estabelecimento cadastrado. <a href="origenix-sistema-login.html?view=new">Cadastrar agora</a></td></tr>';
  document.getElementById('documentosList').innerHTML=documentos.length?documentos.map(d=>`<a class="lead-row" href="origenix-sistema-login.html?view=documents"><div class="info"><b>${escapeHtml(d.titulo||d.tipo||'Documento')}</b><span>${escapeHtml(d.empresas?.nome||'—')} · ${escapeHtml(d.codigo||'')}</span></div><div class="time2">${timeAgo(d.criado_em)}</div></a>`).join(''):'<div class="empty-row">Nenhum documento emitido ainda.</div>';
  document.getElementById('agendaList').innerHTML=agenda.length?agenda.map(task=>operationalRow(task.titulo||'Tarefa',task.empresas?.nome||'Empresa indisponível',formatDashboardDeadline(task.prazo),task.prioridade==='critica')).join(''):'<div class="empty-row">Nenhum prazo nos próximos 7 dias. <a href="origenix-sistema-login.html?view=tasks">Criar tarefa</a></div>';
  const alerts=[...overdue.map(task=>({title:task.titulo||'Tarefa vencida',meta:task.empresas?.nome||'Empresa indisponível',time:formatDashboardDeadline(task.prazo),critical:true})),...reviews.map(doc=>({title:doc.titulo||doc.tipo||'Documento em revisão',meta:doc.empresas?.nome||'Empresa indisponível',time:'Revisão',critical:false}))];
  document.getElementById('criticalAlertsList').innerHTML=alerts.length?alerts.slice(0,10).map(item=>operationalRow(item.title,item.meta,item.time,item.critical)).join(''):'<div class="empty-row">Nenhum alerta crítico no momento.</div>';
  document.getElementById('leadsList').innerHTML=!isAdmin?'<div class="empty-row">Disponível para administradores.</div>':leads.length?leads.map(l=>`<div class="lead-row"><div class="info"><b>${escapeHtml(l.nome)}</b><span>${escapeHtml(l.empresa||'—')} · ${escapeHtml(l.telefone||l.email||'sem contato')}</span></div><div class="lead-status"><span class="lead-badge ${l.status==='contatado'?'contatado':'novo'}">${(l.status||'novo').toUpperCase()}</span><div class="time2 lead-time">${timeAgo(l.criado_em)}</div></div></div>`).join(''):'<div class="empty-row">Nenhum lead recebido ainda.</div>';
}


function bindDashboardEvents(){
  document.getElementById('loginModeButton').addEventListener('click', () => setAuthMode('login'));
  document.getElementById('signupModeButton').addEventListener('click', () => setAuthMode('signup'));
  document.getElementById('btnAuth').addEventListener('click', handleAuth);
  document.getElementById('auth_password').addEventListener('keydown', event => { if(event.key === 'Enter') handleAuth(); });
  document.getElementById('logoutButton').addEventListener('click', handleLogout);
  document.getElementById('notificationsButton').addEventListener('click', () => location.assign('origenix-sistema-login.html?view=notifications'));
}

bindDashboardEvents();
initAuth();

})();
