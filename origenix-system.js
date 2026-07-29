const LOGO = "assets/origenix-logo-v1.svg";

let supa = null;
try {
  supa = window.OrigenixSupabase.createClient();
} catch (e) {
  console.error('Falha ao iniciar cliente Supabase', e);
}

function showToast(msg, isError){
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 3200);
}

function setConnStatus(state, msg){
  const el = document.getElementById('connStatus');
  el.classList.remove('ok','error');
  if(state) el.classList.add(state);
  document.getElementById('connMsg').textContent = msg;
}

// ---- AUTENTICAÇÃO ----
let authMode = 'login';
let currentUser = null;
let currentRole = 'cliente';
let currentProfileName = 'Usuário';
let canCreateDocuments = false;
let canDeleteCompanies = false;
let editingClientId = null;
let clientCache = [];
let clientPage = 0;
let clientTotal = 0;
let clientSearchTimer = null;
let clientRequestSequence = 0;
const CLIENT_PAGE_SIZE = 20;
let documentCache = [];
let documentPage = 0;
let documentTotal = 0;
let documentSearchTimer = null;
let documentRequestSequence = 0;
const DOCUMENT_PAGE_SIZE = 20;
let documentDossierReturnFocus = null;
let auditPage = 0;
let auditTotal = 0;
let auditSearchTimer = null;
let auditRequestSequence = 0;
let auditCompaniesLoaded = false;
const AUDIT_PAGE_SIZE = 25;
let notificationItems = [];
let notificationSearchTimer = null;
let notificationRequestSequence = 0;
let taskCache = [];
let taskPage = 0;
let taskTotal = 0;
let taskSearchTimer = null;
let taskRequestSequence = 0;
let taskView = 'lista';
let taskAgendaMonth = new Date(new Date().getFullYear(),new Date().getMonth(),1);
let taskCompaniesLoaded = false;
const TASK_PAGE_SIZE = 25;

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

async function aplicarRotaInicial(){
  const view = new URLSearchParams(location.search).get('view') || 'clients';
  if(view === 'new'){
    await renderClientList();
    novoCadastro();
    return;
  }
  if(view === 'documents'){
    switchTab('documentos');
    return;
  }
  if(view === 'audit'){
    switchTab('auditoria');
    return;
  }
  if(view === 'notifications'){
    switchTab('notificacoes');
    return;
  }
  if(view === 'tasks'){
    switchTab('tarefas');
    return;
  }
  switchTab('clientes');
}

async function onAuthenticated(user){
  if(!user) return;
  const sameUser = currentUser && currentUser.id === user.id;
  currentUser = user;
  document.getElementById('userEmail').textContent = user.email || 'Usuário';
  document.getElementById('loginView').classList.add('is-hidden');
  document.getElementById('mainView').classList.remove('is-hidden');

  const { data: perfil, error } = await supa.from('perfis').select('papel,nome').eq('user_id', user.id).maybeSingle();
  if(error) console.error('Falha ao carregar perfil', error);
  currentRole = perfil ? perfil.papel : 'cliente';
  currentProfileName = perfil?.nome || user.email || 'Usuário';
  canCreateDocuments = ['administrador','rt','consultor'].includes(currentRole);
  canDeleteCompanies = currentRole === 'administrador';
  document.getElementById('newTaskButton').classList.toggle('is-hidden', !canCreateDocuments);

  if(!sameUser){
    await testConnection();
    await aplicarRotaInicial();
    atualizarBadgeNotificacoes();
  }
}

async function initAuth(){
  await window.OrigenixAuth.observeSession({
    client: supa,
    onAuthenticated,
    onSignedOut(){
      currentUser = null;
      document.getElementById('mainView').classList.add('is-hidden');
      document.getElementById('loginView').classList.remove('is-hidden');
    },
    onMissingSession(){
      document.getElementById('loginView').classList.remove('is-hidden');
      document.getElementById('mainView').classList.add('is-hidden');
    },
    onUnavailable(){ setLoginMsg('Serviço de autenticação indisponível.', 'error'); },
    onError(error){ console.error(error); },
  });
}

async function testConnection(){
  if(!supa){ setConnStatus('error', 'Biblioteca do Supabase não carregou (verifique sua internet).'); return; }
  const { error } = await supa.from('empresas').select('id', { count: 'exact', head: true });
  if(error){
    setConnStatus('error', 'Falha ao conectar: ' + error.message);
  } else {
    setConnStatus('ok', 'Conectado ao banco de dados ORIGENIX');
  }
}

const DOCUMENT_FIELDS = 'id,empresa_id,titulo,tipo,status,codigo,versao,uuid_documento,hash_sha256,criado_em,created_at,atualizado_em,empresas(nome)';

