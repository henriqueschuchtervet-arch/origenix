(function(){
'use strict';
const LOGO = "assets/origenix-logo-v1.svg";
let supa = null;
try { supa = window.OrigenixSupabase.createClient(); }
catch(e){ console.error('Falha ao iniciar Supabase', e); }

let authMode = 'login';
let currentUser = null;
let selectedIds = new Set();
let docsCache = [];
let currentRole = 'cliente';
let canSignDocuments = false;

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
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = authMode === 'login' ? 'Entrando...' : 'Criando conta...';
  setLoginMsg('');
  try {
    const result = await window.OrigenixAuth.authenticate({
      client: supa,
      mode: authMode === 'login' ? 'login' : 'signup',
      email: validation.email,
      password: validation.password,
    });
    if(!result.ok){ setLoginMsg(result.message, 'error'); return; }
    if(result.requiresEmailConfirmation){
      setLoginMsg('Conta criada! Confirme seu e-mail antes de entrar.', 'ok');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

async function handleLogout(){
  const { error } = await window.OrigenixAuth.signOut(supa);
  if(error) console.error(error);
}

async function onAuthenticated(user){
  if(!user) return;
  const sameUser = currentUser && currentUser.id === user.id;
  currentUser = user;
  document.getElementById('userEmail').textContent = user.email || 'Usuário';
  document.getElementById('loginView').classList.add('is-hidden');
  document.getElementById('mainApp').classList.remove('is-hidden');
  if(!sameUser) await loadDocs();
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
    onUnavailable(){ setLoginMsg('Serviço de autenticação indisponível.', 'error'); },
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

async function loadDocs(){
  setConnStatus(null, 'Conectando ao banco de dados...');

  const [pendentesRes, assinadosRes, perfilRes] = await Promise.all([
    supa.from('documentos').select('*, empresas(nome, rt_nome, rt_crmv)').eq('status', 'gerado').order('criado_em', { ascending:false }),
    supa.from('documentos').select('*, empresas(nome)').eq('status', 'assinado').order('atualizado_em', { ascending:false }).limit(8),
    supa.from('perfis').select('papel').eq('user_id', currentUser.id).maybeSingle()
  ]);

  currentRole = perfilRes.data ? perfilRes.data.papel : 'cliente';
  canSignDocuments = currentRole === 'administrador' || currentRole === 'rt';
  const signButton = document.getElementById('btnSign');
  signButton.title = canSignDocuments ? 'Assinar documentos selecionados' : 'Somente Administrador ou RT pode assinar';
  if(!canSignDocuments) signButton.disabled = true;

  if(pendentesRes.error || assinadosRes.error){
    const error = pendentesRes.error || assinadosRes.error;
    console.error('Falha ao carregar emissão', error);
    setConnStatus('error', 'Não foi possível carregar os documentos. Tente atualizar.');
  } else {
    const roleLabel = currentRole === 'administrador' ? 'Administrador' : currentRole.toUpperCase();
    setConnStatus('ok', canSignDocuments ? 'Conectado como ' + roleLabel : 'Visualização protegida — assinatura restrita a RT/Admin');
  }
  if(perfilRes.error) console.error('Falha ao carregar perfil', perfilRes.error);

  docsCache = pendentesRes.data || [];
  renderDocsList();
  renderLog(assinadosRes.data || []);
}

function renderDocsList(){
  const container = document.getElementById('docsList');
  if(docsCache.length === 0){
    container.innerHTML = '<div class="empty-row">Nenhum documento aguardando assinatura.</div>';
  } else {
    container.innerHTML = docsCache.map(d=>`
      <button class="doc-row ${selectedIds.has(d.id)?'selected':''}" type="button" data-action="toggle-document" data-document-id="${escapeHtml(d.id)}" aria-pressed="${selectedIds.has(d.id)}">
        <div class="doc-check ${selectedIds.has(d.id)?'on':''}">${selectedIds.has(d.id) ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 12l5 5L20 6"/></svg>' : ''}</div>
        <div class="doc-info">
          <b>${escapeHtml(d.titulo || d.tipo || 'Documento')}</b>
          <span>${escapeHtml(d.empresas ? d.empresas.nome : '—')} · ${escapeHtml(d.codigo||'')}</span>
        </div>
        <span class="doc-badge pronto">PRONTO</span>
      </button>
    `).join('');
  }
  updateSummary();
}

function toggleDoc(id){
  if(selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  renderDocsList();
}

function updateSummary(){
  const selected = docsCache.filter(d=>selectedIds.has(d.id));
  document.getElementById('docsCount').textContent = selected.length + ' selecionados';
  document.getElementById('sumCount').textContent = selected.length;
  document.getElementById('btnSign').disabled = selected.length === 0 || !canSignDocuments;

  const summaryEl = document.getElementById('signSummary');
  let rows = `<div class="sum-row"><span class="k">Documentos selecionados</span><span class="v">${selected.length}</span></div>`;
  if(selected.length > 0){
    const empresas = [...new Set(selected.map(d=>d.empresas ? d.empresas.nome : '—'))];
    const rts = [...new Set(selected.map(d=>d.empresas ? d.empresas.rt_nome : null).filter(Boolean))];
    rows += `<div class="sum-row"><span class="k">Estabelecimento(s)</span><span class="v">${escapeHtml(empresas.join(', '))}</span></div>`;
    rows += `<div class="sum-row"><span class="k">RT responsável</span><span class="v">${escapeHtml(rts.join(', ') || '—')}</span></div>`;
  }
  summaryEl.innerHTML = rows;
}

async function assinarSelecionados(){
  const ids = [...selectedIds];
  if(ids.length === 0) return;
  if(!canSignDocuments){
    setConnStatus('error', 'Somente Administrador ou RT pode assinar documentos.');
    return;
  }
  const confirmation = window.OrigenixUI?.openFormDialog
    ? await window.OrigenixUI.openFormDialog({
        title:'Confirmar assinatura digital',
        description:`A assinatura de ${ids.length} documento(s) ficará registrada na trilha de auditoria.`,
        confirmLabel:'Assinar documentos',
        cancelLabel:'Cancelar'
      })
    : window.confirm(`A assinatura de ${ids.length} documento(s) ficará registrada na trilha de auditoria.`);
  if(!confirmation)return;

  const btn = document.getElementById('btnSign');
  window.OrigenixUI?.setButtonLoading(btn,true,'Assinando...');

  try {
    const { error } = await supa.from('documentos')
      .update({ status: 'assinado', atualizado_em: new Date().toISOString() })
      .in('id', ids);
    if(error){
      console.error('Falha ao assinar', error);
      setConnStatus('error', error.code === '42501'
        ? 'Seu perfil não possui permissão para assinar.'
        : 'Não foi possível assinar os documentos. Tente novamente.');
      return;
    }
    selectedIds.clear();
    await loadDocs();
    setConnStatus('ok', `${ids.length} documento(s) assinado(s) com sucesso.`);
  } catch(error){
    console.error(error);
    setConnStatus('error', 'Falha de conexão durante a assinatura.');
  } finally {
    window.OrigenixUI?.setButtonLoading(btn,false);
    btn.disabled = selectedIds.size === 0 || !canSignDocuments;
  }
}

function renderLog(assinados){
  const container = document.getElementById('logList');
  if(assinados.length === 0){
    container.innerHTML = '<div class="empty-row">Nenhuma assinatura registrada ainda.</div>';
    return;
  }
  container.innerHTML = assinados.map(d=>`
    <div class="log-item">
      <div class="log-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12l5 5L20 6"/></svg></div>
      <p><b>${escapeHtml(d.titulo || d.tipo || 'Documento')}</b> assinado — ${escapeHtml(d.empresas ? d.empresas.nome : '—')}.<span class="t">${timeAgo(d.atualizado_em)}</span></p>
    </div>
  `).join('');
}

function handleEmissionAction(event){
  const target=event.target.closest('[data-action]');
  if(!target||target.disabled)return;
  switch(target.dataset.action){
    case 'auth-login': setAuthMode('login'); break;
    case 'auth-signup': setAuthMode('signup'); break;
    case 'auth-submit': handleAuth(); break;
    case 'logout': handleLogout(); break;
    case 'sign-selected': assinarSelecionados(); break;
    case 'toggle-document': toggleDoc(target.dataset.documentId); break;
  }
}

document.addEventListener('click',handleEmissionAction);
document.getElementById('auth_password').addEventListener('keydown',event=>{
  if(event.key==='Enter')handleAuth();
});

initAuth();

})();
