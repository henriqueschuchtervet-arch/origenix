import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };
const allowedRoles = new Set(["consultor", "rt", "colaborador", "cliente"]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = new Set([
    "https://origenix.netlify.app",
    "http://localhost:4173",
    ...configured,
  ]);
  const netlifyPreview = /^https:\/\/(?:deploy-preview-\d+|[a-z0-9-]+)--origenix\.netlify\.app$/i.test(origin);

  return {
    "Access-Control-Allow-Origin": allowed.has(origin) || netlifyPreview
      ? origin
      : "https://origenix.netlify.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function response(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...corsHeaders(req) },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return response(req, 405, { error: "Método não permitido." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return response(req, 401, { error: "Autenticação obrigatória." });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData.user) {
    return response(req, 401, { error: "Sessão inválida ou expirada." });
  }

  const { data: callerProfile, error: profileError } = await callerClient
    .from("perfis")
    .select("papel, ativo, status")
    .eq("user_id", authData.user.id)
    .single();

  if (
    profileError ||
    !callerProfile ||
    callerProfile.papel !== "admin" ||
    !callerProfile.ativo ||
    callerProfile.status !== "ativo"
  ) {
    return response(req, 403, { error: "Apenas administradores ativos podem convidar usuários." });
  }

  let payload: { requestId?: string; papel?: string; empresaId?: string | null };
  try {
    payload = await req.json();
  } catch {
    return response(req, 400, { error: "Corpo da solicitação inválido." });
  }

  const requestId = payload.requestId?.trim();
  const papel = payload.papel?.trim();
  const empresaId = payload.empresaId?.trim() || null;

  if (!requestId || !papel || !allowedRoles.has(papel)) {
    return response(req, 400, { error: "Solicitação, papel ou empresa inválidos." });
  }

  const { data: accessRequest, error: requestError } = await adminClient
    .from("access_requests")
    .select("id, nome, email, status")
    .eq("id", requestId)
    .single();

  if (requestError || !accessRequest) {
    return response(req, 404, { error: "Solicitação não encontrada." });
  }
  if (accessRequest.status === "convidado") {
    return response(req, 409, { error: "Esta solicitação já foi convidada." });
  }

  const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") ??
    "https://origenix.netlify.app/origenix-sistema-login.html";
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin
    .inviteUserByEmail(accessRequest.email, {
      redirectTo,
      data: { nome: accessRequest.nome, origem: "access_request" },
    });

  if (inviteError || !inviteData.user) {
    return response(req, 422, {
      error: inviteError?.message ?? "Não foi possível enviar o convite.",
    });
  }

  const userId = inviteData.user.id;
  const { error: activationError } = await adminClient.from("perfis").upsert({
    user_id: userId,
    nome: accessRequest.nome,
    papel,
    ativo: true,
    status: "ativo",
    atualizado_em: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (activationError) {
    return response(req, 500, { error: "Convite criado, mas a ativação do perfil falhou." });
  }

  if (empresaId) {
    const { error: memberError } = await adminClient.from("empresa_membros").upsert({
      empresa_id: empresaId,
      user_id: userId,
      papel,
      ativo: true,
    }, { onConflict: "empresa_id,user_id" });
    if (memberError) {
      return response(req, 500, { error: "Perfil ativado, mas o vínculo com a empresa falhou." });
    }
  }

  const { error: updateError } = await adminClient
    .from("access_requests")
    .update({
      status: "convidado",
      papel_solicitado: papel,
      empresa_id: empresaId,
      revisado_por: authData.user.id,
      revisado_em: new Date().toISOString(),
      convidado_user_id: userId,
    })
    .eq("id", requestId);

  if (updateError) {
    return response(req, 500, { error: "Usuário convidado, mas a solicitação não foi atualizada." });
  }

  return response(req, 200, { ok: true, message: "Convite enviado e acesso preparado." });
});