async function getDocuments(){
  const status = document.getElementById('documentStatusFilter')?.value || 'todos';
  const rawSearch = (document.getElementById('documentSearch')?.value || '').trim();
  const search = rawSearch.replace(/[%,()_]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const from = documentPage * DOCUMENT_PAGE_SIZE;
  const to = from + DOCUMENT_PAGE_SIZE - 1;
  const requestSequence = ++documentRequestSequence;
  let query = supa.from('documentos')
    .select(DOCUMENT_FIELDS, { count:'exact' })
    .order('criado_em', { ascending:false, nullsFirst:false })
    .range(from, to);
  if(status !== 'todos') query = query.eq('status', status);
  if(search){
    const pattern = `%${search}%`;
    query = query.or(`titulo.ilike.${pattern},tipo.ilike.${pattern},codigo.ilike.${pattern}`);
  }
  const { data, error, count } = await query;
  if(requestSequence !== documentRequestSequence) return null;
  if(error){ console.error(error); showToast('Não foi possível carregar os documentos.', true); return []; }
  documentCache = data || [];
  documentTotal = count || 0;
  return documentCache;
}

function agendarBuscaDocumentos(){
  window.clearTimeout(documentSearchTimer);
  documentSearchTimer = window.setTimeout(reiniciarListaDocumentos, 320);
}

function reiniciarListaDocumentos(){
  documentPage = 0;
  renderDocumentList();
}

function mudarPaginaDocumentos(nextPage){
  const pageCount = Math.max(1, Math.ceil(documentTotal / DOCUMENT_PAGE_SIZE));
  if(nextPage < 0 || nextPage >= pageCount || nextPage === documentPage) return;
  documentPage = nextPage;
  renderDocumentList();
  document.getElementById('documentSearch')?.focus({ preventScroll:true });
}

function formatDocumentDate(documento){
  const raw = documento.criado_em || documento.created_at;
  if(!raw) return 'Data não informada';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleDateString('pt-BR');
}

async function copiarCodigoDocumento(encodedCode){
  const code = decodeURIComponent(encodedCode || '');
  if(!code){ showToast('Documento sem código disponível.', true); return; }
  try{
    await navigator.clipboard.writeText(code);
    showToast('Código copiado.');
  }catch{
    showToast('Não foi possível copiar automaticamente.', true);
  }
}

async function abrirEmpresaDoDocumento(empresaId){
  let cliente = clientCache.find(item=>item.id===empresaId);
  if(!cliente){
    const { data, error } = await supa.from('empresas').select(EMPRESA_FIELDS).eq('id', empresaId).single();
    if(error || !data){ showToast('Estabelecimento indisponível para seu perfil.', true); return; }
    cliente = data;
    clientCache.push(cliente);
  }
  abrirDetalhesCliente(cliente.id);
}

function normalizarStatusDocumento(status){
  return ['gerado','em_revisao','assinado','arquivado'].includes(status) ? status : 'gerado';
}

function urlSeguraAnexo(rawUrl){
  try{
    const parsed = new URL(rawUrl, location.origin);
    return parsed.protocol === 'https:' ? parsed.href : null;
  }catch{
    return null;
  }
}

async function resolverUrlAnexo(attachment){
  const legacyUrl = urlSeguraAnexo(attachment.url);
  if(legacyUrl) return {...attachment, signed_url:legacyUrl};
  if(!attachment.url) return {...attachment, signed_url:null};
  const { data, error } = await supa.storage.from('documentos').createSignedUrl(attachment.url, 300);
  return {...attachment, signed_url:error ? null : data?.signedUrl};
}

async function enviarAnexoDocumento(documentId, file, button){
  if(!file) return;
  const allowedTypes = new Set(['application/pdf','image/jpeg','image/png','image/webp','text/plain','text/csv','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
  if(file.size > 10485760){ showToast('O arquivo deve ter no máximo 10 MB.', true); return; }
  if(!allowedTypes.has(file.type)){ showToast('Formato não permitido. Use PDF, imagem, texto, Word ou Excel.', true); return; }
  const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'-').replace(/-+/g,'-').slice(-120) || 'anexo';
  const objectPath = documentId + '/' + crypto.randomUUID() + '-' + safeName;
  if(button) OrigenixUI?.setButtonLoading?.(button, true, 'Enviando...');
  try{
    const uploadResult = await supa.storage.from('documentos').upload(objectPath, file, { cacheControl:'3600', upsert:false });
    if(uploadResult.error) throw uploadResult.error;
    const attachmentResult = await supa.from('anexos').insert({documento_id:documentId,nome_arquivo:file.name,url:objectPath});
    if(attachmentResult.error){
      await supa.storage.from('documentos').remove([objectPath]);
      throw attachmentResult.error;
    }
    showToast('Anexo enviado com segurança.');
    await abrirDossieDocumento(documentId, false);
  }catch(error){
    console.error('Falha ao enviar anexo:', error);
    showToast(error?.message || 'Não foi possível enviar o anexo.', true);
  }finally{
    if(button) OrigenixUI?.setButtonLoading?.(button, false);
  }
}

async function excluirAnexoDocumento(documentId, attachmentId, encodedPath, encodedName, button){
  if(!canCreateDocuments){ showToast('Seu perfil não possui permissão para excluir anexos.', true); return; }
  const objectPath = decodeURIComponent(encodedPath || '');
  const fileName = decodeURIComponent(encodedName || 'Anexo');
  const confirmed = window.OrigenixUI?.openFormDialog
    ? await window.OrigenixUI.openFormDialog({
        title:'Excluir anexo?',
        description:fileName + ' será removido permanentemente. A ação ficará registrada na auditoria.',
        fields:[], confirmLabel:'Excluir anexo', danger:true
      })
    : (window.confirm('Excluir permanentemente ' + fileName + '?') ? {} : null);
  if(!confirmed) return;
  OrigenixUI?.setButtonLoading?.(button, true, 'Excluindo...');
  try{
    const isPrivateObject = objectPath && !urlSeguraAnexo(objectPath);
    if(isPrivateObject){
      if(!objectPath.startsWith(documentId + '/') || objectPath.includes('..')) throw new Error('Caminho de anexo inválido.');
      const storageResult = await supa.storage.from('documentos').remove([objectPath]);
      if(storageResult.error) throw storageResult.error;
    }
    const { error } = await supa.rpc('excluir_anexo_auditado', { anexo_id:attachmentId });
    if(error) throw error;
    showToast('Anexo excluído e ação registrada.');
    await abrirDossieDocumento(documentId, false);
  }catch(error){
    console.error('Falha ao excluir anexo:', error);
    showToast(error?.message || 'Não foi possível excluir o anexo.', true);
  }finally{
    OrigenixUI?.setButtonLoading?.(button, false);
  }
}

async function abrirDossieDocumento(id, captureFocus=true){
  const documento = documentCache.find(item=>item.id===id);
  if(!documento){ showToast('Documento não encontrado. Atualize a biblioteca.', true); return; }
  if(captureFocus) documentDossierReturnFocus = document.activeElement;
  const overlay = document.getElementById('documentDossierOverlay');
  const body = document.getElementById('documentDossierBody');
  document.getElementById('documentDossierTitle').textContent = documento.titulo || documento.tipo || 'Documento';
  body.innerHTML = '<div class="empty-state">Carregando histórico e anexos...</div>';
  overlay.classList.add('show');
  document.body.classList.add('ox-scroll-lock');
  if(captureFocus) overlay.querySelector('.client-detail-close').focus();

  const [versionsResult, attachmentsResult] = await Promise.all([
    supa.from('documento_versoes').select('id,numero_versao,codigo,status,hash_sha256,conteudo,criado_por,criado_em').eq('documento_id', id).order('numero_versao', { ascending:false }),
    supa.from('anexos').select('id,nome_arquivo,url,created_at').eq('documento_id', id).order('created_at', { ascending:false })
  ]);
  if(!overlay.classList.contains('show')) return;
  if(versionsResult.error || attachmentsResult.error){
    body.innerHTML = '<div class="empty-state">Não foi possível carregar o dossiê. Tente novamente.</div>';
    showToast('Falha ao carregar o dossiê documental.', true);
    return;
  }
  const versions = versionsResult.data || [];
  const attachments = await Promise.all((attachmentsResult.data || []).map(resolverUrlAnexo));
  const hash = documento.hash_sha256 || versions[0]?.hash_sha256 || '';
  const companyName = documento.empresas?.nome || 'Estabelecimento';
  const dossierStatus = normalizarStatusDocumento(documento.status);

  body.innerHTML = `
    <div class="dossier-identity">
      <div class="dossier-version-head"><span class="dossier-code">${escapeHtml(documento.codigo||'Sem código')}</span><small class="document-status ${dossierStatus}">${escapeHtml(dossierStatus.replace('_',' '))}</small></div>
      <span class="dossier-hash">UUID: ${escapeHtml(documento.uuid_documento||'Não informado')}</span>
      <span class="dossier-hash">SHA-256: ${escapeHtml(hash||'Não informado')}</span>
    </div>
    <div class="client-detail-grid">
      <div class="client-detail-field"><span>Estabelecimento</span><b>${escapeHtml(companyName)}</b></div>
      <div class="client-detail-field"><span>Tipo</span><b>${escapeHtml(documento.tipo||'Não informado')}</b></div>
      <div class="client-detail-field"><span>Versão atual</span><b>${escapeHtml(documento.versao||('v'+(versions[0]?.numero_versao||1)+'.0'))}</b></div>
      <div class="client-detail-field"><span>Emissão</span><b>${formatDocumentDate(documento)}</b></div>
    </div>
    <div class="client-detail-actions">
      <button class="mini-btn" type="button" data-action="copy-document-code" data-value="${encodeURIComponent(documento.codigo||'')}">Copiar código</button>
      ${hash ? `<button class="mini-btn" type="button" data-action="copy-document-hash" data-value="${encodeURIComponent(hash)}">Copiar hash</button>` : ''}
      <button class="mini-btn edit" type="button" data-action="dossier-company" data-company-id="${escapeHtml(documento.empresa_id)}">Ver empresa</button>
    </div>
    <section class="client-detail-section">
      <h3>Histórico de versões (${versions.length})</h3>
      ${versions.length ? `<div class="dossier-timeline">${versions.map(version=>`
        <article class="dossier-version">
          <div class="dossier-version-head"><b>Versão ${version.numero_versao}</b><small class="document-status ${normalizarStatusDocumento(version.status)}">${escapeHtml(normalizarStatusDocumento(version.status).replace('_',' '))}</small></div>
          <p>${new Date(version.criado_em).toLocaleString('pt-BR')} · Código ${escapeHtml(version.codigo)}</p>
          ${version.hash_sha256 ? `<p>SHA-256: ${escapeHtml(version.hash_sha256)}</p>` : ''}
        </article>`).join('')}</div>` : '<div class="empty-state empty-padded">Nenhuma versão registrada.</div>'}
    </section>
    <section class="client-detail-section">
      <div class="dossier-version-head"><h3>Anexos (${attachments.length})</h3>${canCreateDocuments ? `<div><input id="documentAttachmentInput" type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx"><button id="documentAttachmentButton" class="mini-btn emit" type="button" data-action="upload-attachment">＋ Enviar anexo</button></div>` : ''}</div>
      ${canCreateDocuments ? '<p class="helper-text">PDF, imagem, texto, Word ou Excel · máximo de 10 MB · acesso privado.</p>' : ''}
      ${attachments.length ? attachments.map(attachment=>`<div class="dossier-attachment"><div>${attachment.signed_url ? `<a href="${escapeHtml(attachment.signed_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(attachment.nome_arquivo||'Abrir anexo')}</a>` : `<b>${escapeHtml(attachment.nome_arquivo||'Anexo indisponível')}</b>`}<span>${attachment.created_at ? new Date(attachment.created_at).toLocaleDateString('pt-BR') : 'Sem data'}</span></div>${canCreateDocuments ? `<button class="mini-btn danger" type="button" data-action="delete-attachment" data-document-id="${escapeHtml(id)}" data-attachment-id="${escapeHtml(attachment.id)}" data-path="${encodeURIComponent(attachment.url||'')}" data-name="${encodeURIComponent(attachment.nome_arquivo||'Anexo')}">Excluir</button>` : ''}</div>`).join('') : '<div class="empty-state empty-padded">Nenhum anexo relacionado.</div>'}
    </section>`;
  const input = document.getElementById('documentAttachmentInput');
  if(input) input.addEventListener('change', ()=>{
    const button = document.getElementById('documentAttachmentButton');
    enviarAnexoDocumento(id, input.files?.[0], button);
    input.value = '';
  }, {once:true});
}

async function copiarHashDocumento(encodedHash){
  const hash = decodeURIComponent(encodedHash || '');
  if(!hash) return;
  try{ await navigator.clipboard.writeText(hash); showToast('Hash SHA-256 copiado.'); }
  catch{ showToast('Não foi possível copiar automaticamente.', true); }
}

function fecharDossieDocumento(){
  document.getElementById('documentDossierOverlay').classList.remove('show');
  document.body.classList.remove('ox-scroll-lock');
  if(documentDossierReturnFocus instanceof HTMLElement) documentDossierReturnFocus.focus();
  documentDossierReturnFocus = null;
}

document.addEventListener('keydown', event=>{
  if(event.key === 'Escape' && document.getElementById('documentDossierOverlay')?.classList.contains('show')){
    event.preventDefault();
    fecharDossieDocumento();
  }
});

function renderDocumentRows(list){
  const container = document.getElementById('documentList');
  const summary = document.getElementById('documentResultsSummary');
  const pagination = document.getElementById('documentPagination');
  const first = documentTotal ? documentPage * DOCUMENT_PAGE_SIZE + 1 : 0;
  const last = Math.min((documentPage + 1) * DOCUMENT_PAGE_SIZE, documentTotal);
  const pageCount = Math.max(1, Math.ceil(documentTotal / DOCUMENT_PAGE_SIZE));
  document.getElementById('documentCount').textContent = documentTotal;
  summary.textContent = documentTotal
    ? `Exibindo ${first}–${last} de ${documentTotal} documento${documentTotal===1?'':'s'}`
    : 'Nenhum documento encontrado';
  if(!list.length){
    container.innerHTML = '<div class="empty-state">Nenhum documento corresponde aos filtros atuais.</div>';
  }else{
    container.innerHTML = list.map(doc=>{
      const status = ['gerado','em_revisao','assinado','arquivado'].includes(doc.status) ? doc.status : 'gerado';
      const companyName = doc.empresas?.nome || 'Estabelecimento';
      return `<article class="document-row">
        <div class="document-row-main">
          <b>${escapeHtml(doc.titulo||doc.tipo||'Documento sem título')}</b>
          <span>${escapeHtml(companyName)} · ${escapeHtml(doc.codigo||'Sem código')} · ${escapeHtml(doc.versao||'v1.0')} · ${formatDocumentDate(doc)}</span>
        </div>
        <div class="document-row-meta">
          <small class="document-status ${status}">${escapeHtml(status.replace('_',' '))}</small>
          <button class="mini-btn emit" type="button" data-action="open-dossier" data-document-id="${escapeHtml(doc.id)}">Abrir dossiê</button>
          <button class="mini-btn" type="button" data-action="copy-document-code" data-value="${encodeURIComponent(doc.codigo||'')}">Copiar código</button>
          <button class="mini-btn edit" type="button" data-action="open-document-company" data-company-id="${escapeHtml(doc.empresa_id)}">Ver empresa</button>
        </div>
      </article>`;
    }).join('');
  }
  pagination.innerHTML = pageCount > 1 ? `
    <button class="mini-btn" type="button" data-action="documents-page" data-page="${documentPage-1}" ${documentPage===0?'disabled':''}>← Anterior</button>
    <span>Página <b>${documentPage+1}</b> de ${pageCount}</span>
    <button class="mini-btn" type="button" data-action="documents-page" data-page="${documentPage+1}" ${documentPage>=pageCount-1?'disabled':''}>Próxima →</button>` : '';
}

async function renderDocumentList(){
  const container = document.getElementById('documentList');
  container.setAttribute('aria-busy','true');
  container.innerHTML = '<div class="empty-state">Carregando documentos...</div>';
  const list = await getDocuments();
  container.setAttribute('aria-busy','false');
  if(list === null) return;
  renderDocumentRows(list);
}

function agendarBuscaTarefas(){
  window.clearTimeout(taskSearchTimer);
  taskSearchTimer=window.setTimeout(reiniciarTarefas,320);
}

function reiniciarTarefas(){ taskPage=0; renderTasks(); }

function alterarVisualizacaoTarefas(view){
  taskView=view==='agenda'?'agenda':'lista';
  document.getElementById('taskListViewButton').classList.toggle('active',taskView==='lista');
  document.getElementById('taskAgendaViewButton').classList.toggle('active',taskView==='agenda');
  document.getElementById('taskAgendaNav').classList.toggle('is-hidden', taskView!=='agenda');
  document.getElementById('taskPagination').classList.toggle('is-hidden', taskView!=='lista');
  taskPage=0;
  renderTasks();
}

function mudarMesAgenda(offset){
  taskAgendaMonth=new Date(taskAgendaMonth.getFullYear(),taskAgendaMonth.getMonth()+offset,1);
  renderTasks();
}

function mudarPaginaTarefas(page){
  const pages=Math.max(1,Math.ceil(taskTotal/TASK_PAGE_SIZE));
  if(page<0||page>=pages||page===taskPage) return;
  taskPage=page;
  renderTasks();
}

async function carregarEmpresasTarefas(){
  if(taskCompaniesLoaded) return;
  const {data,error}=await supa.from('empresas').select('id,nome').eq('ativo',true).order('nome').limit(500);
  if(error){ console.error(error); return; }
  const select=document.getElementById('taskCompanyFilter');
  for(const company of data||[]){ const option=document.createElement('option'); option.value=company.id; option.textContent=company.nome; select.appendChild(option); }
  taskCompaniesLoaded=true;
}

function filtrosTarefas(){
  const raw=(document.getElementById('taskSearch')?.value||'').trim();
  return {search:raw.replace(/[%,()_]/g,' ').replace(/\s+/g,' ').trim().slice(0,80),company:document.getElementById('taskCompanyFilter')?.value||'todos',status:document.getElementById('taskStatusFilter')?.value||'abertas',priority:document.getElementById('taskPriorityFilter')?.value||'todos'};
}

async function getTasks(){
  const sequence=++taskRequestSequence;
  const filters=filtrosTarefas();
  let query=supa.from('tarefas').select('id,empresa_id,titulo,descricao,status,responsavel,prioridade,prazo,concluida_em,created_at,atualizado_em,criado_por,empresas(nome)',{count:'exact'}).order('prazo',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false});
  if(filters.search) query=query.or(`titulo.ilike.%${filters.search}%,descricao.ilike.%${filters.search}%`);
  if(filters.company!=='todos') query=query.eq('empresa_id',filters.company);
  if(filters.status==='abertas') query=query.in('status',['pendente','em_andamento']); else if(filters.status!=='todos') query=query.eq('status',filters.status);
  if(filters.priority!=='todos') query=query.eq('prioridade',filters.priority);
  if(taskView==='agenda'){
    const start=new Date(taskAgendaMonth); const end=new Date(start.getFullYear(),start.getMonth()+1,1);
    query=query.gte('prazo',start.toISOString()).lt('prazo',end.toISOString()).limit(200);
  }else{
    const from=taskPage*TASK_PAGE_SIZE; query=query.range(from,from+TASK_PAGE_SIZE-1);
  }
  const {data,error,count}=await query;
  if(sequence!==taskRequestSequence) return null;
  if(error){ console.error(error); showToast('Não foi possível carregar as tarefas.',true); return []; }
  taskTotal=count||0; taskCache=data||[]; return taskCache;
}

async function carregarMetricasTarefas(){
  const today=new Date(); today.setHours(0,0,0,0); const tomorrow=new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  const base=()=>supa.from('tarefas').select('id',{count:'exact',head:true});
  const [open,overdue,todayCount,done]=await Promise.all([
    base().in('status',['pendente','em_andamento']),
    base().in('status',['pendente','em_andamento']).lt('prazo',new Date().toISOString()),
    base().in('status',['pendente','em_andamento']).gte('prazo',today.toISOString()).lt('prazo',tomorrow.toISOString()),
    base().eq('status','concluida')
  ]);
  document.getElementById('taskOpenMetric').textContent=open.count||0;
  document.getElementById('taskOverdueMetric').textContent=overdue.count||0;
  document.getElementById('taskTodayMetric').textContent=todayCount.count||0;
  document.getElementById('taskDoneMetric').textContent=done.count||0;
  document.getElementById('taskCount').textContent=open.count||0;
}

function labelStatusTarefa(status){ return {pendente:'Pendente',em_andamento:'Em andamento',concluida:'Concluída',cancelada:'Cancelada'}[status]||status; }
function labelPrioridadeTarefa(priority){ return {baixa:'Baixa',media:'Média',alta:'Alta',critica:'Crítica'}[priority]||priority; }
function formatarPrazoTarefa(value){ return value?new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'Sem prazo'; }
function valorDataLocal(value){ if(!value) return ''; const date=new Date(value); return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16); }

function markupTarefa(task){
  const canEdit=canCreateDocuments;
  return `<article class="task-row"><span class="task-priority ${escapeHtml(task.prioridade)}" aria-label="Prioridade ${escapeHtml(labelPrioridadeTarefa(task.prioridade))}"></span><div class="task-main"><b>${escapeHtml(task.titulo||'Tarefa sem título')}</b><p>${escapeHtml(task.descricao||'Sem descrição')}</p><small>${escapeHtml(task.empresas?.nome||'Empresa indisponível')} · ${escapeHtml(formatarPrazoTarefa(task.prazo))} · ${escapeHtml(labelPrioridadeTarefa(task.prioridade))}</small></div><div class="task-actions"><span class="task-status ${escapeHtml(task.status)}">${escapeHtml(labelStatusTarefa(task.status))}</span>${canEdit?`<button class="mini-btn edit" type="button" data-action="edit-task" data-task-id="${escapeHtml(task.id)}">Editar</button>${task.status!=='concluida'?`<button class="mini-btn emit" type="button" data-action="complete-task" data-task-id="${escapeHtml(task.id)}">Concluir</button>`:''}`:''}${canDeleteCompanies?`<button class="mini-btn danger" type="button" data-action="delete-task" data-task-id="${escapeHtml(task.id)}">Excluir</button>`:''}</div></article>`;
}

function renderTaskRows(tasks){
  const list=document.getElementById('taskList');
  if(taskView==='agenda'){
    document.getElementById('taskAgendaTitle').textContent=taskAgendaMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    document.getElementById('taskResultsSummary').textContent=tasks.length+' compromisso'+(tasks.length===1?'':'s')+' no mês';
    if(!tasks.length){ list.innerHTML='<div class="empty-state">Nenhuma tarefa com prazo neste mês.</div>'; return; }
    const groups=new Map();
    for(const task of tasks){ const key=new Date(task.prazo).toLocaleDateString('pt-BR'); if(!groups.has(key)) groups.set(key,[]); groups.get(key).push(task); }
    list.innerHTML=[...groups.entries()].map(([date,items])=>`<section class="task-agenda-day"><h3>${date}</h3>${items.map(markupTarefa).join('')}</section>`).join('');
    document.getElementById('taskPagination').innerHTML=''; return;
  }
  const first=taskTotal?taskPage*TASK_PAGE_SIZE+1:0; const last=Math.min((taskPage+1)*TASK_PAGE_SIZE,taskTotal); const pages=Math.max(1,Math.ceil(taskTotal/TASK_PAGE_SIZE));
  document.getElementById('taskResultsSummary').textContent=taskTotal?`Exibindo ${first}–${last} de ${taskTotal} tarefa${taskTotal===1?'':'s'}`:'Nenhuma tarefa encontrada';
  list.innerHTML=tasks.length?tasks.map(markupTarefa).join(''):'<div class="empty-state">Nenhuma tarefa corresponde aos filtros atuais.</div>';
  document.getElementById('taskPagination').innerHTML=pages>1?`<button class="mini-btn" type="button" data-action="tasks-page" data-page="${taskPage-1}" ${taskPage===0?'disabled':''}>← Anterior</button><span>Página <b>${taskPage+1}</b> de ${pages}</span><button class="mini-btn" type="button" data-action="tasks-page" data-page="${taskPage+1}" ${taskPage>=pages-1?'disabled':''}>Próxima →</button>`:'';
}

async function renderTasks(){
  await carregarEmpresasTarefas();
  const list=document.getElementById('taskList'); list.setAttribute('aria-busy','true'); list.innerHTML='<div class="empty-state">Carregando tarefas...</div>';
  const [tasks]=await Promise.all([getTasks(),carregarMetricasTarefas()]);
  list.setAttribute('aria-busy','false'); if(tasks!==null) renderTaskRows(tasks);
}

async function opcoesFormularioTarefa(){
  const [companies,profiles]=await Promise.all([supa.from('empresas').select('id,nome').eq('ativo',true).order('nome').limit(500),supa.from('perfis').select('user_id,nome,papel').eq('ativo',true).order('nome').limit(200)]);
  if(companies.error) throw companies.error;
  const people=profiles.error?[]:(profiles.data||[]);
  if(!people.some(person=>person.user_id===currentUser.id)) people.unshift({user_id:currentUser.id,nome:currentProfileName,papel:currentRole});
  return {companies:(companies.data||[]).map(company=>({value:company.id,label:company.nome})),people:[{value:'',label:'Sem responsável'},...people.map(person=>({value:person.user_id,label:(person.nome||'Usuário')+' · '+person.papel}))]};
}

async function abrirFormularioTarefa(id=null){
  if(!canCreateDocuments){ showToast('Seu perfil não pode alterar tarefas.',true); return; }
  const current=id?(taskCache.find(task=>task.id===id)||null):null;
  if(id&&!current){ showToast('Tarefa não encontrada na lista atual.',true); return; }
  try{
    const options=await opcoesFormularioTarefa();
    const values=await OrigenixUI.openFormDialog({title:current?'Editar tarefa':'Nova tarefa',description:'Defina uma ação objetiva, responsável e prazo.',confirmLabel:current?'Salvar alterações':'Criar tarefa',fields:[
      {name:'titulo',label:'Título',value:current?.titulo||'',placeholder:'Ex: Revisar registros do PAC',required:true},
      {name:'descricao',label:'Descrição',type:'textarea',value:current?.descricao||'',placeholder:'Contexto e resultado esperado',required:false},
      {name:'empresa_id',label:'Estabelecimento',type:'select',value:current?.empresa_id||'',options:options.companies,required:true},
      {name:'prioridade',label:'Prioridade',type:'select',value:current?.prioridade||'media',options:[{value:'baixa',label:'Baixa'},{value:'media',label:'Média'},{value:'alta',label:'Alta'},{value:'critica',label:'Crítica'}]},
      {name:'prazo',label:'Prazo',type:'datetime-local',value:valorDataLocal(current?.prazo),required:false},
      {name:'status',label:'Status',type:'select',value:current?.status||'pendente',options:[{value:'pendente',label:'Pendente'},{value:'em_andamento',label:'Em andamento'},{value:'concluida',label:'Concluída'},{value:'cancelada',label:'Cancelada'}]},
      {name:'responsavel',label:'Responsável',type:'select',value:current?.responsavel||'',options:options.people,required:false}
    ]});
    if(!values) return;
    const title=values.titulo.trim(); const description=values.descricao.trim();
    if(title.length<2||title.length>200){ showToast('O título deve ter entre 2 e 200 caracteres.',true); return; }
    if(description.length>2000){ showToast('A descrição deve ter no máximo 2.000 caracteres.',true); return; }
    const payload={titulo:title,descricao:description||null,empresa_id:values.empresa_id,prioridade:values.prioridade,prazo:values.prazo?new Date(values.prazo).toISOString():null,status:values.status,responsavel:values.responsavel||null,atualizado_em:new Date().toISOString()};
    const result=current?await supa.from('tarefas').update(payload).eq('id',current.id):await supa.from('tarefas').insert({...payload,criado_por:currentUser.id});
    if(result.error) throw result.error;
    showToast(current?'Tarefa atualizada.':'Tarefa criada.');
    await Promise.all([renderTasks(),atualizarBadgeNotificacoes()]);
  }catch(error){ console.error(error); showToast(error?.message||'Não foi possível salvar a tarefa.',true); }
}

async function concluirTarefa(id,button){
  OrigenixUI?.setButtonLoading?.(button,true,'Concluindo...');
  const {error}=await supa.from('tarefas').update({status:'concluida',atualizado_em:new Date().toISOString()}).eq('id',id);
  OrigenixUI?.setButtonLoading?.(button,false);
  if(error){ showToast('Não foi possível concluir a tarefa.',true); return; }
  showToast('Tarefa concluída.'); await Promise.all([renderTasks(),atualizarBadgeNotificacoes()]);
}

async function excluirTarefa(id,button){
  if(!canDeleteCompanies) return;
  const task=taskCache.find(item=>item.id===id); if(!task) return;
  const confirmed=await OrigenixUI.openFormDialog({title:'Excluir tarefa?',description:(task.titulo||'Esta tarefa')+' será removida permanentemente e a ação ficará auditada.',fields:[],confirmLabel:'Excluir tarefa',danger:true});
  if(!confirmed) return;
  OrigenixUI?.setButtonLoading?.(button,true,'Excluindo...');
  const {error}=await supa.from('tarefas').delete().eq('id',id);
  OrigenixUI?.setButtonLoading?.(button,false);
  if(error){ showToast('Não foi possível excluir a tarefa.',true); return; }
  showToast('Tarefa excluída e ação registrada.'); await Promise.all([renderTasks(),atualizarBadgeNotificacoes()]);
}

function agendarBuscaNotificacoes(){
  window.clearTimeout(notificationSearchTimer);
  notificationSearchTimer = window.setTimeout(renderNotificationRows,250);
}

function notificacaoConcluida(status){
  return ['concluida','concluido','finalizada','finalizado','cancelada','cancelado'].includes(String(status||'').toLowerCase());
}

function classificarTarefa(tarefa){
  const now = Date.now();
  const deadline = tarefa.prazo ? new Date(tarefa.prazo).getTime() : null;
  const days = deadline ? Math.ceil((deadline-now)/86400000) : null;
  if(tarefa.prioridade==='critica' || (deadline && deadline<now)) return {severity:'critical',days};
  if(tarefa.prioridade==='alta' || (days!==null && days<=3)) return {severity:'attention',days};
  return {severity:'info',days};
}

function textoPrazo(days,prazo){
  if(!prazo) return 'Sem prazo definido';
  if(days < 0) return 'Vencida há '+Math.abs(days)+' dia'+(Math.abs(days)===1?'':'s');
  if(days === 0) return 'Vence hoje';
  if(days === 1) return 'Vence amanhã';
  return 'Vence em '+days+' dias';
}

async function carregarNotificacoes(){
  const sequence = ++notificationRequestSequence;
  const [tasksResult,documentsResult] = await Promise.all([
    supa.from('tarefas').select('id,empresa_id,titulo,descricao,status,responsavel,prioridade,prazo,created_at,empresas(nome)').order('prazo',{ascending:true,nullsFirst:false}).limit(200),
    supa.from('documentos').select('id,empresa_id,titulo,tipo,status,codigo,versao,created_at,criado_em,empresas(nome)').in('status',['em_revisao','gerado']).order('created_at',{ascending:true}).limit(100)
  ]);
  if(sequence !== notificationRequestSequence) return null;
  if(tasksResult.error || documentsResult.error){
    console.error(tasksResult.error || documentsResult.error);
    showToast('Não foi possível atualizar as notificações.',true);
    return [];
  }
  const tasks = (tasksResult.data||[]).filter(task=>!notificacaoConcluida(task.status)).map(task=>{
    const classification = classificarTarefa(task);
    return {key:'tarefa:'+task.id,tipo:'tarefa',id:task.id,empresa_id:task.empresa_id,empresa:task.empresas?.nome||'Empresa indisponível',titulo:task.titulo||'Tarefa sem título',descricao:task.descricao||'Acompanhamento operacional',severity:classification.severity,due:task.prazo,meta:textoPrazo(classification.days,task.prazo),sortDate:task.prazo||task.created_at};
  });
  const sevenDaysAgo = Date.now()-7*86400000;
  const documents = (documentsResult.data||[]).filter(doc=>doc.status==='em_revisao' || new Date(doc.criado_em||doc.created_at).getTime()<sevenDaysAgo).map(doc=>({key:'documento:'+doc.id,tipo:'documento',id:doc.id,empresa_id:doc.empresa_id,empresa:doc.empresas?.nome||'Empresa indisponível',titulo:doc.titulo||doc.tipo||'Documento',descricao:doc.status==='em_revisao'?'Documento aguardando revisão':'Documento gerado há mais de 7 dias sem formalização',severity:doc.status==='em_revisao'?'attention':'info',meta:(doc.codigo||'Sem código')+' · '+(doc.versao||'v1.0'),sortDate:doc.criado_em||doc.created_at}));
  const items = [...tasks,...documents];
  const references = items.map(item=>item.id);
  let reads = [];
  if(references.length){
    const receipts = await supa.from('notificacao_leituras').select('tipo,referencia_id,lida_em').in('referencia_id',references);
    if(receipts.error) console.error('Falha ao carregar leituras',receipts.error);
    else reads = receipts.data||[];
  }
  const readKeys = new Set(reads.map(read=>read.tipo+':'+read.referencia_id));
  const rank = {critical:0,attention:1,info:2};
  notificationItems = items.map(item=>({...item,lida:readKeys.has(item.key)})).sort((a,b)=>Number(a.lida)-Number(b.lida) || rank[a.severity]-rank[b.severity] || new Date(a.sortDate||0)-new Date(b.sortDate||0));
  atualizarContadoresNotificacoes();
  return notificationItems;
}

function atualizarContadoresNotificacoes(){
  const unread = notificationItems.filter(item=>!item.lida).length;
  for(const id of ['notificationCount','notificationTopCount']){
    const element = document.getElementById(id);
    if(element){ element.textContent = unread; element.dataset.count = String(unread); }
  }
  document.getElementById('notificationCriticalMetric').textContent = notificationItems.filter(item=>item.severity==='critical'&&!item.lida).length;
  document.getElementById('notificationDeadlineMetric').textContent = notificationItems.filter(item=>item.tipo==='tarefa'&&item.severity==='attention'&&!item.lida).length;
  document.getElementById('notificationReviewMetric').textContent = notificationItems.filter(item=>item.tipo==='documento'&&item.severity==='attention'&&!item.lida).length;
}

async function atualizarBadgeNotificacoes(){ await carregarNotificacoes(); }

function renderNotificationRows(){
  const list = document.getElementById('notificationList');
  const type = document.getElementById('notificationTypeFilter')?.value||'todos';
  const read = document.getElementById('notificationReadFilter')?.value||'nao_lidas';
  const search = (document.getElementById('notificationSearch')?.value||'').trim().toLocaleLowerCase('pt-BR').slice(0,80);
  const filtered = notificationItems.filter(item=>(type==='todos'||item.tipo===type) && (read==='todas'||(read==='lidas'?item.lida:!item.lida)) && (!search||(item.titulo+' '+item.descricao+' '+item.empresa).toLocaleLowerCase('pt-BR').includes(search)));
  document.getElementById('notificationResultsSummary').textContent = filtered.length+' notificação'+(filtered.length===1?'':'ões')+' exibida'+(filtered.length===1?'':'s');
  if(!filtered.length){ list.innerHTML='<div class="empty-state">Nenhuma pendência corresponde aos filtros atuais.</div>'; return; }
  list.innerHTML=filtered.map(item=>`<article class="notification-item ${item.lida?'is-read':''}">
    <span class="notification-severity ${item.severity}" aria-label="Prioridade ${item.severity}"></span>
    <div class="notification-main"><b>${escapeHtml(item.titulo)}</b><p>${escapeHtml(item.descricao)}</p><small>${escapeHtml(item.empresa)} · ${escapeHtml(item.meta)}</small></div>
    <div class="notification-actions">
      ${!item.lida?`<button class="mini-btn" type="button" data-action="read-notification" data-notification-type="${escapeHtml(item.tipo)}" data-notification-id="${escapeHtml(item.id)}">Marcar como lida</button>`:''}
      <button class="mini-btn edit" type="button" data-action="${item.tipo==='documento'?'open-notification-document':'open-notification-company'}" data-item-id="${escapeHtml(item.id)}" data-company-id="${escapeHtml(item.empresa_id)}">${item.tipo==='documento'?'Abrir documento':'Ver empresa'}</button>
    </div>
  </article>`).join('');
}

async function renderNotifications(){
  const list=document.getElementById('notificationList');
  list.setAttribute('aria-busy','true');
  list.innerHTML='<div class="empty-state">Atualizando prioridades...</div>';
  const result=await carregarNotificacoes();
  list.setAttribute('aria-busy','false');
  if(result!==null) renderNotificationRows();
}

async function marcarNotificacaoLida(tipo,id,button){
  OrigenixUI?.setButtonLoading?.(button,true,'Salvando...');
  const {error}=await supa.from('notificacao_leituras').upsert({usuario_id:currentUser.id,tipo,referencia_id:id,lida_em:new Date().toISOString()},{onConflict:'usuario_id,tipo,referencia_id'});
  OrigenixUI?.setButtonLoading?.(button,false);
  if(error){ showToast('Não foi possível marcar como lida.',true); return; }
  const item=notificationItems.find(entry=>entry.key===tipo+':'+id);
  if(item) item.lida=true;
  atualizarContadoresNotificacoes();
  renderNotificationRows();
}

async function abrirDocumentoNotificacao(id){
  let documento=documentCache.find(item=>item.id===id);
  if(!documento){
    const {data,error}=await supa.from('documentos').select(DOCUMENT_FIELDS).eq('id',id).single();
    if(error||!data){ showToast('Documento não encontrado ou sem acesso.',true); return; }
    documento=data;
    documentCache.unshift(documento);
  }
  switchTab('documentos');
  abrirDossieDocumento(id);
}

function agendarBuscaAuditoria(){
  window.clearTimeout(auditSearchTimer);
  auditSearchTimer = window.setTimeout(reiniciarAuditoria, 320);
}

function reiniciarAuditoria(){ auditPage = 0; renderAuditList(); }

function mudarPaginaAuditoria(page){
  const pageCount = Math.max(1, Math.ceil(auditTotal / AUDIT_PAGE_SIZE));
  if(page < 0 || page >= pageCount || page === auditPage) return;
  auditPage = page;
  renderAuditList();
  document.getElementById('tab-auditoria')?.scrollIntoView({behavior:'smooth',block:'start'});
}

function limparFiltrosAuditoria(){
  document.getElementById('auditSearch').value = '';
  document.getElementById('auditCompanyFilter').value = 'todos';
  document.getElementById('auditActionFilter').value = 'todos';
  document.getElementById('auditDateFrom').value = '';
  document.getElementById('auditDateTo').value = '';
  reiniciarAuditoria();
}

async function carregarEmpresasAuditoria(){
  if(auditCompaniesLoaded) return;
  const select = document.getElementById('auditCompanyFilter');
  const { data, error } = await supa.from('empresas').select('id,nome').order('nome').limit(500);
  if(error){ console.error('Falha ao carregar empresas da auditoria', error); return; }
  for(const company of data || []){
    const option = document.createElement('option');
    option.value = company.id;
    option.textContent = company.nome || 'Empresa sem nome';
    select.appendChild(option);
  }
  auditCompaniesLoaded = true;
}

function nomeAcaoAuditoria(action){
  const labels = {
    ANEXO_EXCLUIDO:'Anexo excluído', AUDITORIA_EXPORTADA:'Auditoria exportada', DOCUMENTO_EMITIDO:'Documento emitido',
    EMPRESA_CRIADA:'Empresa criada', EMPRESA_ATUALIZADA:'Empresa atualizada',
    EMPRESA_ARQUIVADA:'Empresa arquivada', EMPRESA_RESTAURADA:'Empresa restaurada',
    DOCUMENTO_STATUS_ALTERADO:'Status de documento alterado', TAREFA_CRIADA:'Tarefa criada',
    TAREFA_ATUALIZADA:'Tarefa atualizada', TAREFA_CONCLUIDA:'Tarefa concluída', TAREFA_EXCLUIDA:'Tarefa excluída'
  };
  return labels[action] || String(action || 'Ação registrada').toLowerCase().replaceAll('_',' ');
}

function resumoDetalhesAuditoria(raw){
  if(!raw) return 'Sem detalhes adicionais.';
  try{
    const value = JSON.parse(raw);
    const parts = [];
    if(value.nome_arquivo) parts.push(value.nome_arquivo);
    if(value.nome) parts.push(value.nome);
    if(value.titulo) parts.push(value.titulo);
    if(value.prazo) parts.push('Prazo: '+new Date(value.prazo).toLocaleString('pt-BR'));
    if(value.prioridade) parts.push('Prioridade: '+value.prioridade);
    if(Array.isArray(value.campos_alterados) && value.campos_alterados.length) parts.push('Campos: '+value.campos_alterados.join(', '));
    if(value.status_anterior || value.status_atual) parts.push((value.status_anterior||'novo')+' → '+(value.status_atual||'sem status'));
    if(value.documento_id) parts.push('Documento ' + String(value.documento_id).slice(0,8));
    if(value.anexo_id) parts.push('Anexo ' + String(value.anexo_id).slice(0,8));
    if(value.codigo) parts.push(String(value.codigo));
    return parts.length ? parts.join(' · ') : String(raw).slice(0,240);
  }catch{ return String(raw).slice(0,240); }
}

function periodoAuditoria(){
  const from = document.getElementById('auditDateFrom').value;
  const to = document.getElementById('auditDateTo').value;
  if(from && to) return new Date(from+'T12:00:00').toLocaleDateString('pt-BR') + '–' + new Date(to+'T12:00:00').toLocaleDateString('pt-BR');
  if(from) return 'Desde ' + new Date(from+'T12:00:00').toLocaleDateString('pt-BR');
  if(to) return 'Até ' + new Date(to+'T12:00:00').toLocaleDateString('pt-BR');
  return 'Todos';
}

function valorSeguroCSV(value){
  let text = String(value ?? '').replace(/\r?\n/g,' ').trim();
  if(/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"','""') + '"';
}

function filtrosAuditoriaAtuais(){
  const rawSearch = (document.getElementById('auditSearch')?.value || '').trim();
  return {
    busca:rawSearch.replace(/[%,()_]/g,' ').replace(/\s+/g,' ').trim().slice(0,80),
    empresa:document.getElementById('auditCompanyFilter')?.value || 'todos',
    acao:document.getElementById('auditActionFilter')?.value || 'todos',
    data_inicial:document.getElementById('auditDateFrom')?.value || null,
    data_final:document.getElementById('auditDateTo')?.value || null
  };
}

function aplicarFiltrosAuditoria(query, filters){
  if(filters.busca) query = query.or(`acao.ilike.%${filters.busca}%,detalhes.ilike.%${filters.busca}%`);
  if(filters.empresa !== 'todos') query = query.eq('empresa_id', filters.empresa);
  if(filters.acao !== 'todos') query = query.eq('acao', filters.acao);
  if(filters.data_inicial) query = query.gte('created_at', filters.data_inicial+'T00:00:00');
  if(filters.data_final){
    const next = new Date(filters.data_final+'T12:00:00');
    next.setDate(next.getDate()+1);
    query = query.lt('created_at', next.toISOString().slice(0,10)+'T00:00:00');
  }
  return query;
}

async function exportarAuditoriaCSV(button){
  const filters = filtrosAuditoriaAtuais();
  OrigenixUI?.setButtonLoading?.(button,true,'Gerando...');
  try{
    let query = supa.from('auditorias')
      .select('id,empresa_id,usuario_id,acao,detalhes,created_at,empresas(nome)')
      .order('created_at',{ascending:false})
      .order('id',{ascending:false})
      .limit(2000);
    query = aplicarFiltrosAuditoria(query,filters);
    const {data,error} = await query;
    if(error) throw error;
    const events = data || [];
    const trace = await supa.from('auditoria_exportacoes').insert({
      usuario_id:currentUser.id,
      empresa_id:filters.empresa === 'todos' ? null : filters.empresa,
      filtros:filters,
      total_registros:events.length
    });
    if(trace.error) throw new Error('Não foi possível registrar a exportação. Download cancelado.');
    const header = ['Data','Ação','Empresa','Ator','Detalhes'];
    const rows = events.map(event=>[
      event.created_at ? new Date(event.created_at).toLocaleString('pt-BR') : '',
      nomeAcaoAuditoria(event.acao),
      event.empresas?.nome || 'Escopo global',
      event.usuario_id === currentUser.id ? currentProfileName : (event.usuario_id || 'Sistema'),
      event.detalhes || ''
    ]);
    const csv = '\uFEFF' + [header,...rows].map(row=>row.map(valorSeguroCSV).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'origenix-auditoria-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(events.length === 2000 && auditTotal > 2000 ? 'CSV gerado com o limite de 2.000 eventos.' : 'CSV gerado e exportação registrada.');
    await renderAuditList();
  }catch(error){
    console.error('Falha ao exportar auditoria:',error);
    showToast(error?.message || 'Não foi possível exportar a auditoria.',true);
  }finally{
    OrigenixUI?.setButtonLoading?.(button,false);
  }
}

async function getAuditEvents(){
  const sequence = ++auditRequestSequence;
  const filters = filtrosAuditoriaAtuais();
  const from = auditPage * AUDIT_PAGE_SIZE;
  const to = from + AUDIT_PAGE_SIZE - 1;
  let query = supa.from('auditorias')
    .select('id,empresa_id,usuario_id,acao,detalhes,created_at,empresas(nome)', {count:'exact'})
    .order('created_at',{ascending:false})
    .order('id',{ascending:false})
    .range(from,to);
  query = aplicarFiltrosAuditoria(query,filters);
  const {data,error,count} = await query;
  if(sequence !== auditRequestSequence) return null;
  if(error){ console.error(error); showToast('Não foi possível carregar a auditoria.', true); return []; }
  auditTotal = count || 0;
  return data || [];
}

function renderAuditRows(events){
  const list = document.getElementById('auditList');
  const first = auditTotal ? auditPage * AUDIT_PAGE_SIZE + 1 : 0;
  const last = Math.min((auditPage+1)*AUDIT_PAGE_SIZE,auditTotal);
  const pageCount = Math.max(1,Math.ceil(auditTotal/AUDIT_PAGE_SIZE));
  document.getElementById('auditCount').textContent = auditTotal;
  document.getElementById('auditMetricTotal').textContent = auditTotal;
  document.getElementById('auditMetricPeriod').textContent = periodoAuditoria();
  document.getElementById('auditResultsSummary').textContent = auditTotal ? `Exibindo ${first}–${last} de ${auditTotal} evento${auditTotal===1?'':'s'}` : 'Nenhum evento encontrado';
  if(!events.length){ list.innerHTML = '<div class="empty-state">Nenhum evento corresponde aos filtros atuais.</div>'; }
  else list.innerHTML = events.map(event=>{
    const actor = event.usuario_id === currentUser?.id ? currentProfileName : (event.usuario_id ? 'Usuário '+event.usuario_id.slice(0,8) : 'Sistema');
    const occurred = event.created_at ? new Date(event.created_at).toLocaleString('pt-BR') : 'Sem data';
    return `<article class="audit-event">
      <div class="audit-event-icon" aria-hidden="true">✓</div>
      <div class="audit-event-main"><b>${escapeHtml(nomeAcaoAuditoria(event.acao))}</b><p>${escapeHtml(resumoDetalhesAuditoria(event.detalhes))}</p></div>
      <div class="audit-event-meta"><span class="audit-action">${escapeHtml(event.acao||'evento')}</span><span>${escapeHtml(event.empresas?.nome||'Empresa indisponível')}</span><span>${escapeHtml(actor)} · ${occurred}</span></div>
    </article>`;
  }).join('');
  document.getElementById('auditPagination').innerHTML = pageCount>1 ? `
    <button class="mini-btn" type="button" data-action="audit-page" data-page="${auditPage-1}" ${auditPage===0?'disabled':''}>← Anterior</button>
    <span>Página <b>${auditPage+1}</b> de ${pageCount}</span>
    <button class="mini-btn" type="button" data-action="audit-page" data-page="${auditPage+1}" ${auditPage>=pageCount-1?'disabled':''}>Próxima →</button>` : '';
}

async function renderAuditList(){
  const list = document.getElementById('auditList');
  await carregarEmpresasAuditoria();
  list.setAttribute('aria-busy','true');
  list.innerHTML = '<div class="empty-state">Carregando trilha de auditoria...</div>';
  const events = await getAuditEvents();
  list.setAttribute('aria-busy','false');
  if(events === null) return;
  renderAuditRows(events);
}

// ---- CRUD: empresas ----
const EMPRESA_FIELDS = 'id,nome,cnpj,email,telefone,proprietario,municipio,tipo_estabelecimento,inspecao,capacidade,area,rt_nome,rt_crmv,user_id,criado_em,atualizado_em,ativo,arquivado_em';

async function getClientes(){
  const status = document.getElementById('clientStatusFilter')?.value || 'ativos';
  const rawSearch = (document.getElementById('clientSearch')?.value || '').trim();
  const search = rawSearch.replace(/[%,()_]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const from = clientPage * CLIENT_PAGE_SIZE;
  const to = from + CLIENT_PAGE_SIZE - 1;
  const requestSequence = ++clientRequestSequence;

  let query = supa
    .from('empresas')
    .select(EMPRESA_FIELDS, { count: 'exact' })
    .order('criado_em', { ascending:false })
    .range(from, to);
  if(status === 'ativos') query = query.eq('ativo', true);
  if(status === 'arquivados') query = query.eq('ativo', false);
  if(search){
    const pattern = `%${search}%`;
    query = query.or(`nome.ilike.${pattern},cnpj.ilike.${pattern},municipio.ilike.${pattern},rt_nome.ilike.${pattern},tipo_estabelecimento.ilike.${pattern}`);
  }

  const { data, error, count } = await query;
  if(requestSequence !== clientRequestSequence) return null;
  if(error){
    console.error(error);
    setConnStatus('error', 'Erro ao carregar: ' + error.message);
    return [];
  }
  setConnStatus('ok', 'Conectado ao banco de dados ORIGENIX');
  clientCache = data || [];
  clientTotal = count || 0;
  return clientCache;
}

function setSavingState(active){
  const btn = document.getElementById('btnSalvar');
  if(window.OrigenixUI?.setButtonLoading){
    window.OrigenixUI.setButtonLoading(btn, active, editingClientId ? 'Atualizando...' : 'Salvando...');
  } else {
    btn.disabled = active;
    btn.textContent = active ? (editingClientId ? 'Atualizando...' : 'Salvando...') : (editingClientId ? 'Atualizar Cadastro' : 'Salvar Cadastro');
  }
}

async function salvarCliente(){
  const nome = document.getElementById('f_nome').value.trim();
  if(!nome){ showToast('Informe o nome da empresa.', true); document.getElementById('f_nome').focus(); return; }
  setSavingState(true);

  const registro = {
    nome,
    cnpj: document.getElementById('f_cnpj').value.trim() || null,
    proprietario: document.getElementById('f_proprietario').value.trim() || null,
    municipio: document.getElementById('f_municipio').value.trim() || null,
    tipo_estabelecimento: document.getElementById('f_tipo').value || null,
    inspecao: document.getElementById('f_inspecao').value || null,
    capacidade: document.getElementById('f_capacidade').value.trim() || null,
    area: document.getElementById('f_area').value.trim() || null,
    rt_nome: document.getElementById('f_rt_nome').value.trim() || null,
    rt_crmv: document.getElementById('f_rt_crmv').value.trim() || null,
    atualizado_em: new Date().toISOString()
  };
  if(!editingClientId) registro.user_id = currentUser ? currentUser.id : null;

  const request = editingClientId
    ? supa.from('empresas').update(registro).eq('id', editingClientId)
    : supa.from('empresas').insert(registro);
  const { error } = await request;
  setSavingState(false);

  if(error){
    console.error(error);
    showToast('Erro ao salvar: ' + error.message, true);
    return;
  }
  const wasEditing = Boolean(editingClientId);
  cancelarEdicao(false);
  showToast(wasEditing ? 'Cadastro atualizado com sucesso.' : 'Estabelecimento cadastrado com sucesso.');
  switchTab('clientes');
}

function limparForm(){
  ['f_nome','f_cnpj','f_proprietario','f_municipio','f_capacidade','f_area','f_rt_nome','f_rt_crmv'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('f_tipo').value='';
  document.getElementById('f_inspecao').value='';
}

function cancelarEdicao(showMessage=true){
  editingClientId = null;
  limparForm();
  document.getElementById('formTitle').textContent = 'Dados do Estabelecimento';
  document.getElementById('btnSalvar').textContent = 'Salvar Cadastro';
  document.getElementById('btnCancelarEdicao').classList.add('is-hidden');
  document.getElementById('btnLimpar').classList.remove('is-hidden');
  if(showMessage) showToast('Edição cancelada.');
}

function novoCadastro(){
  cancelarEdicao(false);
  switchTab('cadastro');
  document.getElementById('f_nome').focus();
}

function editarCliente(id){
  const cliente = clientCache.find(item=>item.id===id);
  if(!cliente){ showToast('Cadastro não encontrado. Atualize a lista.', true); return; }
  editingClientId = id;
  const values = {
    f_nome:cliente.nome, f_cnpj:cliente.cnpj, f_proprietario:cliente.proprietario,
    f_municipio:cliente.municipio, f_tipo:cliente.tipo_estabelecimento,
    f_inspecao:cliente.inspecao, f_capacidade:cliente.capacidade, f_area:cliente.area,
    f_rt_nome:cliente.rt_nome, f_rt_crmv:cliente.rt_crmv
  };
  Object.entries(values).forEach(([field,value])=>document.getElementById(field).value=value||'');
  document.getElementById('formTitle').textContent = 'Editar Estabelecimento';
  document.getElementById('btnSalvar').textContent = 'Atualizar Cadastro';
  document.getElementById('btnCancelarEdicao').classList.remove('is-hidden');
  document.getElementById('btnLimpar').classList.add('is-hidden');
  switchTab('cadastro');
  document.getElementById('f_nome').focus();
}

function switchTab(tab){
  const validTab = ['cadastro','clientes','documentos','auditoria','notificacoes','tarefas'].includes(tab) ? tab : 'clientes';
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
  const nav = document.querySelector(`.nav-item[data-tab="${validTab}"]`);
  if(nav) nav.classList.add('active');
  document.getElementById('tab-cadastro').classList.toggle('is-hidden', validTab!=='cadastro');
  document.getElementById('tab-clientes').classList.toggle('is-hidden', validTab!=='clientes');
  document.getElementById('tab-documentos').classList.toggle('is-hidden', validTab!=='documentos');
  document.getElementById('tab-auditoria').classList.toggle('is-hidden', validTab!=='auditoria');
  document.getElementById('tab-notificacoes').classList.toggle('is-hidden', validTab!=='notificacoes');
  document.getElementById('tab-tarefas').classList.toggle('is-hidden', validTab!=='tarefas');
  const titles = {
    cadastro: editingClientId ? 'Editar Cadastro' : 'Novo Cadastro',
    clientes: 'Clientes Cadastrados',
    documentos: 'Biblioteca Documental',
    auditoria: 'Central de Auditoria',
    notificacoes: 'Central de Notificações',
    tarefas: 'Tarefas & Agenda'
  };
  const subtitles = {
    cadastro: editingClientId ? 'Atualize os dados operacionais do estabelecimento' : 'Fase 1 — Triagem do estabelecimento',
    clientes: 'Pesquise, edite, emita ou arquive estabelecimentos',
    documentos: 'Consulte códigos, versões, status e estabelecimentos',
    auditoria: 'Rastreabilidade imutável das operações do sistema',
    notificacoes: 'Prioridades, prazos e documentos que exigem atenção',
    tarefas: 'Planejamento operacional por prazo, prioridade e responsável'
  };
  document.getElementById('pageTitle').textContent = titles[validTab];
  document.getElementById('pageSub').textContent = subtitles[validTab];
  if(validTab==='clientes') renderClientList();
  if(validTab==='documentos') renderDocumentList();
  if(validTab==='auditoria') renderAuditList();
  if(validTab==='notificacoes') renderNotifications();
  if(validTab==='tarefas') renderTasks();
}

document.querySelectorAll('.nav-item').forEach(el=>{
  el.addEventListener('click', ()=>switchTab(el.dataset.tab));
  el.addEventListener('keydown', event=>{ if(event.key==='Enter' || event.key===' '){ event.preventDefault(); switchTab(el.dataset.tab); } });
});

function agendarBuscaClientes(){
  window.clearTimeout(clientSearchTimer);
  clientSearchTimer = window.setTimeout(reiniciarListaClientes, 320);
}

function reiniciarListaClientes(){
  clientPage = 0;
  renderClientList();
}

function mudarPaginaClientes(nextPage){
  const pageCount = Math.max(1, Math.ceil(clientTotal / CLIENT_PAGE_SIZE));
  if(nextPage < 0 || nextPage >= pageCount || nextPage === clientPage) return;
  clientPage = nextPage;
  renderClientList();
  document.getElementById('clientSearch')?.focus({ preventScroll:true });
}

function renderClientRows(list){
  const container = document.getElementById('clientList');
  const summary = document.getElementById('clientResultsSummary');
  const pagination = document.getElementById('clientPagination');
  const first = clientTotal ? (clientPage * CLIENT_PAGE_SIZE) + 1 : 0;
  const last = Math.min((clientPage + 1) * CLIENT_PAGE_SIZE, clientTotal);
  const pageCount = Math.max(1, Math.ceil(clientTotal / CLIENT_PAGE_SIZE));
  document.getElementById('clientCount').textContent = clientTotal;
  summary.textContent = clientTotal
    ? `Exibindo ${first}–${last} de ${clientTotal} estabelecimento${clientTotal === 1 ? '' : 's'}`
    : 'Nenhum estabelecimento encontrado';

  if(list.length===0){
    const hasSearch = Boolean(document.getElementById('clientSearch')?.value.trim());
    container.innerHTML = `<div class="empty-state">${hasSearch ? 'Nenhum estabelecimento corresponde à pesquisa.' : 'Nenhum estabelecimento nesta situação.'}</div>`;
  } else {
    container.innerHTML = list.map(c=>`
      <div class="client-row ${c.ativo ? '' : 'archived'}">
        <div class="info">
          <b>${escapeHtml(c.nome)}</b>
          <span>${escapeHtml(c.tipo_estabelecimento||'—')} · ${escapeHtml(c.municipio||'—')} · RT: ${escapeHtml(c.rt_nome||'—')}</span>
          <small class="status-badge">${c.ativo ? 'Ativo' : 'Arquivado'}</small>
        </div>
        <div class="actions">
          <button class="mini-btn" data-action="client-details" data-client-id="${escapeHtml(c.id)}">Ver detalhes</button>
          ${c.ativo ? `<button class="mini-btn edit" data-action="edit-client" data-client-id="${escapeHtml(c.id)}">Editar</button>` : ''}
          ${c.ativo && canCreateDocuments ? `<button class="mini-btn emit" data-action="generate-document" data-client-id="${escapeHtml(c.id)}">Gerar documento</button>` : ''}
          ${canDeleteCompanies ? (c.ativo
            ? `<button class="mini-btn danger" data-action="archive-client" data-client-id="${escapeHtml(c.id)}">Arquivar</button>`
            : `<button class="mini-btn" data-action="restore-client" data-client-id="${escapeHtml(c.id)}">Restaurar</button>`) : ''}
        </div>
      </div>
    `).join('');
  }

  pagination.innerHTML = pageCount > 1 ? `
    <button class="mini-btn" type="button" data-action="clients-page" data-page="${clientPage-1}" ${clientPage===0 ? 'disabled' : ''} aria-label="Página anterior">← Anterior</button>
    <span>Página <b>${clientPage+1}</b> de ${pageCount}</span>
    <button class="mini-btn" type="button" data-action="clients-page" data-page="${clientPage+1}" ${clientPage>=pageCount-1 ? 'disabled' : ''} aria-label="Próxima página">Próxima →</button>
  ` : '';
}

async function renderClientList(){
  const container = document.getElementById('clientList');
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = '<div class="empty-state">Carregando estabelecimentos...</div>';
  const list = await getClientes();
  container.setAttribute('aria-busy', 'false');
  if(list === null) return;
  renderClientRows(list);
}

let clientDetailReturnFocus = null;

async function abrirDetalhesCliente(id){
  const cliente = clientCache.find(item=>item.id===id);
  if(!cliente){ showToast('Estabelecimento não encontrado. Atualize a lista.', true); return; }
  clientDetailReturnFocus = document.activeElement;
  const overlay = document.getElementById('clientDetailOverlay');
  const title = document.getElementById('clientDetailTitle');
  const body = document.getElementById('clientDetailBody');
  title.textContent = cliente.nome;
  body.innerHTML = '<div class="empty-state">Carregando visão consolidada...</div>';
  overlay.classList.add('show');
  document.body.classList.add('ox-scroll-lock');
  overlay.querySelector('.client-detail-close').focus();

  const countQuery = table => supa.from(table).select('id', { count:'exact', head:true }).eq('empresa_id', id);
  const [docsResult, pacsResult, tasksResult, auditsResult, recentDocsResult] = await Promise.all([
    countQuery('documentos'),
    countQuery('empresa_pacs'),
    countQuery('tarefas'),
    countQuery('auditorias'),
    supa.from('documentos').select('id,titulo,tipo,status,codigo,versao,criado_em,created_at').eq('empresa_id', id).order('criado_em', { ascending:false, nullsFirst:false }).limit(5)
  ]);
  if(!overlay.classList.contains('show') || document.getElementById('clientDetailTitle').textContent !== cliente.nome) return;
  const count = result => result.error ? '—' : (result.count || 0);
  const docs = recentDocsResult.error ? [] : (recentDocsResult.data || []);
  const fields = [
    ['CNPJ', cliente.cnpj || 'Não informado'],
    ['Município', cliente.municipio || 'Não informado'],
    ['Categoria', cliente.tipo_estabelecimento || 'Não informado'],
    ['Inspeção', cliente.inspecao || 'Não informada'],
    ['Responsável técnico', cliente.rt_nome || 'Não informado'],
    ['CRMV', cliente.rt_crmv || 'Não informado'],
    ['Capacidade', cliente.capacidade || 'Não informada'],
    ['Área construída', cliente.area || 'Não informada']
  ];
  body.innerHTML = `
    <div class="client-detail-grid">
      ${fields.map(([label,value])=>`<div class="client-detail-field"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('')}
    </div>
    <div class="client-detail-stats" aria-label="Indicadores do estabelecimento">
      <div class="client-detail-stat"><span>Documentos</span><b>${count(docsResult)}</b></div>
      <div class="client-detail-stat"><span>PACs</span><b>${count(pacsResult)}</b></div>
      <div class="client-detail-stat"><span>Tarefas</span><b>${count(tasksResult)}</b></div>
      <div class="client-detail-stat"><span>Auditorias</span><b>${count(auditsResult)}</b></div>
    </div>
    <section class="client-detail-section">
      <h3>Documentos recentes</h3>
      ${docs.length ? docs.map(doc=>`<div class="client-detail-doc"><div><b>${escapeHtml(doc.titulo||doc.tipo||'Documento')}</b><span>${escapeHtml(doc.codigo||'Sem código')} · ${escapeHtml(doc.versao||'v1.0')}</span></div><span>${escapeHtml(doc.status||'gerado')}</span></div>`).join('') : '<div class="empty-state empty-padded">Nenhum documento emitido.</div>'}
    </section>
    <div class="client-detail-actions">
      ${cliente.ativo ? `<button class="mini-btn edit" data-action="details-edit-client" data-client-id="${escapeHtml(cliente.id)}">Editar cadastro</button>` : ''}
      ${cliente.ativo && canCreateDocuments ? `<button class="mini-btn emit" data-action="details-generate-document" data-client-id="${escapeHtml(cliente.id)}">Gerar documento</button>` : ''}
      <button class="mini-btn" data-action="open-client-pacs" data-client-id="${escapeHtml(cliente.id)}">Abrir PACs</button>
    </div>`;
}

function fecharDetalhesCliente(){
  const overlay = document.getElementById('clientDetailOverlay');
  overlay.classList.remove('show');
  document.body.classList.remove('ox-scroll-lock');
  if(clientDetailReturnFocus instanceof HTMLElement) clientDetailReturnFocus.focus();
  clientDetailReturnFocus = null;
}

document.addEventListener('keydown', event=>{
  if(event.key === 'Escape' && document.getElementById('clientDetailOverlay')?.classList.contains('show')){
    event.preventDefault();
    fecharDetalhesCliente();
  }
});

async function alterarSituacaoCliente(id, restaurar){
  const cliente = clientCache.find(item=>item.id===id);
  if(!cliente) return;
  const title = restaurar ? 'Restaurar estabelecimento?' : 'Arquivar estabelecimento?';
  const description = restaurar
    ? `${cliente.nome} voltará a aparecer nas rotinas operacionais.`
    : `${cliente.nome} será removido das rotinas sem perder documentos ou histórico.`;
  const confirmed = window.OrigenixUI?.openFormDialog
    ? await window.OrigenixUI.openFormDialog({
        title, description, fields:[],
        confirmLabel: restaurar ? 'Restaurar' : 'Arquivar',
        danger: !restaurar
      })
    : (window.confirm(description) ? {} : null);
  if(!confirmed) return;

  const { error } = await supa.from('empresas').update({
    ativo: restaurar,
    arquivado_em: restaurar ? null : new Date().toISOString(),
    atualizado_em: new Date().toISOString()
  }).eq('id', id);
  if(error){ showToast('Não foi possível alterar a situação: ' + error.message, true); return; }
  await renderClientList();
  showToast(restaurar ? 'Estabelecimento restaurado.' : 'Estabelecimento arquivado com segurança.');
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str||'';
  return d.innerHTML;
}

async function sha256(text){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function gerarDocumento(clientId){
  if(!canCreateDocuments){ showToast('Seu perfil não possui permissão para emitir documentos.', true); return; }
  let cliente = clientCache.find(c=>c.id===clientId);
  if(!cliente){
    const { data, error } = await supa.from('empresas').select(EMPRESA_FIELDS).eq('id', clientId).single();
    if(error || !data){ showToast('Não foi possível carregar o estabelecimento.', true); return; }
    cliente = data;
  }

  const { data: codigo, error: codigoError } = await supa.rpc('proximo_codigo_documento', {
    empresa_id: cliente.id,
    tipo_codigo: 'PA-01'
  });
  if(codigoError){
    console.error(codigoError);
    showToast('Não foi possível reservar a numeração do documento.', true);
    return;
  }

  const uuid = crypto.randomUUID();
  const now = new Date();
  const dataEmissao = now.toLocaleDateString('pt-BR');
  const horaEmissao = now.toLocaleTimeString('pt-BR');
  const conteudoParaHash = JSON.stringify(cliente) + codigo + uuid + now.toISOString();
  const hash = await sha256(conteudoParaHash);
  const hashShort = hash.slice(0,8) + '...' + hash.slice(-6);

  const { data: documento, error: docError } = await supa.from('documentos').insert({
    empresa_id: cliente.id,
    user_id: currentUser ? currentUser.id : null,
    titulo: 'Requerimento de Regularização Sanitária',
    tipo: 'Pasta 01 — Processo Administrativo',
    status: 'gerado',
    uuid_documento: uuid,
    hash_sha256: hash,
    codigo,
    versao: 'v1.0'
  }).select('id').single();
  if(docError){
    console.error(docError);
    showToast('Não foi possível registrar o documento.', true);
    return;
  }

  const { error: versaoError } = await supa.from('documento_versoes').insert({
    documento_id: documento.id,
    numero_versao: 1,
    codigo,
    status: 'gerado',
    hash_sha256: hash,
    criado_por: currentUser.id,
    conteudo: {
      titulo: 'Requerimento de Regularização Sanitária',
      empresa_id: cliente.id,
      empresa_nome: cliente.nome,
      emitido_em: now.toISOString()
    }
  });
  if(versaoError) console.error('Falha ao registrar versão documental', versaoError);

  const doc = `
  <div class="page cover">
    <div class="page-inner">
      <div>
        <img class="cover-mark" src="${LOGO}" alt="ORIGENIX">
        <div class="cover-brand">ORIGENI<span class="x">X</span></div>
        <div class="cover-rule"></div>
        <div class="cover-folder">Pasta 01 · Processo Administrativo</div>
        <h1>Requerimento de Regularização Sanitária</h1>
        <div class="client">Elaborado para <b>${escapeHtml(cliente.nome)}</b> — ${escapeHtml(cliente.municipio||'')}</div>
      </div>
      <div class="cover-meta">
        <div><div class="k">Código</div><div class="v">${codigo}</div></div>
        <div><div class="k">Revisão</div><div class="v">v1.0</div></div>
        <div><div class="k">Emissão</div><div class="v">${dataEmissao}</div></div>
      </div>
    </div>
  </div>

  <div class="page">
    <div class="page-inner">
      <div class="doc-header">
        <div class="dh-left">
          <img class="dh-mark" src="${LOGO}" alt="ORIGENIX">
          <div><div class="b">ORIGENI<span class="x">X</span></div><div class="s">CONSULTORIA EM PRODUTOS DE ORIGEM ANIMAL</div></div>
        </div>
        <div class="dh-right">Código: <b>${codigo}</b><br>Revisão: <b>v1.0</b> · Emissão: <b>${dataEmissao}</b></div>
      </div>

      <div class="doc-eyebrow">Pasta 01 — Processo Administrativo</div>
      <h2>Requerimento de Regularização</h2>

      <div class="doc-body">
        <p>Pelo presente instrumento, <b>${escapeHtml(cliente.nome)}</b>, inscrita no CNPJ ${escapeHtml(cliente.cnpj||'[não informado]')}, com sede em ${escapeHtml(cliente.municipio||'[não informado]')}, requer a análise e regularização sanitária do estabelecimento classificado como <b>${escapeHtml(cliente.tipo_estabelecimento||'[não informado]')}</b>, perante o órgão de inspeção <b>${escapeHtml(cliente.inspecao||'[não informado]')}</b>.</p>

        <h3>Dados do Estabelecimento</h3>
        <table>
          <tr><th>Campo</th><th>Informação</th></tr>
          <tr><td>Proprietário</td><td>${escapeHtml(cliente.proprietario||'—')}</td></tr>
          <tr><td>Capacidade Produtiva</td><td>${escapeHtml(cliente.capacidade||'—')}</td></tr>
          <tr><td>Área Construída</td><td>${escapeHtml(cliente.area||'—')}</td></tr>
          <tr><td>Tipo de Inspeção Pretendida</td><td>${escapeHtml(cliente.inspecao||'—')}</td></tr>
        </table>

        <h3>Responsabilidade Técnica</h3>
        <p>O acompanhamento técnico deste processo é de responsabilidade de <b>${escapeHtml(cliente.rt_nome||'[RT não informado]')}</b>, inscrito(a) sob CRMV ${escapeHtml(cliente.rt_crmv||'[não informado]')}, que assina este documento e responde tecnicamente por sua exatidão perante o órgão competente.</p>

        <h3>Objeto do Requerimento</h3>
        <p>Solicita-se a abertura de processo administrativo para fins de regularização e/ou renovação de licenciamento sanitário, conforme legislação aplicável ao tipo de estabelecimento e inspeção pretendida acima descritos.</p>
      </div>

      <div class="doc-footer">
        <div class="df-left">ORIGENIX · Consultoria em Produtos de Origem Animal<br>www.origenix.com.br</div>
        <div class="df-right">
          <div class="qr-mini"></div>
          <div class="df-code">UUID: <b>${uuid.slice(0,13)}</b><br>SHA-256: <b>${hashShort}</b></div>
        </div>
      </div>
    </div>
  </div>

  <div class="page">
    <div class="page-inner">
      <div class="doc-header">
        <div class="dh-left">
          <img class="dh-mark" src="${LOGO}" alt="ORIGENIX">
          <div><div class="b">ORIGENI<span class="x">X</span></div><div class="s">CONSULTORIA EM PRODUTOS DE ORIGEM ANIMAL</div></div>
        </div>
        <div class="dh-right">Código: <b>${codigo}</b><br>Revisão: <b>v1.0</b> · Emissão: <b>${dataEmissao}</b></div>
      </div>

      <div class="doc-eyebrow">Página de Validação Documental</div>
      <h2>Ficha de Autenticidade</h2>

      <div class="auth-grid">
        <div class="auth-block">
          <div class="ab-head">Identificação</div>
          <div class="auth-row"><span class="k">UUID</span><span class="v">${uuid}</span></div>
          <div class="auth-row"><span class="k">SHA-256</span><span class="v">${hash}</span></div>
          <div class="auth-row"><span class="k">Carimbo temporal</span><span class="v">${dataEmissao} ${horaEmissao}</span></div>
          <div class="auth-row"><span class="k">Versão</span><span class="v">v1.0</span></div>
        </div>
        <div class="auth-block">
          <div class="ab-head">Responsabilidade Técnica</div>
          <div class="auth-row"><span class="k">RT emissor</span><span class="v">${escapeHtml(cliente.rt_nome||'—')}</span></div>
          <div class="auth-row"><span class="k">CRMV</span><span class="v">${escapeHtml(cliente.rt_crmv||'—')}</span></div>
          <div class="auth-row"><span class="k">Estabelecimento</span><span class="v">${escapeHtml(cliente.nome)}</span></div>
          <div class="auth-row"><span class="k">Status</span><span class="v">Gerado — aguardando assinatura</span></div>
        </div>
      </div>

      <div class="sign-block">
        <div class="sign-line">
          <b>${escapeHtml(cliente.rt_nome||'Responsável Técnico')} ${cliente.rt_crmv ? '— CRMV '+escapeHtml(cliente.rt_crmv) : ''}</b>
          Responsável Técnico · Documento gerado em ${dataEmissao} às ${horaEmissao}
        </div>
        <div class="sign-qr"></div>
      </div>
    </div>
  </div>
  `;

  document.getElementById('docContent').innerHTML = doc;
  document.getElementById('mainView').classList.add('is-hidden');
  document.getElementById('docView').classList.add('document-visible');
  window.scrollTo(0,0);
}

function fecharDocumento(){
  document.getElementById('docView').classList.remove('document-visible');
  document.getElementById('mainView').classList.remove('is-hidden');
}


function handleSystemAction(event){
  const target=event.target.closest('[data-action]');
  if(!target||target.disabled)return;
  const action=target.dataset.action;
  switch(action){
    case 'auth-login': setAuthMode('login'); break;
    case 'auth-signup': setAuthMode('signup'); break;
    case 'auth-submit': handleAuth(); break;
    case 'logout': handleLogout(); break;
    case 'open-notifications': switchTab('notificacoes'); break;
    case 'save-client': salvarCliente(); break;
    case 'cancel-edit': cancelarEdicao(); break;
    case 'clear-form': limparForm(); break;
    case 'new-client': novoCadastro(); break;
    case 'open-emission': location.assign('origenix-emissao-v3.html'); break;
    case 'export-audit': exportarAuditoriaCSV(target); break;
    case 'clear-audit-filters': limparFiltrosAuditoria(); break;
    case 'refresh-notifications': renderNotifications(); break;
    case 'new-task': abrirFormularioTarefa(); break;
    case 'task-list-view': alterarVisualizacaoTarefas('lista'); break;
    case 'task-agenda-view': alterarVisualizacaoTarefas('agenda'); break;
    case 'agenda-prev-month': mudarMesAgenda(-1); break;
    case 'agenda-next-month': mudarMesAgenda(1); break;
    case 'close-document': fecharDocumento(); break;
    case 'print-document': window.print(); break;
    case 'close-client-overlay': if(event.target===target)fecharDetalhesCliente(); break;
    case 'close-client-details': fecharDetalhesCliente(); break;
    case 'close-dossier-overlay': if(event.target===target)fecharDossieDocumento(); break;
    case 'close-dossier': fecharDossieDocumento(); break;
    case 'copy-document-code': copiarCodigoDocumento(target.dataset.value); break;
    case 'copy-document-hash': copiarHashDocumento(target.dataset.value); break;
    case 'dossier-company': fecharDossieDocumento(); abrirEmpresaDoDocumento(target.dataset.companyId); break;
    case 'upload-attachment': document.getElementById('documentAttachmentInput')?.click(); break;
    case 'delete-attachment': excluirAnexoDocumento(target.dataset.documentId,target.dataset.attachmentId,target.dataset.path,target.dataset.name,target); break;
    case 'open-dossier': abrirDossieDocumento(target.dataset.documentId); break;
    case 'open-document-company': abrirEmpresaDoDocumento(target.dataset.companyId); break;
    case 'documents-page': mudarPaginaDocumentos(Number(target.dataset.page)); break;
    case 'edit-task': abrirFormularioTarefa(target.dataset.taskId); break;
    case 'complete-task': concluirTarefa(target.dataset.taskId,target); break;
    case 'delete-task': excluirTarefa(target.dataset.taskId,target); break;
    case 'tasks-page': mudarPaginaTarefas(Number(target.dataset.page)); break;
    case 'read-notification': marcarNotificacaoLida(target.dataset.notificationType,target.dataset.notificationId,target); break;
    case 'open-notification-document': abrirDocumentoNotificacao(target.dataset.itemId); break;
    case 'open-notification-company': abrirEmpresaDoDocumento(target.dataset.companyId); break;
    case 'audit-page': mudarPaginaAuditoria(Number(target.dataset.page)); break;
    case 'client-details': abrirDetalhesCliente(target.dataset.clientId); break;
    case 'edit-client': editarCliente(target.dataset.clientId); break;
    case 'generate-document': gerarDocumento(target.dataset.clientId); break;
    case 'archive-client': alterarSituacaoCliente(target.dataset.clientId,false); break;
    case 'restore-client': alterarSituacaoCliente(target.dataset.clientId,true); break;
    case 'clients-page': mudarPaginaClientes(Number(target.dataset.page)); break;
    case 'details-edit-client': fecharDetalhesCliente(); editarCliente(target.dataset.clientId); break;
    case 'details-generate-document': fecharDetalhesCliente(); gerarDocumento(target.dataset.clientId); break;
    case 'open-client-pacs': location.assign('origenix-pacs.html?empresa='+encodeURIComponent(target.dataset.clientId)); break;
  }
}

function handleSystemInput(event){
  switch(event.target.dataset.inputAction){
    case 'search-clients': agendarBuscaClientes(); break;
    case 'search-documents': agendarBuscaDocumentos(); break;
    case 'search-audit': agendarBuscaAuditoria(); break;
    case 'search-notifications': agendarBuscaNotificacoes(); break;
    case 'search-tasks': agendarBuscaTarefas(); break;
  }
}

function handleSystemChange(event){
  switch(event.target.dataset.changeAction){
    case 'filter-clients': reiniciarListaClientes(); break;
    case 'filter-documents': reiniciarListaDocumentos(); break;
    case 'filter-audit': reiniciarAuditoria(); break;
    case 'filter-notifications': renderNotificationRows(); break;
    case 'filter-tasks': reiniciarTarefas(); break;
  }
}

document.addEventListener('click',handleSystemAction);
document.addEventListener('input',handleSystemInput);
document.addEventListener('change',handleSystemChange);

// init
initAuth();
