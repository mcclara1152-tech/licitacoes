import { useState, useEffect, useRef } from "react";

// ─── Supabase config ──────────────────────────────────────────────────────────
const SUPA_URL = "https://uhhgqzngkzruvxpyaxmr.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoaGdxem5na3pydXZ4cHlheG1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MDY5ODEsImV4cCI6MjA5NDE4Mjk4MX0.NiJ9uji5MLeQJCiO-GMCQcJmGvqBGgxlTGtACA29t7o";

const supa = {
  async req(path, opts={}) {
    const r = await fetch(`${SUPA_URL}/rest/v1${path}`, {
      ...opts,
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${supa._token||SUPA_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
        ...(opts.headers||{}),
      },
    });
    if(!r.ok){ const e=await r.json().catch(()=>{}); throw new Error(e?.message||r.statusText); }
    const text=await r.text();
    return text?JSON.parse(text):null;
  },
  async authReq(path, body, method="POST") {
    const r = await fetch(`${SUPA_URL}/auth/v1${path}`, {
      method, body: JSON.stringify(body),
      headers: {"apikey":SUPA_KEY,"Content-Type":"application/json"},
    });
    const data = await r.json();
    if(!r.ok) throw new Error(data?.error_description||data?.message||"Erro");
    return data;
  },
  _token: null,
  _user: null,
  async signIn(email, password) {
    const data = await this.authReq("/token?grant_type=password", {email,password});
    this._token = data.access_token;
    this._user = data.user;
    localStorage.setItem("sb_token", data.access_token);
    localStorage.setItem("sb_refresh", data.refresh_token);
    return data;
  },
  async signUp(email, password, nome) {
    const data = await this.authReq("/signup", {email, password, data:{nome}});
    return data;
  },
  async getDicas(){ return await this.req("/dicas?select=*&order=criado_em")||[]; },
  async upsertDica(d){ return await this.req("/dicas",{method:"POST",body:JSON.stringify(d),headers:{"Prefer":"resolution=merge-duplicates,return=representation"}}); },
  async updateDica(id,ch){ return await this.req(`/dicas?id=eq.${id}`,{method:"PATCH",body:JSON.stringify(ch)}); },
  async deleteDica(id){ return await this.req(`/dicas?id=eq.${id}`,{method:"DELETE"}); },
  async signOut() {
    await this.authReq("/logout", {}, "POST").catch(()=>{});
    this._token=null; this._user=null;
    localStorage.removeItem("sb_token"); localStorage.removeItem("sb_refresh");
  },
  async uploadAnexo(processoId, docUid, file) {
    const ext = file.name.split('.').pop();
    const path = `${processoId}/${docUid}/${Date.now()}.${ext}`;
    const r = await fetch(`${SUPA_URL}/storage/v1/object/processos/${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this._token}`,
        "x-upsert": "false",
      },
      body: file,
    });
    if(!r.ok){ const e=await r.json().catch(()=>{}); throw new Error(e?.message||"Erro no upload"); }
    return path;
  },
  getAnexoUrl(path) {
    return `${SUPA_URL}/storage/v1/object/authenticated/processos/${path}`;
  },
  async getAnexoSigned(path) {
    const r = await fetch(`${SUPA_URL}/storage/v1/object/sign/processos/${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this._token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({expiresIn: 3600}),
    });
    const data = await r.json();
    return `${SUPA_URL}/storage/v1${data.signedURL}`;
  },
  async deleteAnexo(path) {
    await this.req(`/storage/v1/object/processos/${path}`, {method:"DELETE"});
  },
  async resetPassword(email) {
    const r = await fetch(`${SUPA_URL}/auth/v1/recover`, {
      method: "POST",
      headers: {"apikey":SUPA_KEY,"Content-Type":"application/json"},
      body: JSON.stringify({email, redirect_to: window.location.origin + window.location.pathname}),
    });
    if(!r.ok){ const e=await r.json().catch(()=>{}); throw new Error(e?.message||"Erro ao enviar email"); }
  },
  async restoreSession() {
    const token = localStorage.getItem("sb_token");
    const refresh = localStorage.getItem("sb_refresh");
    if(!token) return null;
    try {
      const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
        headers:{"apikey":SUPA_KEY,"Authorization":`Bearer ${token}`}
      });
      if(r.ok){ const u=await r.json(); this._token=token; this._user=u; return u; }
      // Token expirado  --  tenta refresh
      if(refresh){
        const rd=await this.authReq("/token?grant_type=refresh_token",{refresh_token:refresh});
        this._token=rd.access_token; this._user=rd.user;
        localStorage.setItem("sb_token",rd.access_token);
        localStorage.setItem("sb_refresh",rd.refresh_token);
        return rd.user;
      }
    } catch{}
    return null;
  },
  // CRUD
  async getPerfil(uid){ const d=await this.req(`/perfis?id=eq.${uid}&select=*`); return d?.[0]||null; },
  async getPerfis(){ return await this.req("/perfis?select=*&order=criado_em"); },
  async updatePerfil(uid,ch){ return await this.req(`/perfis?id=eq.${uid}`,{method:"PATCH",body:JSON.stringify(ch)}); },
  async getProcessos(){ return await this.req("/processos?select=*&order=criado_em.desc")||[]; },
  async upsertProcesso(p){ return await this.req("/processos",{method:"POST",body:JSON.stringify(p),headers:{"Prefer":"resolution=merge-duplicates,return=representation"}}); },
  async deleteProcesso(id){ return await this.req(`/processos?id=eq.${id}`,{method:"DELETE"}); },
  async getSecretarias(){ return await this.req("/secretarias?select=*&order=criado_em")||[]; },
  async upsertSecretaria(s){ return await this.req("/secretarias",{method:"POST",body:JSON.stringify(s),headers:{"Prefer":"resolution=merge-duplicates,return=representation"}}); },
  async deleteSecretaria(id){ return await this.req(`/secretarias?id=eq.${id}`,{method:"DELETE"}); },
};

// ─── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  paper:"#f0e8d5", paperDark:"#e0d4bb", paperDeep:"#cfc0a0",
  tape:"#d4b896", ink:"#1a1208", inkLight:"#2e200e",
  faded:"#6b5a3e", ghost:"#9a8870", terra:"#8b3a1a", terraLight:"#b05c2e",
  ochre:"#a06820", ochreLight:"#c98a2e", sage:"#4a6040", rust:"#7a2810",
  violet:"#5a3a8a", black:"#0a0802",
};

const FONT_URL = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=swap";

const MODALIDADES = ["Concorrência","Pregão","Concurso","Leilão","Diálogo Competitivo","Dispensa","Inexigibilidade"];

const MODAL_CODES = {
  "Concorrência":{code:"CONC",color:C.terra},"Pregão":{code:"PREG",color:C.sage},
  "Concurso":{code:"CONS",color:C.rust},"Leilão":{code:"LEIL",color:C.ochre},
  "Diálogo Competitivo":{code:"DIAL",color:C.faded},"Dispensa":{code:"DISP",color:C.violet},
  "Inexigibilidade":{code:"INEX",color:"#2a5a8a"},
};

const ETAPAS_MOD = {
  "Concorrência":[
    "Ofício com DFD -- Secretaria Solicitante",
    "Projetos de Engenharia",
    "Planilha Orçamentária",
    "CPU -- Composição de Preço Unitário",
    "Planilha de Encargos Sociais",
    "BDI",
    "Cronograma Físico-Financeiro",
    "ETP -- Estudo Técnico Preliminar",
    "TR -- Termo de Referência",
    "Autuação do Processo",
    "Despacho para Dotação",
    "Resposta da Dotação",
    "Ofício ao Gestor de Licitação",
    "Autorização Inicial e Adequação Orçamentária",
    "Elaboração da Minuta do Edital",
    "Despacho ao Jurídico",
    "Parecer Jurídico Inicial",
    "Elaboração do Edital",
    "Ofício de Solicitação de Autorização para Publicação",
    "Autorização para Publicar",
    "Despacho ao Agente de Contratação",
    "Portaria do Agente com Certificado Anexo",
    "Edital Assinado",
    "Aviso de Licitação",
    "Publicação dos Avisos (Jornais, PNCP, GEO-Obras e Portal)",
    "Abertura do Processo",
    "Garantia da Proposta",
    "Proposta Final do Vencedor",
    "Despacho para Engenharia -- Análise da Proposta",
    "Parecer Técnico da Proposta",
    "Habilitação do Vencedor",
    "Autenticidade das Certidões",
    "Despacho para Engenharia -- Análise da Qualificação",
    "Parecer Técnico da Habilitação",
    "Fase de Recursos (se houver)",
    "Atos de Recurso (se houver)",
    "Ata Final Assinada",
    "Vencedores da Concorrência",
    "Recursos com Ata, Parecer e Despachos",
    "Despacho ao Controle Interno",
    "Parecer do Controle Interno",
    "Adjudicação e Homologação no Sistema",
    "Publicação da Homologação",
    "Solicitação de Garantia Contratual ao Vencedor (10 dias úteis)",
    "Solicitação de Inclusão no ASPEC e GEO-Obras",
    "Solicitação de Designação de Fiscal de Contrato",
    "Juntada da Garantia Contratual",
    "Convocação para Assinatura do Contrato",
    "Contrato Assinado pelo Vencedor e Ordenador",
    "Publicação do Contrato (PNCP, GEO-Obras e Diário)",
    "Despacho para Arquivo",
    "Termo de Encerramento"
  ],
  "Pregão":[
    "Ofício com DFD -- Secretaria Solicitante",
    "ETP -- Estudo Técnico Preliminar",
    "TR -- Termo de Referência",
    "Pesquisa de Preços",
    "Autuação do Processo",
    "Dotação Orçamentária",
    "Autorização Inicial",
    "Elaboração da Minuta do Edital",
    "Parecer Jurídico",
    "Edital Assinado",
    "Publicação do Edital",
    "Sessão Pública de Lances",
    "Negociação com o Primeiro Colocado",
    "Habilitação do Vencedor",
    "Fase de Recursos",
    "Ata da Sessão Pública",
    "Homologação",
    "Contrato Assinado",
    "Publicação do Contrato"
  ],
  "Concurso":["Definição do Objeto","Elaboração do Regulamento","Publicação do Regulamento","Prazo de Inscrições","Avaliação das Obras e Propostas","Divulgação do Resultado","Fase de Recursos","Homologação","Premiação e Contratação","Encerramento"],
  "Leilão":["Avaliação do Bem","Elaboração do Edital","Publicação do Edital","Sessão Pública de Lances","Arrematação","Pagamento","Transferência do Bem","Encerramento"],
  "Diálogo Competitivo":["ETP -- Estudo Técnico Preliminar","Publicação do Edital de Chamamento","Fase de Diálogos com os Interessados","Convite para Propostas Finais","Recebimento de Propostas Finais","Julgamento das Propostas","Negociação Final","Habilitação do Vencedor","Fase de Recursos","Homologação","Assinatura do Contrato","Execução e Fiscalização","Encerramento"],
  "Dispensa":[
    "Capa do Processo Administrativo",
    "Solicitação de Contratação Direta",
    "Autorização para Abertura do Processo",
    "Dotação Orçamentária",
    "Justificativa da Contratação (art. 75 da Lei 14.133/2021)",
    "Justificativa de Preço",
    "Documentos de Habilitação do Fornecedor",
    "Parecer Jurídico",
    "Ratificação pelo Ordenador de Despesas",
    "Publicação no PNCP",
    "Contrato ou Empenho"
  ],
  "Inexigibilidade":[
    "Capa do Processo Administrativo",
    "Solicitação de Contratação Direta por Inexigibilidade",
    "Autorização para Abertura do Processo",
    "Dotação Orçamentária",
    "Justificativa de Inexigibilidade (art. 74 da Lei 14.133/2021)",
    "Comprovação de Notória Especialização",
    "Documentos de Habilitação do Fornecedor",
    "Parecer Jurídico",
    "Ratificação pelo Ordenador de Despesas",
    "Publicação no PNCP",
    "Contrato ou Empenho"
  ],
};

const FASES = {
  "Concorrência":[
    {id:"f1",label:"Instrução Inicial",cor:C.terra,docs:[{id:"d1",nome:"Ofício com DFD",resp:"SEPLAGE"},{id:"d2",nome:"Projetos de Engenharia",resp:"Engenharia"},{id:"d3",nome:"Planilha Orçamentária",resp:"Engenharia"},{id:"d4",nome:"CPU  --  Composição de Preço Unitário",resp:"Engenharia"},{id:"d5",nome:"Planilha de Encargos Sociais",resp:"Engenharia"},{id:"d6",nome:"BDI",resp:"Engenharia"},{id:"d7",nome:"Cronograma Físico-Financeiro",resp:"Engenharia"},{id:"d8",nome:"ETP  --  Estudo Técnico Preliminar",resp:"Engenharia / Planejamento"},{id:"d9",nome:"TR  --  Termo de Referência",resp:"Engenharia"},{id:"d10",nome:"Autuação do Processo",resp:"SEPLAGE"},{id:"d11",nome:"Despacho para Dotação",resp:"SEPLAGE"},{id:"d12",nome:"Resposta da Dotação",resp:"Contabilidade"},{id:"d13",nome:"Ofício ao Gestor de Licitação",resp:"Taty"},{id:"d14",nome:"Autorização Inicial e Adequação Orçamentária",resp:"Ordenador"}]},
    {id:"f2",label:"Elaboração e Publicação",cor:C.ochre,docs:[{id:"d15",nome:"Elaboração da Minuta do Edital",resp:"Planejamento / Thayná"},{id:"d16",nome:"Despacho ao Jurídico",resp:"Planejamento / Thayná"},{id:"d17",nome:"Parecer Jurídico Inicial",resp:"Procuradoria"},{id:"d18",nome:"Elaboração do Edital",resp:"Planejamento / Nós"},{id:"d19",nome:"Ofício de Solicitação de Autorização para Publicação",resp:"Licitação / Taty"},{id:"d20",nome:"Autorização para Publicar",resp:"Ordenador"},{id:"d21",nome:"Despacho ao Agente de Contratação",resp:"Licitação / Taty"},{id:"d22",nome:"Portaria do Agente com Certificado Anexo",resp:"Agente"},{id:"d23",nome:"Edital Assinado",resp:"Agente, Planejamento e Ordenador"},{id:"d24",nome:"Aviso de Licitação",resp:"Agente"},{id:"d25",nome:"Publicação dos Avisos (jornais, PNCP, GEO-Obras, Portal)",resp:"Setor de Publicação"}]},
    {id:"f3",label:"Abertura e Julgamento",cor:C.faded,docs:[{id:"d26",nome:"Abertura do Processo",resp:"Agente"},{id:"d27",nome:"Garantia da Proposta",resp:"Licitante"},{id:"d28",nome:"Proposta Final do Vencedor",resp:"Licitante"},{id:"d29",nome:"Despacho p/ Engenharia  --  Análise da Proposta",resp:"Agente"},{id:"d30",nome:"Parecer Técnico da Proposta",resp:"Engenharia"},{id:"d31",nome:"Habilitação do Vencedor",resp:"Licitante"},{id:"d32",nome:"Autenticidade das Certidões",resp:"Apoio"},{id:"d33",nome:"Despacho p/ Engenharia  --  Análise da Qualificação",resp:"Agente"},{id:"d34",nome:"Parecer Técnico da Habilitação",resp:"Engenharia"},{id:"d35",nome:"Fase de Recursos (se houver)",resp:"Agente"},{id:"d36",nome:"Atos de Recurso (se houver)",resp:"Agente / Apoio"},{id:"d37",nome:"Ata Final Assinada",resp:"Agente e Apoio"},{id:"d38",nome:"Vencedores da Concorrência",resp:"Agente e Apoio"},{id:"d39",nome:"Recursos com Ata, Parecer e Despachos",resp:"Agente e Apoio"}]},
    {id:"f4",label:"Controle e Homologação",cor:C.sage,docs:[{id:"d40",nome:"Despacho ao Controle Interno",resp:"Controle Interno"},{id:"d41",nome:"Parecer do Controle Interno",resp:"Controle Interno"},{id:"d42",nome:"Adjudicação e Homologação no Sistema",resp:"Gestor"},{id:"d43",nome:"Publicação da Homologação",resp:"Setor de Publicação"}]},
    {id:"f5",label:"Contratação",cor:C.inkLight,docs:[{id:"d44",nome:"Solicitação de Garantia Contratual (10 dias úteis)",resp:"Agente e Apoio"},{id:"d45",nome:"Inclusão no ASPEC e GEO-Obras",resp:"Publicação"},{id:"d46",nome:"Designação de Fiscal de Contrato",resp:"Agente e Apoio"},{id:"d47",nome:"Juntada da Garantia Contratual",resp:"Vencedor"},{id:"d48",nome:"Convocação para Assinatura do Contrato",resp:"Contratos"},{id:"d49",nome:"Contrato Assinado",resp:"Vencedor e Ordenador"},{id:"d50",nome:"Publicação do Contrato (PNCP, GEO-Obras, Diário)",resp:"Setor de Publicação"},{id:"d51",nome:"Despacho para Arquivo",resp:"Apoio"},{id:"d52",nome:"Termo de Encerramento",resp:"Apoio"}]},
  ],
  "Pregão":[
    {id:"f1",label:"Instrução",cor:C.terra,docs:[{id:"d1",nome:"Ofício com DFD",resp:"SEPLAGE"},{id:"d2",nome:"ETP",resp:"Planejamento"},{id:"d3",nome:"TR  --  Termo de Referência",resp:"Planejamento"},{id:"d4",nome:"Pesquisa de Preços",resp:"Planejamento"},{id:"d5",nome:"Autuação do Processo",resp:"SEPLAGE"},{id:"d6",nome:"Dotação Orçamentária",resp:"Contabilidade"},{id:"d7",nome:"Autorização Inicial",resp:"Ordenador"}]},
    {id:"f2",label:"Edital",cor:C.ochre,docs:[{id:"d8",nome:"Minuta do Edital",resp:"Planejamento"},{id:"d9",nome:"Parecer Jurídico",resp:"Procuradoria"},{id:"d10",nome:"Edital Assinado",resp:"Agente e Ordenador"},{id:"d11",nome:"Publicação",resp:"Setor de Publicação"}]},
    {id:"f3",label:"Sessão e Julgamento",cor:C.faded,docs:[{id:"d12",nome:"Sessão Pública de Lances",resp:"Agente"},{id:"d13",nome:"Negociação",resp:"Agente"},{id:"d14",nome:"Habilitação",resp:"Licitante"},{id:"d15",nome:"Recursos",resp:"Agente"},{id:"d16",nome:"Ata da Sessão",resp:"Agente"}]},
    {id:"f4",label:"Contrato",cor:C.sage,docs:[{id:"d17",nome:"Homologação",resp:"Gestor"},{id:"d18",nome:"Contrato Assinado",resp:"Vencedor e Ordenador"},{id:"d19",nome:"Publicação do Contrato",resp:"Setor de Publicação"}]},
  ],
  "Dispensa":[
    {id:"fd1",label:"Instrução",cor:C.violet,docs:[{id:"dd1",nome:"Capa",resp:"Solicitante"},{id:"dd2",nome:"Solicitação",resp:"Solicitante"},{id:"dd3",nome:"Autorização",resp:"Ordenador"},{id:"dd4",nome:"Dotação Orçamentária",resp:"Contabilidade"}]},
    {id:"fd2",label:"Justificativa",cor:"#7c5cbf",docs:[{id:"dd5",nome:"Justificativa da Contratação",resp:"Solicitante"},{id:"dd6",nome:"Justificativa de Preço",resp:"Solicitante"},{id:"dd7",nome:"Documentos do Fornecedor",resp:"Fornecedor"}]},
    {id:"fd3",label:"Jurídico",cor:"#5a3a8a",docs:[{id:"dd8",nome:"Parecer Jurídico",resp:"Procuradoria"},{id:"dd9",nome:"Ratificação",resp:"Ordenador"}]},
    {id:"fd4",label:"Formalização",cor:C.sage,docs:[{id:"dd10",nome:"Publicação no PNCP",resp:"Setor de Publicação"},{id:"dd11",nome:"Contrato / Empenho",resp:"Contratos"}]},
  ],
  "Inexigibilidade":[
    {id:"fi1",label:"Instrução",cor:"#2a5a8a",docs:[{id:"di1",nome:"Capa",resp:"Solicitante"},{id:"di2",nome:"Solicitação",resp:"Solicitante"},{id:"di3",nome:"Autorização",resp:"Ordenador"},{id:"di4",nome:"Dotação Orçamentária",resp:"Contabilidade"}]},
    {id:"fi2",label:"Justificativa",cor:"#1a4a7a",docs:[{id:"di5",nome:"Justificativa de Inexigibilidade",resp:"Solicitante"},{id:"di6",nome:"Comprovação de Notória Especialização",resp:"Solicitante"},{id:"di7",nome:"Documentos do Fornecedor",resp:"Fornecedor"}]},
    {id:"fi3",label:"Jurídico",cor:"#0a3a6a",docs:[{id:"di8",nome:"Parecer Jurídico",resp:"Procuradoria"},{id:"di9",nome:"Ratificação",resp:"Ordenador"}]},
    {id:"fi4",label:"Formalização",cor:C.sage,docs:[{id:"di10",nome:"Publicação no PNCP",resp:"Setor de Publicação"},{id:"di11",nome:"Contrato / Empenho",resp:"Contratos"}]},
  ],
};

function getFases(mod){ return FASES[mod]||[]; }

const STATUS_DOC={pendente:{label:"PENDENTE",dot:C.ghost,bg:"#ede4d0",border:C.tape},"em elaboração":{label:"ELABORANDO",dot:C.ochre,bg:"#f5ead0",border:C.ochreLight},aguardando:{label:"AGUARDANDO",dot:C.violet,bg:"#ece8f5",border:"#9a7acf"},concluído:{label:"CONCLUÍDO",dot:C.sage,bg:"#deebd8",border:"#7aaa6a"},dispensado:{label:"DISPENSADO",dot:C.ghost,bg:"#e8e4dc",border:C.ghost}};
const STATUS_ETAPA={pendente:{label:"PENDENTE",dot:C.ghost,bg:"#ede4d0",border:C.tape},"em andamento":{label:"EM CURSO",dot:C.ochre,bg:"#f5ead0",border:C.ochreLight},concluída:{label:"CONCLUÍDA",dot:C.sage,bg:"#deebd8",border:"#7aaa6a"},bloqueada:{label:"BLOQUEADA",dot:C.rust,bg:"#f0dcd8",border:"#c07060"}};

const DICAS_ETAPAS={
  // Concorrência
  "Estudo Técnico Preliminar (ETP)": "Documento obrigatório pelo art. 18 da Lei 14.133/2021. Deve demonstrar a necessidade da contratação, as alternativas consideradas e a justificativa da solução escolhida. Atenção ao item 5 do ETP: verifique se há preferência por produto nacional  --  se houver margem de preferência de 10%, existe um textinho pronto que pode ser usado. Elaborado pela Engenharia em conjunto com o Planejamento.",
  "Termo de Referência / Projeto Básico": "O TR é usado em contratações de serviços; o Projeto Básico, em obras. Deve conter: objeto detalhado, prazo de execução, critérios de medição e pagamento, obrigações das partes e critérios de qualificação técnica.",
  "Pesquisa de Preços": "Levantamento de preços de mercado para estimar o valor da contratação. Use preferencialmente o SINAPI para obras e o COMPRASNET para serviços. Documente todas as fontes consultadas.",
  "Elaboração do Edital": "Esta é a versão final do edital  --  após o parecer jurídico, incorpore todas as correções apontadas pela Procuradoria e finalize o documento. Esta versão é a que será publicada e vincula juridicamente o processo. Certifique-se de que as alterações da minuta foram devidamente aplicadas antes de seguir para assinatura.",
  "Publicação do Edital": "Sempre marcar a sessão de abertura às 9h. Para calcular a data da sessão: o prazo mínimo é de 25 dias úteis contados a partir do dia SEGUINTE à publicação (não conta o dia da publicação). Publicar no PNCP (obrigatório), DOE e, se o valor exigir, em jornal de grande circulação. Imprimir o despacho das publicações em duas vias  --  uma no processo, outra fica com o Setor de Publicação. Assinado pela secretária da SUPRI.",
  "Prazo de Impugnações": "Período em que os interessados podem questionar o edital. Dura até 3 dias úteis antes da sessão. Responda todas as impugnações por escrito e publique as respostas.",
  "Sessão Pública de Abertura": "Conduzida pelo Agente de Contratação. Abertura dos envelopes de proposta, verificação de conformidade e início do julgamento. Lavrar ata detalhada de tudo que ocorreu.",
  "Habilitação": "Verificação da regularidade do vencedor em quatro frentes: (1) JURÍDICA  --  contrato social, CNPJ, procuração se houver; (2) FISCAL  --  Certidão Negativa Municipal, Estadual, Federal/Dívida Ativa, FGTS e CNDT (trabalhista); (3) TÉCNICA  --  acervo técnico compatível com o objeto; (4) ECONÔMICO-FINANCEIRA  --  balanço patrimonial. Todos os documentos devem estar previstos no edital e dentro do prazo de validade na data da sessão.",
  "Julgamento das Propostas": "Análise das propostas conforme o critério definido no edital (menor preço, melhor técnica etc.). A Engenharia emite parecer técnico verificando se a proposta está de acordo com o edital  --  especialmente se o valor proposto é compatível com o orçamento estimado. Dica: compare com a tabela QCI e veja se o valor bate com o do ETP.",
  "Recursos": "Prazo de 3 dias úteis após cada decisão para interposição de recurso. O Agente deve notificar os demais licitantes para contrarrazões. Resposta motivada obrigatória.",
  "Homologação": "Ato do Ordenador de Despesas que confirma a regularidade do processo e o resultado do julgamento. Atenção ao critério de julgamento: obras com apenas um objeto costumam ser homologadas por valor global; quando há mais de uma obra ou lote, a homologação é por lote. Importante: nos processos que geram Ata de Registro de Preços, o órgão que abriu o processo passa a ser o Gerenciador da ata; nos que não geram ata, permanece como Demandante. Publicar no PNCP em até 3 dias úteis.: obras com apenas um objeto costumam ser homologadas por valor global; quando há mais de uma obra ou lote, a homologação é por lote. Publicar no PNCP em até 3 dias úteis.",
  "Assinatura do Contrato": "Convocar o vencedor para assinar dentro do prazo previsto no edital (geralmente 5 dias úteis). Exigir a garantia contratual antes da assinatura (geralmente 5% do valor).",
  "Publicação do Contrato": "Publicar no PNCP em até 20 dias úteis após a assinatura. Publicar também no GEO-Obras se for obra de engenharia e extrato no Diário Oficial.",
  "Execução / Fiscalização": "O Fiscal de Contrato designado deve acompanhar a execução, registrar ocorrências, atestar medições e comunicar irregularidades ao gestor. Manter diário de obra atualizado.",
  "Encerramento": "Após a conclusão do objeto, emitir o Termo de Recebimento Definitivo, publicar o encerramento no PNCP e arquivar o processo completo.",
  // Dispensa
  "Capa": "A capa identifica o processo administrativo. Deve conter: número do processo (ex: 2208001/2025/SEPLAGE), objeto resumido, modalidade (Dispensa de Licitação), data de abertura e a secretaria solicitante.",
  "Solicitação": "Documento assinado pelo responsável da secretaria solicitante descrevendo: o que está sendo solicitado, a quantidade, a justificativa da necessidade e o valor estimado. É a origem formal do processo.",
  "Autorização": "Despacho do ordenador de despesas autorizando a abertura do processo e a realização da despesa. Sem essa autorização, o processo não pode prosseguir.",
  "Dotação Orçamentária": "A Dotação define de onde vai sair o dinheiro  --  é a confirmação de que há verba disponível no orçamento para cobrir essa despesa. Quando receber o despacho de resposta da Contabilidade, copie o texto exato da dotação informada  --  esse texto será reproduzido em vários documentos ao longo do processo. Sem dotação confirmada, o processo não pode prosseguir.",
  "Justificativa da Contratação": "Documento que demonstra que o caso se enquadra em uma das hipóteses do art. 75 da Lei 14.133/2021. Seja específico: cite o inciso aplicável e explique por que a licitação não é viável ou necessária.",
  "Justificativa de Preço": "Comprova que o valor a ser pago é compatível com o mercado. Use no mínimo 3 orçamentos de fornecedores diferentes, ou tabelas de referência oficiais (SINAPI, CMED, SEINFRA etc.).",
  "Documentos do Fornecedor": "Habilitação jurídica e regularidade fiscal do fornecedor: CNPJ, contrato social, certidões negativas de débito (federal, estadual, municipal, FGTS, trabalhista). Todas devem estar válidas na data.",
  "Parecer Jurídico": "Análise da Procuradoria sobre a legalidade do processo. Verifica o enquadramento legal, a regularidade dos documentos e a compatibilidade com a Lei 14.133/2021. É obrigatório antes da ratificação.",
  "Ratificação": "Ato do ordenador de despesas que autoriza formalmente a contratação direta após o parecer jurídico favorável. Somente após a ratificação o processo pode ser publicado e o contrato assinado.",
  "Publicação no PNCP": "A publicação no Portal Nacional de Contratações Públicas é obrigatória pela Lei 14.133/2021, mesmo nas dispensas. Deve ocorrer antes da assinatura do contrato.",
  "Contrato / Empenho": "Formalização da contratação. Para valores menores, pode ser substituído por nota de empenho. Para contratos, exigir assinatura do representante legal do fornecedor e do ordenador.",
  // Inexigibilidade
  "Justificativa de Inexigibilidade": "CONCEITO: Na Inexigibilidade, a licitação não é dispensada -- ela é impossível, porque não existe competição viável. O art. 74 da Lei 14.133/2021 prevê os casos: fornecedor exclusivo (inciso I), serviços técnicos especializados de natureza predominantemente intelectual (inciso III) e profissional do setor artístico consagrado (inciso II). Este documento deve provar com fatos concretos que a competição é inviável -- seja por exclusividade do fornecedor (art. 74, I) ou notória especialização (art. 74, III). Cite o inciso específico e fundamente com fatos concretos.",
  "Comprovação de Notória Especialização": "Para contratações por notória especialização: junte currículo completo, obras ou serviços realizados, prêmios, publicações, certificados e reconhecimento formal do meio técnico. Quanto mais robusto, melhor.",
  // Pregão
  "Sessão Pública  --  Lances": "Sessão eletrônica (via COMPRASNET ou plataforma similar) ou presencial de lances. O Pregoeiro conduz a disputa, negocia com o menor lance e verifica a exequibilidade da proposta.",
  "Negociação": "Após os lances, o Pregoeiro negocia diretamente com o primeiro colocado para tentar reduzir ainda mais o valor. Registrar toda a negociação na ata.",
  "Ata da Sessão": "Documento que registra todos os atos da sessão pública: propostas, lances, negociação, resultado e recursos. Deve ser assinada pelo Pregoeiro e pela equipe de apoio.",
};

const SUBTITULOS_DOC={
  // Concorrência
  "d1":"Documento de Formalização de Demanda  --  pedido formal da secretaria ao setor de licitações",
  "d2":"Projetos técnicos necessários para execução da obra (arquitetônico, estrutural, elétrico etc.)",
  "d3":"Levantamento detalhado dos custos da obra com base no SINAPI",
  "d4":"Detalhamento do custo de cada item da planilha com insumos e quantidades",
  "d5":"Cálculo dos encargos trabalhistas incidentes sobre a mão de obra",
  "d6":"Percentual de benefícios e despesas indiretas sobre o custo direto da obra",
  "d7":"Planejamento da execução física e dos desembolsos financeiros mês a mês",
  "d8":"Estudo que justifica a necessidade e a solução de contratação escolhida",
  "d9":"Documento que define o objeto, prazo, obrigações e critérios da contratação",
  "d10":"Formalização da abertura do processo  --  aqui é gerado o número do processo administrativo",
  "d11":"Memorando ao setor de Contabilidade solicitando confirmação da disponibilidade orçamentária",
  "d12":"Confirmação da Contabilidade com a rubrica de onde sairá o recurso  --  copie o texto exato",
  "d13":"Comunicação formal ao Gestor de Licitações solicitando abertura do processo licitatório",
  "d14":"Autorização do Prefeito ou Secretário competente para início do processo",
  "d15":"Rascunho inicial do edital  --  consultar QCI, ETP (item 5) e item 8 do TR antes de redigir",
  "d16":"Encaminhamento da minuta ao setor jurídico para análise de legalidade",
  "d17":"Análise da Procuradoria sobre a legalidade do processo  --  atentar para quem assinou",
  "d18":"Versão final do edital após incorporar correções do jurídico  --  documento que será publicado",
  "d19":"Comunicação formal ao Ordenador solicitando autorização para publicar o edital",
  "d20":"Autorização do Ordenador de Despesas para proceder com a publicação",
  "d21":"Comunicação designando o Agente de Contratação para conduzir o certame",
  "d22":"Ato formal de designação do Agente  --  deve ser publicado antes da sessão com certificado anexo",
  "d23":"Documento principal do certame  --  assinado pelo Agente, Planejamento e Ordenador",
  "d24":"Resumo do edital para publicação nos veículos de comunicação",
  "d25":"Publicação no PNCP, DOE e jornal  --  imprimir despacho em duas vias (uma fica com Publicação)",
  "d26":"Início formal da sessão pública pelo Agente de Contratação",
  "d27":"Caução prévia exigida do licitante para garantir seriedade da proposta",
  "d28":"Proposta de preço definitiva apresentada pelo licitante vencedor",
  "d29":"Encaminhamento da proposta à Engenharia para análise técnica de conformidade",
  "d30":"Análise da Engenharia verificando se a proposta está de acordo com o edital e com o QCI/ETP",
  "d31":"Documentos de regularidade jurídica, fiscal, trabalhista e técnica do vencedor",
  "d32":"Verificação da autenticidade e validade das certidões apresentadas pelo vencedor",
  "d33":"Encaminhamento dos documentos de habilitação técnica à Engenharia para análise",
  "d34":"Análise da Engenharia sobre o acervo técnico e capacidade operacional do vencedor",
  "d35":"Abertura de prazo para interposição de recursos pelos licitantes",
  "d36":"Processamento e resposta às razões de recurso apresentadas",
  "d37":"Registro de todos os atos da sessão  --  assinado pelo Agente e pela equipe de apoio",
  "d38":"Lista oficial dos vencedores após julgamento definitivo",
  "d39":"Documentação completa dos recursos interpostos com pareceres e decisões",
  "d40":"Encaminhamento do processo ao Controle Interno para análise prévia à homologação",
  "d41":"Análise do Controle Interno sobre a regularidade do processo  --  verificar ressalvas",
  "d42":"Adjudicação atribui o objeto ao vencedor; homologação encerra o processo licitatório",
  "d43":"Publicação obrigatória no PNCP em até 3 dias úteis após a homologação",
  "d44":"Comunicação ao vencedor para apresentar garantia contratual em até 10 dias úteis",
  "d45":"Registro da obra nos sistemas ASPEC e GEO-Obras",
  "d46":"Designação formal de servidor para acompanhar e fiscalizar a execução do contrato",
  "d47":"Garantia contratual apresentada pelo vencedor  --  geralmente 5% do valor do contrato",
  "d48":"Comunicação ao vencedor para comparecer e assinar o contrato",
  "d49":"Documento contratual assinado pelo vencedor e pelo Ordenador de Despesas",
  "d50":"Publicação do contrato no PNCP (até 20 dias úteis), GEO-Obras e Diário Oficial",
  "d51":"Encaminhamento do processo físico para o arquivo",
  "d52":"Documento que encerra formalmente o processo após execução do contrato",
  // Dispensa
  "dd1":"Identificação do processo  --  inclui número, objeto, modalidade e secretaria solicitante",
  "dd2":"Pedido formal da secretaria descrevendo o que precisa ser contratado e por quê",
  "dd3":"Autorização do Ordenador de Despesas para abertura do processo",
  "dd4":"Confirmação da Contabilidade com a rubrica orçamentária  --  copie o texto exato",
  "dd5":"Justificativa enquadrando o caso no art. 75 da Lei 14.133  --  cite o inciso específico",
  "dd6":"Comprovação de que o valor é de mercado  --  mínimo 3 orçamentos ou tabela oficial",
  "dd7":"Certidões de regularidade da empresa: Municipal, Estadual, Federal, FGTS e CNDT",
  "dd8":"Análise da Procuradoria sobre a legalidade da contratação direta  --  atentar para o assinante",
  "dd9":"Autorização formal do Prefeito para a contratação  --  enviada por e-mail após assinatura",
  "dd10":"Publicação obrigatória no PNCP antes da assinatura do contrato",
  "dd11":"Formalização da contratação  --  pode ser contrato ou nota de empenho conforme o valor",
  // Inexigibilidade
  "di1":"Identificação do processo  --  sempre verificar se os incisos estão corretos na capa",
  "di2":"Pedido formal do órgão demandante  --  o solicitante geralmente é quem assinou o DFD",
  "di3":"Autorização do Ordenador para abertura  --  assinada pelo Prefeito",
  "di4":"Confirmação da Contabilidade com a rubrica orçamentária  --  copie o texto exato",
  "di5":"Demonstração de que a competição é inviável  --  cite o inciso do art. 74 da Lei 14.133",
  "di6":"Dossiê comprovando notória especialização: currículo, obras, prêmios, certificados",
  "di7":"Certidões de regularidade da empresa: Municipal, Estadual, Federal, FGTS e CNDT",
  "di8":"Análise da Procuradoria  --  atentar para quem é o Procurador que assinou",
  "di9":"Termo de Ratificação assinado pelo Prefeito  --  enviado por e-mail após assinatura",
  "di10":"Publicação obrigatória no PNCP antes da assinatura do contrato",
  "di11":"Formalização da contratação  --  contrato ou empenho conforme o valor",
};

// Função que combina dicas do código com dicas do banco (banco tem prioridade)
function getDicaFinal(chave, dicasDB){
  const dicaDB = dicasDB?.find(d=>d.chave===chave);
  if(dicaDB) return {texto:dicaDB.texto, isCustom:true, id:dicaDB.id};
  const texto = DICAS_PADRAO[chave]||DICAS_ETAPAS[chave];
  if(texto) return {texto, isCustom:false, id:null};
  return null;
}

const DICAS_PADRAO={
  "d1":"O órgão solicitante é quem assina o DFD. Identifique a secretaria que demanda a obra ou serviço  --  use o nome completo da secretaria e o nome do responsável que vai assinar. Ex: 'Secretaria Municipal de Infraestrutura  --  Fulano de Tal'.",
  "d2":"Inclua TODOS os projetos exigidos para o tipo de obra: arquitetônico, estrutural, elétrico, hidrossanitário, de fundações, etc. Verifique as resoluções do CONFEA/CAU para a lista completa. Todos devem estar assinados pelo responsável técnico com ART/RRT recolhida.",
  "d3":"Use o SINAPI (Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil) como referência principal. A planilha deve ter: código do item, descrição, unidade, quantidade, preço unitário e total. Inclua a data de referência da tabela utilizada.",
  "d8":"O ETP (Estudo Técnico Preliminar) é obrigatório pelo art. 18 da Lei 14.133/2021. Deve conter: descrição da necessidade, estimativa da quantidade, levantamento de mercado, descrição da solução escolhida e justificativa. Elaborado pela Engenharia com apoio do Planejamento.",
  "d9":"O Termo de Referência substitui o Projeto Básico em contratações de serviços. Deve conter: objeto detalhado, prazo de execução, local de entrega/execução, obrigações do contratado e do contratante, critérios de medição, forma e prazo de pagamento, e critérios de qualificação técnica exigidos.",
  "d10":"A autuação formaliza a abertura do processo. O número do processo é obtido na pasta de Administração Interna, na tabela de Controle de Processos. Como ler o número (ex: 2208001/2025/SEPLAGE): '22' = dia 22 (dia de início), '08' = agosto (mês), '001' = primeiro processo da fila, '2025' = ano, 'SEPLAGE' = origem. A DATA do Termo de Autuação é a data que consta nessa tabela  --  não a data de hoje.",
  "d12":"A Resposta da Dotação é emitida pela Contabilidade confirmando: (1) que há saldo disponível, (2) qual é a rubrica orçamentária (o 'endereço' do recurso no orçamento  --  ex: Função/Subfunção/Programa/Ação/Elemento de Despesa) e (3) o valor disponível. Guarde este documento  --  o número da dotação será usado em todos os documentos financeiros do processo.",
  "d11":"O despacho para dotação solicita à Contabilidade que informe de onde vai sair o dinheiro  --  qual rubrica orçamentária tem saldo disponível. Quando receber a resposta, copie o texto exato da dotação informada  --  esse texto será usado em vários documentos ao longo do processo, como o edital e o contrato.",
  "d15":"A Minuta é o rascunho do edital  --  é aqui que começa a construção do documento mais importante do processo. Antes de começar, consulte três fontes essenciais: (1) a tabela QCI  --  veja se os valores batem com o ETP; (2) o ETP  --  especialmente o item 5, para verificar preferência de produto nacional; (3) o item 8 do TR  --  costuma ter informações cruciais sobre obrigações e critérios. Na minuta, os pontos mais comuns de ajuste são: dotação orçamentária, vigência do contrato e as 3 primeiras páginas. Após pronta, a minuta segue para o Jurídico.",
  "d14":"A autorização do Ordenador de Despesas é obrigatória antes de qualquer ato do processo. O Ordenador é geralmente o Prefeito ou o Secretário competente. Sem essa assinatura, nenhuma publicação ou contratação tem validade jurídica.",
  "d17":"O Parecer Jurídico da Procuradoria analisa a legalidade do processo. Atenção: note sempre quem é o Procurador que assinou  --  essa informação pode ser relevante para recursos e questionamentos futuros. Se houver ressalvas, o processo deve ser corrigido antes de prosseguir. Guardar o parecer original no processo.",
  "d22":"A Portaria de designação do Agente de Contratação deve ser publicada no Diário Oficial ANTES da abertura da sessão. Junto à portaria, anexar o certificado de conclusão do curso de Agente de Contratação (exigido pelo art. 7º da Lei 14.133/2021).",
  "d23":"O edital final deve ser assinado por três partes: (1) Agente de Contratação, (2) Responsável pelo Planejamento e (3) Ordenador de Despesas. Todas as páginas devem ser rubricadas. Este é o documento que será publicado e vincula juridicamente o processo.",
  "d25":"FLUXO DE PUBLICAÇÃO: após o edital assinado, ele segue para a pasta de Publicação junto com os Avisos de Licitação. Publicações obrigatórias: (1) PNCP  --  Portal Nacional de Contratações Públicas; (2) DOE  --  Diário Oficial do Estado; (3) Jornal de grande circulação se o valor exigir. Depois de publicado no DOE: imprimir o Despacho das Publicações em DUAS VIAS  --  uma fica no processo e a outra fica com o Setor de Publicação. O despacho é assinado pela secretária da SUPRI. Lembre: despachos internos = DESPACHO; para outras secretarias ou Prefeito = OFÍCIO. -- Portal Nacional de Contratações Públicas (prazo: mesmo dia da publicação no diário); (2) Diário Oficial do Estado ou Município; (3) Jornal de grande circulação (se o valor superar os limites do § 1º do art. 54 da Lei 14.133); (4) GEO-Obras e portal da prefeitura. Guardar comprovantes de todas as publicações no processo.",
  "d42":"Adjudicação: ato do Agente de Contratação que atribui o objeto ao vencedor após o julgamento definitivo. Homologação: ato posterior do Ordenador de Despesas que confirma a regularidade de todo o processo e autoriza a contratação. Ambos devem ser registrados no sistema e no processo físico.",
  "d43":"A publicação da homologação no PNCP é obrigatória e deve ocorrer em até 3 dias úteis após o ato de homologação. Também publicar no Diário Oficial e no portal da prefeitura.",
  "d50":"A publicação do contrato é obrigatória no PNCP em até 20 dias úteis da assinatura. Além disso: publicar extrato no Diário Oficial, registrar no GEO-Obras (se obra de engenharia) e incluir no ASPEC. Guardar comprovantes de todas as publicações.",
  "dd1":"A capa identifica e organiza o processo. Deve conter: Número do Processo Administrativo (ex: 2208001/2025/SEPLAGE), Objeto resumido, Modalidade (Dispensa de Licitação  --  art. 75, inciso X), Secretaria/Órgão solicitante, Data de abertura e Ordenador de Despesas responsável.",
  "dd5":"CONCEITO: A Dispensa de Licitação (art. 75 da Lei 14.133/2021) é uma contratação direta -- como o nome diz, a licitação é DISPENSADA. Isso pode ocorrer por duas razões principais: (1) VALOR: quando o valor é baixo demais para justificar o processo licitatório (até R$ 50.000 para obras e serviços de engenharia, até R$ 50.000 para outros serviços e compras); (2) EMERGÊNCIA: situações de calamidade, emergência ou urgência que não permitam aguardar o prazo de uma licitação. Cite o inciso específico (ex: inciso II -- valor até R$ 50.000 para outros serviços). Explique a necessidade, quando surgiu, por que é urgente e por que a licitação não é adequada.",
  "dd6":"A Justificativa de Preço comprova que o valor é compatível com o mercado. Formas aceitas: (1) mínimo 3 orçamentos de fornecedores distintos; (2) tabelas de referência oficiais (SINAPI, CMED, SEINFRA); (3) contratações similares recentes de outros órgãos. Documente a metodologia de pesquisa e calcule a média ou mediana dos preços.",
  "di5":"CONCEITO: A Inexigibilidade (art. 74 da Lei 14.133/2021) é usada quando a competição é INVIÁVEL -- não existe outra empresa ou profissional capaz de fazer aquilo, seja por exclusividade de fornecimento ou por notória especialização. Diferente da Dispensa (onde poderia haver competição, mas ela é dispensada por razões práticas), na Inex ela simplesmente não é possível. A Justificativa deve provar essa inviabilidade com fatos concretos. Para exclusividade (art. 74, I): junte declaração do fabricante ou distribuidor exclusivo. Para notória especialização (art. 74, III): demonstre que o profissional/empresa tem reconhecimento excepcional no ramo -- produção intelectual, prêmios, obras de referência e depoimentos do setor.",
  "d29": "O despacho encaminha a proposta do vencedor para a Engenharia analisar. Informe o prazo para resposta e destaque os pontos que precisam de verificação técnica.",
  "d30": "O Parecer Técnico da Proposta é a análise da Engenharia verificando se a proposta está de acordo com o edital  --  especialmente se o valor proposto é compatível com o orçamento estimado. Dica importante: compare o valor proposto com a tabela QCI e veja se ele bate com o valor do ETP. Qualquer inconsistência deve ser apontada.",
  "d33": "Encaminha a documentação de habilitação do vencedor para a Engenharia verificar a qualificação técnica  --  se a empresa tem capacidade técnica e acervo de obras similares conforme exigido no edital.",
  "d34": "Análise da Engenharia sobre os documentos de habilitação técnica do vencedor: verifica se o acervo técnico apresentado é compatível com as exigências do edital.",
  "di1":"DICA PRÁTICA: A capa identifica o processo. Sempre analise os incisos da capa  --  eles indicam o fundamento legal da contratação e precisam estar corretos desde o início. Na Inexigibilidade, o inciso mais comum é o III do art. 74 (notória especialização). O número do processo administrativo é obtido na pasta de Administração Interna, dentro da tabela de Controle de Processos.",
  "dd1_num":"COMO LER O NÚMERO DO PROCESSO: os dois primeiros dígitos = dia do mês em que foi iniciado; terceiro e quarto dígitos = mês; os três últimos antes da / = ordem na fila de processos. Depois vem o ano e depois a origem (SUPRI, SEPLAGE etc.). Ex: 2208001/2025/SEPLAGE = processo iniciado no dia 22, mês 08, primeiro da fila, ano 2025, originado na SEPLAGE.",
  "autuacao_data":"A data do Termo de Autuação é a data que consta na tabela do processo administrativo  --  ou seja, a data em que o processo foi iniciado/registrado no sistema. Não use a data do dia em que você está preenchendo o documento.",
  "orgao_demandante":"DEMANDANTE x SOLICITANTE: o órgão demandante é quem pede a verba (quem tem a necessidade); o solicitante é quem tem a verba disponível (quem vai pagar). Atenção: há órgãos como a SECULT que não têm fundo próprio e precisam solicitar à Prefeitura  --  nesses casos, a Prefeitura aparece como solicitante mesmo que a demanda seja da SECULT.",
  "num_modalidade":"O número da licitação (ex: 001/2026 para Inexigibilidade ou Concorrência) é obtido na tabela de modalidades, na pasta de Administração Interna.",

  "di_fluxo_completo":"FLUXO COMPLETO DA INEXIGIBILIDADE (ordem dos documentos): 1. Capa (com incisos corretos); 2. Termo de Abertura assinado pela administradora; 3. DFD enviado pelo demandante; 4. Termo de Autuação assinado pela administradora (data = data da tabela); 5. Despacho para Dotação (memorando ao setor de Contabilidade da Prefeitura, assinado pela secretaria da SUPRI); 6. Resposta da Dotação (recebida por e-mail  --  atenção ao texto específico de cada dotação); 7. Declaração de Adequação Orçamentária assinada pelo Prefeito (usa o mesmo texto que veio na dotação); 8. Autorização de Autuação de Processo assinada pelo Prefeito; 9. Termo de Referência (assinado pelo Planejamento e analisado pelo setor de Obras); 10. Termo de Autuação do Processo por Agente; 11. Convocação da empresa para apresentar documentação; 12. Documentação da empresa; 13. Minuta do Contrato (não precisa de assinatura nesta fase); 14. Despacho para o Jurídico (memorando assinado pelo Agente); 15. Parecer Jurídico (atentar para quem é o Procurador que assinou); 16. Despacho ao Controle Interno (memorando assinado pelo Agente); 17. Parecer do Controle Interno.",

  "di2":"DICA PRÁTICA: O solicitante geralmente é quem assinou o DFD. O DFD (Documento de Formalização de Demanda) é enviado pelo órgão demandante  --  guarde-o pois é um dos primeiros documentos da pasta. Lembre: demandante é quem tem a necessidade, solicitante é quem tem a verba.",
  "dotacao_texto":"ATENÇÃO: cada dotação tem um texto específico que vem no documento enviado pela Contabilidade. Copie esse texto exatamente como está  --  ele será reproduzido na Declaração de Adequação Orçamentária (que vai ao Prefeito) e em outros documentos. Qualquer erro nesse texto pode invalidar o processo.",

  "certidoes":"CERTIDÕES FISCAIS  --  o que a empresa precisa apresentar para habilitação fiscal: (1) Certidão Negativa Municipal (ou positiva com efeito de negativa); (2) Certidão Negativa Estadual; (3) Certidão Negativa Federal (Receita Federal + Dívida Ativa da União  --  hoje são emitidas juntas); (4) Certidão de Regularidade do FGTS (emitida pela Caixa Econômica); (5) Certidão Negativa de Débitos Trabalhistas  --  CNDT (emitida pelo TST). Todas devem estar dentro do prazo de validade na data da sessão.",

  "publicacao_edital":"FLUXO DE PUBLICAÇÃO EM CONCORRÊNCIAS: após o despacho ao jurídico e o parecer favorável, a minuta do edital se torna o edital definitivo. Sempre colocar o horário da sessão às 9h. Para calcular a data da sessão: conte 10 dias úteis a partir do dia SEGUINTE à publicação (não conta o dia da publicação). O edital segue para a pasta de Publicação junto com os avisos de licitação.",

  "publicacao_doe":"Após a publicação no DOE (Diário Oficial do Estado), imprime o despacho das publicações em DUAS VIAS  --  uma fica no processo e a outra fica com o Setor de Publicação. O despacho é assinado pela secretária da SUPRI.",

  "oficio_x_despacho":"DESPACHO x OFÍCIO: quando o documento é interno (de um setor para outro dentro da mesma secretaria), usa-se DESPACHO. Quando é direcionado a outra secretaria, ao Prefeito ou a qualquer entidade externa à SUPRI, o documento é nomeado como OFÍCIO. Fique atento a isso  --  usar o termo errado é uma falha formal que pode ser apontada pelo Jurídico ou Controle Interno.",

  "di_fluxo_parte2":"CONTINUAÇÃO DO FLUXO DA INEXIGIBILIDADE (após Controle Interno): 18. Declaração de Dispensa  --  documento que será publicado; 19. Despacho para publicação no Diário Oficial (assinado conforme padrão); 20. Termo de Ratificação  --  assinado pelo Prefeito (enviado por e-mail após assinatura); 21. Pedido de Fiscal de Contrato  --  ofício ao órgão responsável solicitando a indicação de um fiscal. Use como modelo o da Concorrência 001/2026. Este ofício também deve ser salvo na pasta de Ofícios dentro da pasta de Administração Interna; 22. Acesso ao site do TCM  --  verificar quais documentos são necessários para o inciso específico do processo, montar a pasta completa; 23. Validação pelo Prefeito  --  docs que precisam ser validados são enviados ao Prefeito com despacho; 24. Despacho para o TCM  --  encaminhamento formal da documentação ao Tribunal de Contas.",

  "pedido_fiscal":"O Pedido de Fiscal é um ofício enviado ao órgão responsável pela execução do contrato solicitando a indicação de um servidor para ser o Fiscal de Contrato. Use como base o modelo que está na pasta da Concorrência 001/2026. Após assinar, salve uma cópia também na pasta de Ofícios dentro da pasta de Administração Interna.",

  "tcm":"Para saber quais documentos enviar ao TCM (Tribunal de Contas dos Municípios), acesse o site do TCM e consulte a lista específica para o inciso do seu processo  --  cada inciso pode ter exigências diferentes. Monte a pasta completa, faça validar pelo Prefeito e depois encaminhe com despacho formal ao TCM.",

  "ratificacao":"O Termo de Ratificação é assinado pelo Prefeito e formaliza a autorização da contratação direta. Após assinado, é enviado por e-mail. A Ratificação também precisa ser publicada no Diário Oficial  --  verifique o prazo de publicação exigido para o inciso específico.",

  "di6":"Para comprovar Notória Especialização, o dossiê deve ser robusto: currículo completo, lista de obras/serviços similares realizados com comprovantes, publicações técnicas ou acadêmicas, prêmios e reconhecimentos, certificados de especialização, e preferencialmente declarações de outros órgãos públicos que já contrataram o profissional/empresa.",
};

const STYLES = `
  @import url('${FONT_URL}');
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{height:100%;}
  body{font-family:'Lora',Georgia,serif;background:${C.paper};color:${C.ink};}
  body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0.05;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size:256px;}
  .mono{font-family:'Space Mono',monospace;}
  .serif{font-family:'Playfair Display',serif;}
  .shell{display:flex;flex-direction:column;min-height:100vh;position:relative;z-index:1;}
  .topbar{position:sticky;top:0;z-index:100;background:${C.inkLight};border-bottom:4px solid ${C.terra};display:flex;align-items:stretch;padding:0;}
  .brand{padding:10px 16px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid rgba(255,255,255,.1);}
  .brand-name{font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:${C.paper};letter-spacing:.15em;text-transform:uppercase;}
  .brand-sub{font-family:'Space Mono',monospace;font-size:8px;color:${C.ghost};letter-spacing:.1em;margin-top:1px;}
  .topbar-nav{display:flex;flex:1;overflow-x:auto;}
  .nav-btn{padding:0 14px;border:none;background:transparent;color:rgba(240,232,213,.5);font-family:'Space Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;border-bottom:3px solid transparent;margin-bottom:-4px;transition:all .15s;letter-spacing:.1em;text-transform:uppercase;}
  .nav-btn:hover{color:${C.paper};background:rgba(255,255,255,.05);}
  .nav-btn.active{color:${C.ochreLight};border-bottom-color:${C.terra};}
  .topbar-actions{display:flex;align-items:center;gap:3px;padding:0 10px;border-left:1px solid rgba(255,255,255,.1);}
  .topbar-mobile-right{display:none;}
  .bottom-nav{display:none;}
  .btn-primary{background:${C.terra};color:${C.paper};border:none;border-radius:3px;padding:8px 16px;font-family:'Space Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;letter-spacing:.08em;text-transform:uppercase;transition:all .15s;}
  .btn-primary:hover{background:${C.terraLight};}
  .btn-ghost{background:transparent;color:${C.faded};border:1px solid ${C.tape};border-radius:3px;padding:7px 14px;font-family:'Space Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;letter-spacing:.08em;text-transform:uppercase;transition:all .15s;}
  .btn-ghost:hover{background:${C.paperDark};color:${C.ink};}
  .btn-sm{padding:3px 9px!important;font-size:9px!important;}
  .btn-icon{background:none;border:none;cursor:pointer;color:rgba(240,232,213,.4);font-size:12px;padding:8px;transition:color .15s;}
  .btn-icon:hover{color:${C.paper};}
  .del-btn{background:none;border:none;cursor:pointer;color:${C.ghost};font-size:12px;padding:2px 5px;transition:color .15s;}
  .del-btn:hover{color:${C.rust};}
  .status-pill{display:inline-flex;align-items:center;gap:4px;border-radius:2px;padding:2px 7px;font-size:9px;font-family:'Space Mono',monospace;font-weight:700;cursor:pointer;transition:all .15s;letter-spacing:.08em;white-space:nowrap;}
  .status-pill:hover{filter:brightness(.92);}
  .tab-row{display:flex;border-bottom:2px solid ${C.tape};overflow-x:auto;background:${C.paper};}
  .tab-item{padding:9px 14px;border:none;background:transparent;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;color:${C.ghost};border-bottom:2px solid transparent;margin-bottom:-2px;white-space:nowrap;transition:all .15s;}
  .tab-item.active{color:${C.terra};border-bottom-color:${C.terra};}
  .tab-item:hover:not(.active){color:${C.ink};}
  input,select,textarea{font-family:'Lora',serif;color:${C.ink};}
  input::placeholder,textarea::placeholder{color:${C.ghost};}
  .field{width:100%;border:1px solid ${C.tape};border-radius:2px;padding:7px 10px;font-size:12px;background:${C.paper};outline:none;transition:border-color .15s;}
  .field:focus{border-color:${C.terra};}
  label.lbl{display:block;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.faded};margin-bottom:4px;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-track{background:${C.paperDark};}
  ::-webkit-scrollbar-thumb{background:${C.tape};border-radius:2px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
  .fade-up{animation:fadeUp .25s ease both;}
  .doc-row{transition:background .12s;}
  .doc-row:hover{background:${C.paper}!important;}
  .folder{background:${C.paperDark};border:1px solid ${C.tape};border-radius:2px;overflow:visible;position:relative;transition:transform .2s,box-shadow .2s;}
  .folder:hover{transform:translateY(-2px);box-shadow:4px 4px 0 ${C.tape};}
  .folder-tab{position:absolute;top:-22px;left:16px;height:22px;padding:0 14px;display:flex;align-items:center;gap:8px;border-radius:3px 3px 0 0;border:1px solid ${C.tape};border-bottom:none;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.1em;background:${C.paperDark};}
  .stamp{display:inline-block;border:2px solid currentColor;border-radius:3px;padding:2px 8px;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.85;}
  .toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:${C.ink};color:${C.paper};padding:8px 18px;border-radius:2px;font-size:11px;font-family:'Space Mono',monospace;z-index:9999;white-space:nowrap;animation:fadeUp .2s ease both;border-left:3px solid ${C.terra};}
  .modal-overlay{position:fixed;inset:0;background:rgba(10,8,2,.7);display:flex;align-items:center;justify-content:center;z-index:300;padding:16px;backdrop-filter:blur(2px);}
  .modal-box{background:${C.paper};border:1px solid ${C.tape};border-radius:2px;width:100%;max-width:480px;box-shadow:6px 6px 0 ${C.tape};max-height:90vh;overflow-y:auto;}
  .modal-header{padding:14px 18px;border-bottom:2px solid ${C.tape};display:flex;justify-content:space-between;align-items:center;background:${C.paperDark};}
  .drag-handle{color:${C.ghost};font-size:14px;cursor:grab;padding:2px 4px;}
  .search-overlay{position:fixed;inset:0;background:rgba(10,8,2,.7);z-index:200;display:flex;align-items:flex-start;justify-content:center;padding-top:60px;backdrop-filter:blur(2px);}
  .search-box{background:${C.paper};border:1px solid ${C.tape};border-radius:2px;width:100%;max-width:540px;box-shadow:6px 6px 0 ${C.tape};}
  .search-input{width:100%;border:none;outline:none;padding:14px 18px;font-size:14px;font-family:'Space Mono',monospace;background:transparent;color:${C.ink};}
  .search-result{padding:10px 18px;cursor:pointer;border-bottom:1px solid ${C.paperDark};transition:background .1s;}
  .search-result:hover{background:${C.paperDark};}
  /* Login */
  .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:${C.inkLight};}
  .login-box{background:${C.paper};border:1px solid ${C.tape};border-radius:2px;width:100%;max-width:400px;box-shadow:8px 8px 0 ${C.tape};overflow:hidden;}
  /* Usuários */
  .user-badge{display:inline-flex;align-items:center;gap:5px;border-radius:2px;padding:2px 8px;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.08em;}
  /* Sidebar  --  escondida por padrão */
  .side-panel{display:none;}
  .side-nav-btn{display:flex;align-items:center;gap:10px;width:100%;padding:10px 20px;border:none;border-left:3px solid transparent;background:transparent;color:${C.faded};font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .15s;text-align:left;}
  .side-nav-btn:hover{background:${C.paperDeep};color:${C.ink};}
  .side-nav-btn.active{color:${C.terra};background:${C.paper};border-left-color:${C.terra};}
  .side-nav-icon{font-size:14px;width:18px;text-align:center;flex-shrink:0;}

  /* Desktop  --  sidebar visível */
  @media(min-width:1024px){
    .main-content{display:grid!important;grid-template-columns:220px 1fr;min-height:calc(100vh - 52px);}
    .side-panel{display:flex!important;flex-direction:column;background:${C.paperDark};border-right:1px solid ${C.tape};}
  }

  /* Mobile */
  @media(max-width:640px){
    .topbar-nav{display:none!important;}
    .topbar-actions{display:none!important;}
    .brand{flex:1;border-right:none;}
    .topbar-mobile-right{display:flex!important;align-items:center;gap:6px;padding:6px 10px;}
    .bottom-nav{display:flex!important;position:fixed;bottom:0;left:0;right:0;z-index:100;background:${C.inkLight};border-top:3px solid ${C.terra};padding-bottom:env(safe-area-inset-bottom);}
    .bnav-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:7px 2px 5px;border:none;background:transparent;cursor:pointer;color:rgba(240,232,213,.4);font-family:'Space Mono',monospace;font-size:7px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;gap:2px;transition:color .15s;}
    .bnav-btn .bi{font-size:16px;line-height:1;}
    .bnav-btn.active{color:${C.ochreLight};}
    .main-content{padding-bottom:64px!important;}
    .toast{bottom:72px!important;}
    .search-overlay{padding-top:8px;align-items:flex-end;}
    .search-box{border-radius:2px 2px 0 0;max-width:100%!important;}
    .actions-sheet{display:block!important;position:fixed;bottom:64px;left:0;right:0;z-index:200;background:${C.inkLight};border-top:1px solid rgba(255,255,255,.1);padding:14px 16px;}
  }
  @media(min-width:641px){
    .topbar-mobile-right{display:none!important;}
    .actions-sheet{display:none!important;}
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mkId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function mkEtapas(mod){ return (ETAPAS_MOD[mod]||[]).map(n=>({id:mkId(),nome:n,status:"pendente",prazo:"",dataEntrega:"",nota:""})); }
function mkDocs(mod){ return getFases(mod).flatMap(f=>f.docs.map(d=>({...d,uid:mkId(),faseId:f.id,status:"pendente",dataEmissao:"",dataPrazo:"",nota:"",marcacoes:[],referencias:[],dicaCustom:""}))); }
function mkProcesso(nome,mod,num,userId){ return {id:mkId(),nome,modalidade:mod,numero:num,data_inicio:"",data_prazo:"",etapas:mkEtapas(mod),docs:mkDocs(mod),secretarias_ids:[],pessoas_ids:[],node_positions:{},criado_em:new Date().toISOString(),criado_por:userId}; }
function pct(items,key){ if(!items?.length) return 0; return Math.round(items.filter(i=>i[key]==="concluída"||i[key]==="concluído"||i[key]==="dispensado").length/items.length*100); }
function fmtDate(s){ if(!s) return ""; try{ return new Date(s+"T12:00:00").toLocaleDateString("pt-BR"); }catch{ return s; } }
function isConcluido(p){ return pct(p.etapas,"status")===100; }
function isEmAndamento(p){ return !isConcluido(p)&&p.etapas.some(e=>e.status==="em andamento"); }
function padCode(id){ return id?.toString().slice(-4).toUpperCase()||"0000"; }

const ORDENACOES=[{key:"lancamento",label:"Lançamento ↓"},{key:"lancamento_asc",label:"Lançamento ↑"},{key:"inicio",label:"Data início"},{key:"prazo",label:"Prazo urgente"},{key:"nome",label:"Nome A→Z"},{key:"nome_desc",label:"Nome Z→A"},{key:"status",label:"Status"},{key:"modalidade",label:"Modalidade"},{key:"progresso",label:"Progresso"}];
function ordenar(list,key){
  const c=[...list];
  switch(key){
    case "lancamento_asc": return c.reverse();
    case "inicio": return c.sort((a,b)=>(a.data_inicio||"9")<(b.data_inicio||"9")?-1:1);
    case "prazo": return c.sort((a,b)=>{ if(!a.data_prazo&&!b.data_prazo) return 0; if(!a.data_prazo) return 1; if(!b.data_prazo) return -1; return a.data_prazo<b.data_prazo?-1:1; });
    case "nome": return c.sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
    case "nome_desc": return c.sort((a,b)=>b.nome.localeCompare(a.nome,"pt-BR"));
    case "status": return c.sort((a,b)=>{ const sa=isConcluido(a)?2:isEmAndamento(a)?0:1; const sb=isConcluido(b)?2:isEmAndamento(b)?0:1; return sa-sb; });
    case "modalidade": return c.sort((a,b)=>a.modalidade.localeCompare(b.modalidade,"pt-BR"));
    case "progresso": return c.sort((a,b)=>pct(b.etapas,"status")-pct(a.etapas,"status"));
    default: return c;
  }
}

// ─── Atoms ────────────────────────────────────────────────────────────────────
function Toast({msg}){ return <div className="toast">{msg}</div>; }
function Dot({color,size=6}){ return <span style={{width:size,height:size,borderRadius:"50%",background:color,display:"inline-block",flexShrink:0}}/>; }
function StatusPill({status,config,onChange,readonly}){
  const cfg=config[status]||Object.values(config)[0];
  const keys=Object.keys(config);
  return <button className="status-pill" onClick={readonly?undefined:()=>onChange(keys[(keys.indexOf(status)+1)%keys.length])} style={{background:cfg.bg,color:C.ink,border:`1px solid ${cfg.border}`,cursor:readonly?"default":"pointer"}}><Dot color={cfg.dot} size={5}/>{cfg.label}</button>;
}
function ProgressBar({p,color=C.terra,height=3}){
  return <div style={{height,background:C.paperDeep,borderRadius:0,overflow:"hidden"}}><div style={{width:`${p}%`,height:"100%",background:color,transition:"width .4s"}}/></div>;
}
function DateField({label,value,onChange,readonly}){
  return(
    <div style={{display:"flex",gap:4,alignItems:"center"}}>
      {label&&<span style={{fontSize:9,color:C.ghost,fontFamily:"'Space Mono',monospace",textTransform:"uppercase",letterSpacing:".06em",whiteSpace:"nowrap"}}>{label}:</span>}
      <input type="date" value={value||""} onChange={e=>!readonly&&onChange(e.target.value)} readOnly={readonly}
        style={{fontSize:10,border:`1px dashed ${C.tape}`,borderRadius:2,padding:"1px 5px",background:"transparent",color:value?C.ink:C.ghost,cursor:readonly?"default":"pointer",fontFamily:"'Space Mono',monospace"}}/>
    </div>
  );
}

// ─── Tela de Login ────────────────────────────────────────────────────────────
function TelaLogin({onLogin}){
  const [modo,setModo]=useState("login");
  const [email,setEmail]=useState(""); const [senha,setSenha]=useState(""); const [nome,setNome]=useState("");
  const [loading,setLoading]=useState(false); const [erro,setErro]=useState("");
  const [showSenha,setShowSenha]=useState(false);

  async function handleSubmit(){
    if(modo==="recuperar"){
      if(!email){setErro("Informe seu e-mail");return;}
      setLoading(true); setErro("");
      try{ await supa.resetPassword(email); setModo("recuperar_ok"); }
      catch(e){ setErro(e.message); }
      setLoading(false); return;
    }
    if(!email||!senha){setErro("Preencha todos os campos");return;}
    setLoading(true); setErro("");
    try{
      if(modo==="login"){
        const data=await supa.signIn(email,senha);
        onLogin(data.user);
      } else {
        await supa.signUp(email,senha,nome);
        setErro(""); setModo("confirmar");
      }
    }catch(e){ setErro(e.message); }
    setLoading(false);
  }

  const msgTelas={
    confirmar:{icon:"✉",titulo:"Verifique seu e-mail",msg:`Enviamos um link de confirmação para ${email}. Confirme e volte para fazer login.`},
    recuperar_ok:{icon:"🔑",titulo:"E-mail enviado!",msg:`Enviamos um link para redefinir sua senha para ${email}. Verifique sua caixa de entrada.`},
  };

  if(msgTelas[modo]) return(
    <div className="login-wrap">
      <div className="login-box">
        <div style={{height:4,background:`linear-gradient(90deg,${C.terra},${C.ochre})`}}/>
        <div style={{padding:"28px 24px",textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:12}}>{msgTelas[modo].icon}</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:C.ink,marginBottom:8}}>{msgTelas[modo].titulo}</div>
          <div className="mono" style={{fontSize:10,color:C.ghost,lineHeight:1.7}}>{msgTelas[modo].msg}</div>
          <button className="btn-ghost" onClick={()=>setModo("login")} style={{marginTop:20}}>← VOLTAR AO LOGIN</button>
        </div>
      </div>
    </div>
  );

  return(
    <div className="login-wrap">
      <div className="login-box">
        <div style={{height:4,background:`linear-gradient(90deg,${C.terra},${C.ochre})`}}/>
        <div style={{padding:"10px 20px 6px",background:C.inkLight}}>
          <div className="mono" style={{fontSize:9,color:C.ghost,letterSpacing:".12em"}}>LEI 14.133 // 2021</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:C.paper}}>
            LICIT<span style={{color:C.ochreLight,fontStyle:"italic"}}>ações</span>
          </div>
        </div>
        <div style={{padding:"20px 22px"}}>
          <div className="mono" style={{fontSize:10,fontWeight:700,color:C.faded,letterSpacing:".1em",marginBottom:16}}>
            {modo==="login"?"// ACESSO":"// NOVO USUÁRIO"}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {modo==="cadastro"&&(
              <div><label className="lbl">Nome</label><input value={nome} onChange={e=>setNome(e.target.value)} className="field" placeholder="Seu nome"/></div>
            )}
            <div><label className="lbl">E-mail</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="field" placeholder="seu@email.com" autoFocus/></div>
            {modo!=="recuperar"&&(
              <div>
                <label className="lbl">Senha</label>
                <div style={{position:"relative"}}>
                  <input type={showSenha?"text":"password"} value={senha} onChange={e=>setSenha(e.target.value)} className="field" placeholder="••••••••"
                    onKeyDown={e=>e.key==="Enter"&&handleSubmit()} style={{paddingRight:36}}/>
                  <button onClick={()=>setShowSenha(v=>!v)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.ghost,fontSize:12}}>
                    {showSenha?"🙈":"👁"}
                  </button>
                </div>
              </div>
            )}
            {erro&&<div className="mono" style={{fontSize:9,color:C.rust,padding:"6px 8px",background:"#fdf0ec",border:`1px solid ${C.rust}44`,borderRadius:2}}>{erro}</div>}
          </div>
          <button className="btn-primary" onClick={handleSubmit} disabled={loading}
            style={{width:"100%",marginTop:16,padding:"10px",fontSize:11}}>
            {loading?"AGUARDE…":modo==="login"?"ENTRAR":modo==="recuperar"?"ENVIAR LINK":"CRIAR CONTA"}
          </button>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,marginTop:14}}>
            {modo==="login"&&(
              <button onClick={()=>{setModo("recuperar");setErro("");}}
                className="mono" style={{background:"none",border:"none",cursor:"pointer",color:C.ghost,fontSize:9,letterSpacing:".08em"}}>
                Esqueci minha senha
              </button>
            )}
            <button onClick={()=>{setModo(modo==="login"||modo==="recuperar"?"cadastro":"login");setErro("");}}
              className="mono" style={{background:"none",border:"none",cursor:"pointer",color:C.faded,fontSize:9,letterSpacing:".08em"}}>
              {modo==="login"||modo==="recuperar"?"Criar nova conta →":"← Já tenho conta"}
            </button>
            {modo==="recuperar"&&(
              <button onClick={()=>{setModo("login");setErro("");}}
                className="mono" style={{background:"none",border:"none",cursor:"pointer",color:C.ghost,fontSize:9,letterSpacing:".08em"}}>
                ← Voltar ao login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Gestão de Dicas ──────────────────────────────────────────────────────────
function GestaoDicas({dicasDB,onUpdate,perfil,processos}){
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState(null);
  const [filtroTipo,setFiltroTipo]=useState("todas");
  const [busca,setBusca]=useState("");
  const blank={tipo:"documento",chave:"",texto:""};
  const [form,setForm]=useState(blank);
  const podeEditar=perfil==="admin"||perfil==="editor";

  // Lista de chaves disponíveis para associar dicas
  const chavesDoc=Object.entries(DICAS_PADRAO).map(([k,v])=>({k,preview:v.slice(0,40)+"..."}));
  const chavesEtapa=Object.entries(DICAS_ETAPAS).map(([k,v])=>({k,preview:v.slice(0,40)+"..."}));

  async function salvar(){
    if(!form.chave.trim()||!form.texto.trim()) return;
    const payload={tipo:form.tipo,chave:form.chave.trim(),texto:form.texto.trim()};
    if(editId){
      await supa.updateDica(editId,{texto:form.texto.trim(),atualizado_em:new Date().toISOString()});
    } else {
      await supa.upsertDica({...payload,id:undefined});
    }
    await onUpdate();
    setForm(blank); setShowForm(false); setEditId(null);
  }

  async function excluir(id){
    if(!confirm("Excluir esta dica?")) return;
    await supa.deleteDica(id);
    await onUpdate();
  }

  function editar(d){
    setForm({tipo:d.tipo,chave:d.chave,texto:d.texto});
    setEditId(d.id); setShowForm(true);
  }

  const dicasFiltradas=dicasDB
    .filter(d=>filtroTipo==="todas"||d.tipo===filtroTipo)
    .filter(d=>!busca||d.chave.toLowerCase().includes(busca.toLowerCase())||d.texto.toLowerCase().includes(busca.toLowerCase()));

  // Dicas padrão para exibição
  const dicasPadrao=[
    ...Object.entries(DICAS_PADRAO).map(([k,v])=>({chave:k,texto:v,tipo:"documento",isPadrao:true})),
    ...Object.entries(DICAS_ETAPAS).map(([k,v])=>({chave:k,texto:v,tipo:"etapa",isPadrao:true})),
  ].filter(d=>!busca||d.chave.toLowerCase().includes(busca.toLowerCase())||d.texto.toLowerCase().includes(busca.toLowerCase()))
   .filter(d=>filtroTipo==="todas"||d.tipo===filtroTipo)
   .filter(d=>!dicasDB.find(db=>db.chave===d.chave));

  return(
    <div style={{maxWidth:920,margin:"0 auto",padding:"20px 16px 56px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <div className="mono" style={{fontSize:9,color:C.ghost,letterSpacing:".12em",marginBottom:2}}>BANCO DE DICAS</div>
          <div style={{fontSize:11,color:C.faded,fontFamily:"'Lora',serif"}}>
            {dicasDB.length} dica{dicasDB.length!==1?"s":""} personalizadas · {Object.keys(DICAS_PADRAO).length+Object.keys(DICAS_ETAPAS).length} dicas padrão
          </div>
        </div>
        {podeEditar&&<button className="btn-primary" onClick={()=>{setForm(blank);setEditId(null);setShowForm(true);}}>+ NOVA DICA</button>}
      </div>

      {/* Filtros */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="buscar dicas..."
          style={{flex:1,minWidth:160,border:`1px solid ${C.tape}`,borderRadius:2,padding:"6px 10px",fontSize:11,background:C.paper,outline:"none",fontFamily:"'Space Mono',monospace"}}/>
        {["todas","documento","etapa"].map(t=>(
          <button key={t} onClick={()=>setFiltroTipo(t)} className="mono"
            style={{background:filtroTipo===t?C.terra:C.paperDark,color:filtroTipo===t?"white":C.faded,
              border:`1px solid ${filtroTipo===t?C.terra:C.tape}`,borderRadius:2,padding:"6px 12px",fontSize:9,cursor:"pointer",letterSpacing:".08em"}}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Formulário */}
      {showForm&&podeEditar&&(
        <div className="fade-up" style={{background:C.paperDark,border:`1px solid ${C.tape}`,borderTop:`3px solid ${C.terra}`,borderRadius:2,padding:18,marginBottom:18,boxShadow:`3px 3px 0 ${C.tape}`}}>
          <div className="mono" style={{fontSize:9,fontWeight:700,color:C.faded,letterSpacing:".1em",marginBottom:14}}>{editId?"EDITAR DICA":"NOVA DICA"}</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {!editId&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="lbl">TIPO</label>
                  <select value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value,chave:""}))} className="field">
                    <option value="documento">Documento</option>
                    <option value="etapa">Etapa</option>
                  </select>
                </div>
                <div>
                  <label className="lbl">ASSOCIAR A</label>
                  <select value={form.chave} onChange={e=>setForm(p=>({...p,chave:e.target.value}))} className="field">
                    <option value="">Selecionar ou digitar abaixo...</option>
                    {(form.tipo==="documento"?chavesDoc:chavesEtapa).map(({k,preview})=>(
                      <option key={k} value={k}>{k} -- {preview}</option>
                    ))}
                  </select>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <label className="lbl">OU DIGITAR A CHAVE MANUALMENTE</label>
                  <input value={form.chave} onChange={e=>setForm(p=>({...p,chave:e.target.value}))} className="field"
                    placeholder="Ex: d15 (para doc) ou nome da etapa"/>
                </div>
              </div>
            )}
            <div>
              <label className="lbl">TEXTO DA DICA</label>
              <textarea value={form.texto} onChange={e=>setForm(p=>({...p,texto:e.target.value}))} className="field"
                rows={4} style={{resize:"vertical"}} placeholder="Escreva a dica aqui..."/>
            </div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>
            <button className="btn-ghost" onClick={()=>{setShowForm(false);setEditId(null);}}>CANCELAR</button>
            <button className="btn-primary" onClick={salvar}>{editId?"SALVAR":"CRIAR"}</button>
          </div>
        </div>
      )}

      {/* Dicas personalizadas */}
      {dicasFiltradas.length>0&&(
        <div style={{marginBottom:24}}>
          <div className="mono" style={{fontSize:9,color:C.terra,fontWeight:700,letterSpacing:".1em",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
            DICAS PERSONALIZADAS <span style={{height:1,flex:1,background:`${C.terra}44`,display:"inline-block"}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {dicasFiltradas.map(d=>(
              <div key={d.id} style={{background:C.paper,border:`1px solid ${C.tape}`,borderLeft:`3px solid ${C.terra}`,borderRadius:2,padding:"12px 14px"}}>
                <div style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:6}}>
                  <span className="mono" style={{fontSize:8,background:`${C.terra}22`,color:C.terra,padding:"1px 6px",borderRadius:2,flexShrink:0}}>{d.tipo.toUpperCase()}</span>
                  <span className="mono" style={{fontSize:9,fontWeight:700,color:C.ink,flex:1}}>{d.chave}</span>
                  {podeEditar&&<div style={{display:"flex",gap:4}}>
                    <button className="btn-ghost btn-sm" onClick={()=>editar(d)}>✎</button>
                    <button className="del-btn" onClick={()=>excluir(d.id)}>✕</button>
                  </div>}
                </div>
                <div style={{fontSize:11,color:C.faded,fontFamily:"'Lora',serif",lineHeight:1.6}}>{d.texto}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dicas padrão */}
      {dicasPadrao.length>0&&(
        <div>
          <div className="mono" style={{fontSize:9,color:C.ghost,fontWeight:700,letterSpacing:".1em",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
            DICAS PADRÃO DO SISTEMA <span style={{height:1,flex:1,background:C.tape,display:"inline-block"}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {dicasPadrao.slice(0,busca?dicasPadrao.length:5).map((d,i)=>(
              <div key={i} style={{background:C.paperDark,border:`1px solid ${C.tape}`,borderRadius:2,padding:"10px 14px"}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                  <span className="mono" style={{fontSize:8,background:C.paperDeep,color:C.ghost,padding:"1px 6px",borderRadius:2,flexShrink:0}}>{d.tipo.toUpperCase()}</span>
                  <span className="mono" style={{fontSize:9,fontWeight:700,color:C.faded,flex:1}}>{d.chave}</span>
                  {podeEditar&&<button className="btn-ghost btn-sm" onClick={()=>{setForm({tipo:d.tipo,chave:d.chave,texto:d.texto});setEditId(null);setShowForm(true);}}>✎ PERSONALIZAR</button>}
                </div>
                <div style={{fontSize:11,color:C.ghost,fontFamily:"'Lora',serif",lineHeight:1.5}}>{d.texto.slice(0,120)}...</div>
              </div>
            ))}
            {!busca&&dicasPadrao.length>5&&<div className="mono" style={{fontSize:9,color:C.ghost,textAlign:"center",padding:"8px 0"}}>... e mais {dicasPadrao.length-5} dicas padrão. Use a busca para encontrar.</div>}
          </div>
        </div>
      )}

      {dicasFiltradas.length===0&&dicasPadrao.length===0&&busca&&(
        <div className="mono" style={{textAlign:"center",padding:"40px",color:C.ghost,fontSize:10}}>// NENHUMA DICA ENCONTRADA</div>
      )}
    </div>
  );
}

// ─── Gestão de Usuários (admin) ───────────────────────────────────────────────
function GestaoUsuarios({perfis,meuPerfil,onUpdate}){
  const PERFIL_CORES={admin:{bg:"#f0dcd8",color:C.rust,border:"#c07060"},editor:{bg:"#f5ead0",color:C.ochre,border:C.ochreLight},visualizador:{bg:"#ede4d0",color:C.ghost,border:C.tape}};
  async function mudarPerfil(uid,novoPerfil){
    try{ await supa.updatePerfil(uid,{perfil:novoPerfil}); onUpdate(); }catch(e){ alert(e.message); }
  }
  return(
    <div style={{maxWidth:760,margin:"0 auto",padding:"20px 16px 56px"}}>
      <div className="mono" style={{fontSize:9,color:C.ghost,letterSpacing:".12em",marginBottom:16}}>
        USUÁRIOS // {perfis.length} CADASTRADO{perfis.length!==1?"S":""}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {perfis.map(u=>{
          const pc=PERFIL_CORES[u.perfil]||PERFIL_CORES.visualizador;
          const isMe=u.id===meuPerfil.id;
          return(
            <div key={u.id} style={{background:C.paperDark,border:`1px solid ${C.tape}`,borderLeft:`3px solid ${pc.color}`,borderRadius:2,padding:"12px 16px",display:"flex",gap:12,alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:"'Playfair Display',serif"}}>{u.nome||u.email}</div>
                <div className="mono" style={{fontSize:9,color:C.ghost,marginTop:2}}>{u.email}</div>
                <div className="mono" style={{fontSize:8,color:C.ghost,marginTop:2}}>desde {fmtDate(u.criado_em?.slice(0,10))}</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:1,background:pc.bg,color:pc.color,border:`1px solid ${pc.border}`,fontFamily:"'Space Mono',monospace",letterSpacing:".08em"}}>
                  {u.perfil.toUpperCase()}
                </span>
                {!isMe&&meuPerfil.perfil==="admin"&&(
                  <select value={u.perfil} onChange={e=>mudarPerfil(u.id,e.target.value)}
                    style={{border:`1px solid ${C.tape}`,borderRadius:2,padding:"4px 7px",fontSize:10,background:C.paper,fontFamily:"'Space Mono',monospace",color:C.ink}}>
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="visualizador">Visualizador</option>
                  </select>
                )}
                {isMe&&<span className="mono" style={{fontSize:8,color:C.ghost}}>(você)</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{marginTop:20,padding:"12px 16px",background:"#f5ead0",border:`1px solid ${C.ochreLight}`,borderLeft:`3px solid ${C.ochre}`,borderRadius:2}}>
        <div className="mono" style={{fontSize:9,fontWeight:700,color:C.ochre,marginBottom:6,letterSpacing:".08em"}}>// PERFIS DE ACESSO</div>
        <div className="mono" style={{fontSize:9,color:C.faded,lineHeight:1.8}}>
          ADMIN  --  cria, edita e exclui processos; gerencia usuários<br/>
          EDITOR  --  cria e edita processos; não pode excluir<br/>
          VISUALIZADOR  --  somente leitura
        </div>
      </div>
    </div>
  );
}

// ─── Folder Card ──────────────────────────────────────────────────────────────
function FolderCard({processo,onAbrir,onDelete,idx,perfil}){
  const pE=pct(processo.etapas,"status");
  const mc=MODAL_CODES[processo.modalidade]||{code:"???",color:C.faded};
  const atual=processo.etapas.find(e=>e.status==="em andamento")||processo.etapas.find(e=>e.status==="pendente");
  const concluido=isConcluido(processo); const emAnd=isEmAndamento(processo);
  const podeExcluir=perfil==="admin";
  const diasPrazo=processo.data_prazo&&!isConcluido(processo)?Math.ceil((new Date(processo.data_prazo+"T12:00:00")-new Date())/(1000*60*60*24)):null;
  const corPrazo=diasPrazo!==null?(diasPrazo<0?C.rust:diasPrazo<=7?C.ochre:diasPrazo<=15?'#c8a030':null):null;
  return(
    <div className="folder fade-up" style={{marginTop:24,animationDelay:`${idx*.05}s`,...(corPrazo?{borderColor:corPrazo,borderWidth:2}:{})}}>
      <div className="folder-tab" style={{background:mc.color,borderColor:mc.color,color:C.paper}}>
        <span className="mono" style={{fontSize:9,letterSpacing:".12em"}}>CODE_{mc.code}</span>
        <span style={{opacity:.7,fontSize:9}}>//</span>
        <span className="mono" style={{fontSize:9,letterSpacing:".06em",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {processo.numero_licitacao||processo.numero||(processo.objeto||processo.nome).toUpperCase().slice(0,20)}
        </span>
      </div>
      <div style={{padding:"14px 16px"}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
          <div style={{minWidth:72,flexShrink:0}}>
            <div className="mono" style={{fontSize:8,color:C.ghost,marginBottom:4}}>FILE_{padCode(processo.id)}</div>
            <div style={{marginBottom:6}}>
              <div style={{fontSize:20,fontWeight:700,color:mc.color,fontFamily:"'Space Mono',monospace",lineHeight:1}}>{pE}<span style={{fontSize:9}}>%</span></div>
              <div className="mono" style={{fontSize:8,color:C.ghost}}>PROGRESSO</div>
            </div>
            <ProgressBar p={pE} color={mc.color} height={3}/>
            <div style={{marginTop:5}}>
              {concluido&&<span className="stamp" style={{color:C.sage,fontSize:8}}>CONCLUÍDO</span>}
              {emAnd&&<span className="stamp" style={{color:C.ochre,fontSize:8}}>EM CURSO</span>}
              {!concluido&&!emAnd&&<span className="stamp" style={{color:C.ghost,fontSize:8}}>PENDENTE</span>}
            </div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:C.ink,lineHeight:1.3,marginBottom:5}}>{processo.objeto||processo.nome}</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center",marginBottom:4}}>
              <span className="mono" style={{fontSize:9,color:mc.color}}>{processo.modalidade.toUpperCase()}</span>
              {processo.numero_licitacao&&<span className="mono" style={{fontSize:9,color:C.ink,fontWeight:700}}>Nº {processo.numero_licitacao}</span>}
              {processo.numero&&<span className="mono" style={{fontSize:9,color:C.ghost}}>PA: {processo.numero}</span>}
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:3}}>
              {processo.data_inicio&&<span className="mono" style={{fontSize:9,color:C.faded}}>INI: {fmtDate(processo.data_inicio)}</span>}
              {processo.data_prazo&&<span className="mono" style={{fontSize:9,color:C.ochre}}>PRAZO: {fmtDate(processo.data_prazo)}</span>}
            </div>
            {atual&&!concluido&&<div style={{fontSize:11,color:C.faded,fontStyle:"italic"}}>→ {atual.nome}</div>}
            {corPrazo&&(
              <div className="mono" style={{fontSize:8,marginTop:4,color:corPrazo,fontWeight:700}}>
                {diasPrazo<0?`⚠ PRAZO VENCIDO HÁ ${Math.abs(diasPrazo)} DIA${Math.abs(diasPrazo)!==1?"S":""}`:
                 diasPrazo===0?"⚠ PRAZO VENCE HOJE":
                 `⚠ PRAZO EM ${diasPrazo} DIA${diasPrazo!==1?"S":""}`}
              </div>
            )}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end",flexShrink:0}}>
            <button className="btn-primary" onClick={()=>onAbrir(processo.id)} style={{fontSize:9,padding:"6px 12px"}}>ABRIR →</button>
            {podeExcluir&&<button className="del-btn" onClick={()=>onDelete(processo.id)}>✕</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Busca Global ─────────────────────────────────────────────────────────────
function BuscaGlobal({processos,secretarias,pessoas,onSelect,onClose,onVerOrgao,onVerPessoa}){
  const [q,setQ]=useState(""); const inputRef=useRef();
  useEffect(()=>inputRef.current?.focus(),[]);
  const res=q.trim().length<2?[]:([
    ...processos.flatMap(p=>{
      const ql=q.toLowerCase(); const hits=[];
      if((p.objeto||p.nome).toLowerCase().includes(ql)||(p.numero||"").toLowerCase().includes(ql)||(p.numero_licitacao||"").toLowerCase().includes(ql)) hits.push({tipo:"PROCESSO",label:p.objeto||p.nome,sub:`${p.modalidade}${p.numero_licitacao?" · Nº "+p.numero_licitacao:""}`,id:p.id,acao:()=>onSelect(p.id)});
      p.etapas.filter(e=>e.nome.toLowerCase().includes(ql)).forEach(e=>hits.push({tipo:"ETAPA",label:e.nome,sub:p.objeto||p.nome,id:p.id,acao:()=>onSelect(p.id)}));
      p.docs.filter(d=>d.nome.toLowerCase().includes(ql)).forEach(d=>hits.push({tipo:"DOC",label:d.nome,sub:p.objeto||p.nome,id:p.id,acao:()=>onSelect(p.id)}));
      return hits;
    }),
    ...(secretarias||[]).filter(s=>s.nome.toLowerCase().includes(q.toLowerCase())||(s.secretario||"").toLowerCase().includes(q.toLowerCase())).map(s=>({tipo:"ÓRGÃO",label:s.nome,sub:s.secretario||"",id:s.id,acao:onVerOrgao})),
    ...(pessoas||[]).filter(p=>p.nome.toLowerCase().includes(q.toLowerCase())||(p.cargo||"").toLowerCase().includes(q.toLowerCase())).map(p=>({tipo:"PESSOA",label:p.nome,sub:p.cargo||"",id:p.id,acao:onVerPessoa})),
  ]).slice(0,12);
  return(
    <div className="search-overlay" onClick={onClose}>
      <div className="search-box fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${C.tape}`}}>
          <span className="mono" style={{padding:"0 14px",color:C.ghost,fontSize:10,whiteSpace:"nowrap"}}>⌕ PROCESSOS · ÓRGÃOS · PESSOAS</span>
          <input ref={inputRef} className="search-input" value={q} onChange={e=>setQ(e.target.value)} placeholder="buscar…" onKeyDown={e=>e.key==="Escape"&&onClose()}/>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.ghost,padding:"14px",fontFamily:"'Space Mono',monospace"}}>✕</button>
        </div>
        {q.length>=2&&(res.length===0?<div className="mono" style={{padding:"20px",textAlign:"center",color:C.ghost,fontSize:10}}>// NENHUM RESULTADO</div>:(
          <div style={{maxHeight:360,overflowY:"auto"}}>
            {res.map((r,i)=>(
              <div key={i} className="search-result" onClick={()=>{r.acao?r.acao():onSelect(r.id);onClose();}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span className="mono" style={{fontSize:8,padding:"1px 6px",borderRadius:2,minWidth:52,textAlign:"center",
                    background:r.tipo==="PROCESSO"?`${C.terra}22`:r.tipo==="ÓRGÃO"?`${C.sage}22`:r.tipo==="PESSOA"?`${C.ochre}22`:`${C.paperDeep}`,
                    color:r.tipo==="PROCESSO"?C.terra:r.tipo==="ÓRGÃO"?C.sage:r.tipo==="PESSOA"?C.ochre:C.ghost}}>{r.tipo}</span>
                  <div><div style={{fontSize:12,fontWeight:600,color:C.ink}}>{r.label}</div><div className="mono" style={{fontSize:9,color:C.ghost}}>{r.sub}</div></div>
                </div>
              </div>
            ))}
          </div>
        ))}
        {q.length<2&&<div className="mono" style={{padding:"12px 18px",color:C.ghost,fontSize:9}}>// digite 2+ caracteres</div>}
      </div>
    </div>
  );
}

// ─── Modais de processo ───────────────────────────────────────────────────────
function ModalProcesso({processo,onSave,onClose,userId}){
  const editando=!!processo;
  const [objeto,setObjeto]=useState(processo?.objeto||"");
  const [mod,setMod]=useState(processo?.modalidade||MODALIDADES[0]);
  const [numProc,setNumProc]=useState(processo?.numero||"");
  const [numLic,setNumLic]=useState(processo?.numero_licitacao||"");

  function salvar(){
    if(!objeto.trim()) return;
    const mudou=editando&&mod!==processo.modalidade;
    onSave({
      ...(editando?processo:{}),
      nome:objeto.trim(),
      objeto:objeto.trim(),
      modalidade:mod,
      numero:numProc.trim(),
      numero_licitacao:numLic.trim(),
      ...(!editando?{id:mkId(),etapas:mkEtapas(mod),docs:mkDocs(mod),secretarias_ids:[],node_positions:{},criado_em:new Date().toISOString(),criado_por:userId}:{}),
      ...(mudou?{etapas:mkEtapas(mod),docs:mkDocs(mod),node_positions:{}}:{})
    });
    onClose();
  }

  return(
    <div className="modal-overlay">
      <div className="modal-box fade-up">
        <div className="modal-header">
          <span className="mono" style={{fontSize:10,fontWeight:700,letterSpacing:".1em",color:C.faded}}>{editando?"EDITAR":"NOVO"} PROCESSO</span>
          <button onClick={onClose} className="del-btn">✕</button>
        </div>
        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label className="lbl">Objeto *</label>
            <input value={objeto} onChange={e=>setObjeto(e.target.value)} className="field" autoFocus
              placeholder="Ex: Contratação de empresa para pavimentação da Rua X"/>
          </div>
          <div>
            <label className="lbl">Modalidade *</label>
            <select value={mod} onChange={e=>setMod(e.target.value)} className="field">
              {MODALIDADES.map(m=><option key={m}>{m}</option>)}
            </select>
            {editando&&mod!==processo.modalidade&&<div className="mono" style={{fontSize:9,color:C.rust,marginTop:4}}>⚠ Mudar modalidade recria etapas e documentos</div>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <label className="lbl">Nº Processo Administrativo</label>
              <input value={numProc} onChange={e=>setNumProc(e.target.value)} className="field" placeholder="Ex: 2208001/2025/SEPLAGE"/>
            </div>
            <div>
              <label className="lbl">Nº da Licitação</label>
              <input value={numLic} onChange={e=>setNumLic(e.target.value)} className="field" placeholder="Ex: 007/2026"/>
            </div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:6,borderTop:`1px solid ${C.tape}`}}>
            <button className="btn-ghost" onClick={onClose}>CANCELAR</button>
            <button className="btn-primary" onClick={salvar}>{editando?"SALVAR":"CRIAR ARQUIVO"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Anexos por documento ─────────────────────────────────────────────────────
function AnexosDoc({doc,processoId,onUpdate,readonly}){
  const [uploading,setUploading]=useState(false);
  const [erro,setErro]=useState("");
  const fileRef=useRef();
  const anexos=doc.anexos||[];
  async function handleUpload(file){
    if(!file) return;
    if(file.size>10*1024*1024){setErro("Arquivo muito grande (máx. 10MB)");return;}
    setUploading(true); setErro("");
    try{
      const path=await supa.uploadAnexo(processoId,doc.uid,file);
      onUpdate({anexos:[...anexos,{path,nome:file.name,tipo:file.type,tamanho:file.size,criadoEm:new Date().toISOString()}]});
    }catch(e){setErro(e.message);}
    setUploading(false);
  }
  async function abrirAnexo(path){
    try{ const url=await supa.getAnexoSigned(path); window.open(url,"_blank"); }
    catch(e){ setErro("Erro ao abrir arquivo"); }
  }
  async function deletarAnexo(path){
    if(!confirm("Remover este anexo?")) return;
    try{ await supa.deleteAnexo(path); onUpdate({anexos:anexos.filter(a=>a.path!==path)}); }
    catch(e){setErro(e.message);}
  }
  function fmtTam(b){ if(b<1024) return b+"B"; if(b<1024*1024) return (b/1024).toFixed(0)+"KB"; return (b/(1024*1024)).toFixed(1)+"MB"; }
  function icone(t){ if(t?.includes("pdf")) return "📄"; if(t?.includes("image")) return "🖼"; if(t?.includes("word")||t?.includes("document")) return "📝"; return "📎"; }
  return(
    <div style={{marginTop:5}}>
      {anexos.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:4}}>
          {anexos.map((a,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:`${C.sage}15`,border:`1px solid ${C.sage}44`,borderRadius:2,padding:"3px 8px"}}>
              <span style={{fontSize:10}}>{icone(a.tipo)}</span>
              <button onClick={()=>abrirAnexo(a.path)} style={{background:"none",border:"none",cursor:"pointer",color:C.sage,fontFamily:"'Lora',serif",fontSize:10,textAlign:"left",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.nome}</button>
              <span className="mono" style={{fontSize:8,color:C.ghost,flexShrink:0}}>{fmtTam(a.tamanho)}</span>
              {!readonly&&<button className="del-btn" style={{fontSize:10}} onClick={()=>deletarAnexo(a.path)}>✕</button>}
            </div>
          ))}
        </div>
      )}
      {!readonly&&(
        <>
          <input ref={fileRef} type="file" style={{display:"none"}} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            onChange={e=>{if(e.target.files[0])handleUpload(e.target.files[0]);e.target.value="";}}/>
          <button onClick={()=>fileRef.current.click()} disabled={uploading} className="mono"
            style={{background:"none",border:`1px dashed ${C.tape}`,borderRadius:2,padding:"2px 8px",fontSize:8,color:C.ghost,cursor:"pointer",letterSpacing:".06em"}}>
            {uploading?"ENVIANDO...":"📎 ANEXAR"}
          </button>
          {erro&&<div className="mono" style={{fontSize:8,color:C.rust,marginTop:2}}>{erro}</div>}
        </>
      )}
    </div>
  );
}

// ─── Popover dica etapa ──────────────────────────────────────────────────────
function PopoverDicaEtapa({etapa,onClose}){
  const dica=DICAS_ETAPAS[etapa.nome];
  if(!dica) return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"0 0 70px"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} className="fade-up"
        style={{background:C.paper,border:`1px solid ${C.tape}`,borderTop:`3px solid ${C.ochre}`,borderRadius:"2px 2px 0 0",width:"100%",maxWidth:560,boxShadow:`0 -4px 24px rgba(26,18,8,.15)`,maxHeight:"70vh",overflowY:"auto"}}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.tape}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",background:C.paperDark}}>
          <div>
            <div className="mono" style={{fontSize:8,color:C.ghost,letterSpacing:".1em",marginBottom:2}}>DICA DE ETAPA</div>
            <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:"'Playfair Display',serif"}}>{etapa.nome}</div>
          </div>
          <button onClick={onClose} className="del-btn" style={{fontSize:14}}>✕</button>
        </div>
        <div style={{padding:"14px 16px"}}>
          <div style={{background:"#f5ead0",border:`1px solid ${C.ochreLight}`,borderLeft:`3px solid ${C.ochre}`,borderRadius:2,padding:"10px 12px",fontSize:12,color:C.ink,lineHeight:1.7,fontFamily:"'Lora',serif"}}>{dica}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Aba Etapas ───────────────────────────────────────────────────────────────
function AbaEtapas({processo,onUpdate,readonly}){
  const [editId,setEditId]=useState(null); const [notaTemp,setNotaTemp]=useState("");
  const [addNome,setAddNome]=useState(""); const [showAdd,setShowAdd]=useState(false);
  const [dragIdx,setDragIdx]=useState(null); const [overIdx,setOverIdx]=useState(null);
  const [dicaEtapa,setDicaEtapa]=useState(null);
  const [editNomeId,setEditNomeId]=useState(null);
  const [nomeTemp,setNomeTemp]=useState("");
  const dFrom=useRef(null); const touchIdx=useRef(null);
  function up(id,ch){ 
    if(readonly&&!('dataEntrega' in ch)) return; 
    const etapa=processo.etapas.find(e=>e.id===id);
    // Auto-preencher data de registro quando status muda para concluída
    const autoData=ch.status==="concluída"&&!etapa?.dataEntrega?{dataEntrega:new Date().toISOString().split("T")[0]}:{};
    const novasEtapas=processo.etapas.map(e=>e.id===id?{...e,...ch,...autoData}:e);
    const desc=ch.status?`Etapa "${etapa?.nome}" marcada como ${ch.status.toUpperCase()}`:ch.nome?`Etapa renomeada para "${ch.nome}"`:null;
    onUpdate({etapas:novasEtapas,...(desc?{_historico:desc}:{})});
  }
  function del(id){ if(readonly) return; onUpdate({etapas:processo.etapas.filter(e=>e.id!==id)}); }
  function add(){ if(!addNome.trim()||readonly) return; onUpdate({etapas:[...processo.etapas,{id:mkId(),nome:addNome.trim(),status:"pendente",prazo:"",dataEntrega:"",nota:""}]}); setAddNome(""); setShowAdd(false); }
  function reorder(from,to){ if(from===null||to===null||from===to||readonly) return; const arr=[...processo.etapas]; const [m]=arr.splice(from,1); arr.splice(to,0,m); onUpdate({etapas:arr}); }
  return(
    <div onTouchMove={e=>{ if(touchIdx.current===null) return; e.preventDefault(); const y=e.touches[0].clientY; const els=document.querySelectorAll('[data-erow]'); let cl=null,mn=999999; els.forEach((el,i)=>{ const r=el.getBoundingClientRect(); const d=Math.abs(y-(r.top+r.height/2)); if(d<mn){mn=d;cl=i;} }); setOverIdx(cl); }} onTouchEnd={()=>{ reorder(touchIdx.current,overIdx); touchIdx.current=null; setDragIdx(null); setOverIdx(null); }}>
      {processo.etapas.map((e,i)=>{
        const done=e.status==="concluída"; const isLast=i===processo.etapas.length-1;
const vencido = e.prazo && !e.dataEntrega && new Date(e.prazo+"T12:00:00") < new Date();
        const atrasado = e.prazo && e.dataEntrega && new Date(e.dataEntrega) > new Date(e.prazo+"T12:00:00");
        return(
          <div key={e.id} data-erow={i} draggable={!readonly}
            onDragStart={()=>{dFrom.current=i;setDragIdx(i);}} onDragEnter={()=>setOverIdx(i)}
            onDragEnd={()=>{reorder(dFrom.current,overIdx);dFrom.current=null;setDragIdx(null);setOverIdx(null);}} onDragOver={ev=>ev.preventDefault()}
            style={{display:"grid",gridTemplateColumns:`${readonly?"":"24px "}28px 1fr auto`,gap:8,padding:"10px 14px 10px 8px",
              borderBottom:isLast?"none":`1px solid ${C.paperDeep}`,borderTop:overIdx===i&&dragIdx!==i?`2px solid ${C.terra}`:"2px solid transparent",
              background:dragIdx===i?`${C.terra}10`:done?`${C.sage}08`:"transparent",opacity:dragIdx===i?.5:1,
              cursor:readonly?"default":"grab",userSelect:"none",transition:"border-top .1s"}}>
            {!readonly&&<span className="drag-handle" onTouchStart={e=>{touchIdx.current=i;setDragIdx(i);}} style={{touchAction:"none"}}>⠿</span>}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:3}}>
              <div style={{width:20,height:20,borderRadius:"50%",border:`1.5px solid ${done?C.sage:C.tape}`,background:done?C.sage:C.paper,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:done?"white":C.ghost,flexShrink:0,fontFamily:"'Space Mono',monospace",transition:"all .3s"}}>{done?"✓":i+1}</div>
              {!isLast&&<div style={{width:1,flex:1,background:C.paperDeep,marginTop:3}}/>}
            </div>
            <div>
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                {editNomeId===e.id&&!readonly?(
                  <input value={nomeTemp} onChange={ev=>setNomeTemp(ev.target.value)} autoFocus
                    onBlur={()=>{up(e.id,{nome:nomeTemp.trim()||e.nome});setEditNomeId(null);}}
                    onKeyDown={ev=>{if(ev.key==="Enter"){up(e.id,{nome:nomeTemp.trim()||e.nome});setEditNomeId(null);}if(ev.key==="Escape")setEditNomeId(null);}}
                    style={{fontSize:12,fontWeight:600,border:`1px solid ${C.terra}`,borderRadius:2,padding:"2px 6px",flex:1,fontFamily:"'Lora',serif"}}/>
                ):(
                  <span style={{fontSize:12,fontWeight:600,color:done?C.ghost:C.ink,textDecoration:done?"line-through":"none",fontFamily:"'Lora',serif",cursor:readonly?"default":"text"}}
                    onClick={()=>{if(!readonly){setEditNomeId(e.id);setNomeTemp(e.nome);}}}>
                    {e.nome}
                  </span>
                )}
                {DICAS_ETAPAS[e.nome]&&(
                  <button onClick={()=>setDicaEtapa(e)}
                    style={{background:"#f5ead0",border:`1px solid ${C.ochreLight}`,borderRadius:"50%",width:16,height:16,
                      fontSize:9,cursor:"pointer",color:C.ochre,fontFamily:"'Space Mono',monospace",
                      fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>?</button>
                )}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:3}}>
                <DateField label="DATA DOC." value={e.prazo} onChange={v=>up(e.id,{prazo:v})} readonly={readonly}/>
                <DateField label="REGISTRO" value={e.dataEntrega||""} onChange={v=>up(e.id,{dataEntrega:v})} readonly={false}/>
                {atrasado&&<span className="mono" style={{fontSize:8,color:C.rust,fontWeight:700}}>⚠ ATRASO</span>}
              </div>
              {editId===e.id?(
                <div>
                  <textarea value={notaTemp} onChange={ev=>setNotaTemp(ev.target.value)} rows={2} autoFocus style={{width:"100%",fontSize:11,border:`1px solid ${C.tape}`,borderRadius:2,padding:"5px 7px",resize:"vertical",background:C.paper}}/>
                  <div style={{display:"flex",gap:5,marginTop:3}}>
                    <button className="btn-primary btn-sm" onClick={()=>{up(e.id,{nota:notaTemp});setEditId(null);}}>SALVAR</button>
                    <button className="btn-ghost btn-sm" onClick={()=>setEditId(null)}>CANCELAR</button>
                  </div>
                </div>
              ):(
                <div onClick={()=>{if(!readonly){setEditId(e.id);setNotaTemp(e.nota||"");}}} style={{fontSize:11,color:e.nota?C.faded:C.ghost,cursor:readonly?"default":"pointer",fontStyle:e.nota?"normal":"italic",fontFamily:"'Lora',serif"}}>{e.nota||(!readonly?"＋ nota…":" -- ")}</div>
              )}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
              <StatusPill status={e.status} config={STATUS_ETAPA} onChange={s=>up(e.id,{status:s})} readonly={readonly}/>
              {!readonly&&<button className="del-btn" onClick={()=>del(e.id)} style={{fontSize:11}}>✕</button>}
            </div>
          </div>
        );
      })}
      {dicaEtapa&&<PopoverDicaEtapa etapa={dicaEtapa} onClose={()=>setDicaEtapa(null)}/>}
      {!readonly&&(
        <div style={{padding:"10px 14px",borderTop:`1px dashed ${C.tape}`,background:C.paperDark}}>
          {showAdd?(
            <div style={{display:"flex",gap:7}}>
              <input value={addNome} onChange={e=>setAddNome(e.target.value)} placeholder="Nome da nova etapa…" autoFocus onKeyDown={e=>{if(e.key==="Enter")add();if(e.key==="Escape")setShowAdd(false);}} className="field" style={{flex:1,fontSize:12}}/>
              <button className="btn-primary btn-sm" onClick={add}>ADICIONAR</button>
              <button className="btn-ghost btn-sm" onClick={()=>setShowAdd(false)}>✕</button>
            </div>
          ):(
            <button onClick={()=>setShowAdd(true)} className="mono" style={{background:"none",border:`1px dashed ${C.tape}`,borderRadius:2,padding:"6px 14px",fontSize:9,color:C.ghost,cursor:"pointer",width:"100%",textAlign:"center",letterSpacing:".1em"}}>＋ ADICIONAR ETAPA</button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Busca de dicas ──────────────────────────────────────────────────────────
function BuscaDicas({onClose}){
  const [q,setQ]=useState(""); const inputRef=useRef();
  useEffect(()=>inputRef.current?.focus(),[]);
  const todasDicas=[
    ...Object.entries(DICAS_PADRAO).map(([id,texto])=>({id,texto,tipo:"DOCUMENTO"})),
    ...Object.entries(DICAS_ETAPAS).map(([nome,texto])=>({id:nome,texto,tipo:"ETAPA"})),
  ];
  const resultados=q.trim().length<2?[]:todasDicas.filter(d=>
    d.texto.toLowerCase().includes(q.toLowerCase())||
    d.id.toLowerCase().includes(q.toLowerCase())
  ).slice(0,8);
  return(
    <div className="search-overlay" onClick={onClose}>
      <div className="search-box fade-up" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${C.tape}`}}>
          <span className="mono" style={{padding:"0 14px",color:C.ghost,fontSize:10,whiteSpace:"nowrap"}}>💡 BUSCAR NAS DICAS</span>
          <input ref={inputRef} className="search-input" value={q} onChange={e=>setQ(e.target.value)}
            placeholder="buscar nas dicas… (ex: dotação, certidão, prazo)"
            onKeyDown={e=>e.key==="Escape"&&onClose()}/>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.ghost,padding:"14px",fontFamily:"'Space Mono',monospace"}}>✕</button>
        </div>
        {q.length>=2&&(resultados.length===0
          ?<div className="mono" style={{padding:"20px",textAlign:"center",color:C.ghost,fontSize:10}}>// NENHUMA DICA ENCONTRADA</div>
          :<div style={{maxHeight:420,overflowY:"auto"}}>
            {resultados.map((r,i)=>(
              <div key={i} style={{padding:"12px 18px",borderBottom:`1px solid ${C.paperDark}`}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                  <span className="mono" style={{fontSize:8,color:C.ghost,background:C.paperDark,padding:"1px 6px",borderRadius:2}}>{r.tipo}</span>
                  <span className="mono" style={{fontSize:9,color:C.terra,fontWeight:700}}>{r.id}</span>
                </div>
                <div style={{fontSize:11,color:C.ink,lineHeight:1.6,fontFamily:"'Lora',serif"}}>{r.texto}</div>
              </div>
            ))}
          </div>
        )}
        {q.length<2&&<div className="mono" style={{padding:"12px 18px",color:C.ghost,fontSize:9}}>// digite 2+ caracteres  --  busca em todas as dicas do sistema</div>}
      </div>
    </div>
  );
}

// ─── Popover Dica ─────────────────────────────────────────────────────────────
function PopoverDica({doc,onClose,onSalvar,readonly}){
  const dicaPadrao=DICAS_PADRAO[doc.id]||"Nenhuma dica padrão para este documento.";
  const [editando,setEditando]=useState(false); const [texto,setTexto]=useState(doc.dicaCustom||"");
  return(
    <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"0 0 70px"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} className="fade-up" style={{background:C.paper,border:`1px solid ${C.tape}`,borderTop:`3px solid ${C.ochre}`,borderRadius:"2px 2px 0 0",width:"100%",maxWidth:560,boxShadow:`0 -4px 24px rgba(26,18,8,.15)`,maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.tape}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",background:C.paperDark}}>
          <div>
            <div className="mono" style={{fontSize:8,color:C.ghost,letterSpacing:".1em",marginBottom:2}}>DICA // {doc.nome.slice(0,28).toUpperCase()}</div>
            <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:"'Playfair Display',serif"}}>{doc.nome}</div>
          </div>
          <button onClick={onClose} className="del-btn" style={{fontSize:14}}>✕</button>
        </div>
        <div style={{padding:"14px 16px"}}>
          <div style={{marginBottom:14}}>
            <div className="mono" style={{fontSize:8,fontWeight:700,color:C.faded,letterSpacing:".1em",marginBottom:7}}>// DICA PADRÃO</div>
            <div style={{background:"#f5ead0",border:`1px solid ${C.ochreLight}`,borderLeft:`3px solid ${C.ochre}`,borderRadius:2,padding:"10px 12px",fontSize:12,color:C.ink,lineHeight:1.6,fontFamily:"'Lora',serif"}}>{dicaPadrao}</div>
          </div>
          {!readonly&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                <div className="mono" style={{fontSize:8,fontWeight:700,color:C.faded,letterSpacing:".1em"}}>// MINHA ANOTAÇÃO</div>
                {!editando&&<button className="btn-ghost btn-sm" onClick={()=>setEditando(true)}>✎ EDITAR</button>}
              </div>
              {editando?(
                <div>
                  <textarea value={texto} onChange={e=>setTexto(e.target.value)} placeholder="Adicione sua anotação…" rows={3} autoFocus style={{width:"100%",fontSize:12,border:`1px solid ${C.tape}`,borderRadius:2,padding:"8px 10px",resize:"vertical",background:C.paper,fontFamily:"'Lora',serif"}}/>
                  <div style={{display:"flex",gap:7,marginTop:6,justifyContent:"flex-end"}}>
                    <button className="btn-ghost btn-sm" onClick={()=>setEditando(false)}>CANCELAR</button>
                    <button className="btn-primary btn-sm" onClick={()=>{onSalvar(texto);setEditando(false);}}>SALVAR</button>
                  </div>
                </div>
              ):(
                <div style={{fontSize:12,color:doc.dicaCustom?C.ink:C.ghost,fontStyle:doc.dicaCustom?"normal":"italic",background:C.paperDark,border:`1px dashed ${C.tape}`,borderRadius:2,padding:"8px 10px",cursor:"pointer",fontFamily:"'Lora',serif",lineHeight:1.5,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}} onClick={()=>setEditando(true)}>
                  <span style={{flex:1}}>{doc.dicaCustom||"＋ clique aqui para adicionar sua anotação…"}</span>
                  <span style={{fontSize:10,color:C.terra,flexShrink:0,fontFamily:"'Space Mono',monospace"}}>✎</span>
                </div>
              )}
            </div>
          )}
          {readonly&&doc.dicaCustom&&(
            <div>
              <div className="mono" style={{fontSize:8,fontWeight:700,color:C.faded,letterSpacing:".1em",marginBottom:7}}>// ANOTAÇÃO DA EQUIPE</div>
              <div style={{fontSize:12,color:C.ink,background:C.paperDark,border:`1px solid ${C.tape}`,borderRadius:2,padding:"8px 10px",fontFamily:"'Lora',serif",lineHeight:1.5}}>{doc.dicaCustom}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Aba Documentos ───────────────────────────────────────────────────────────
function AbaDocumentos({processo,onUpdate,readonly}){
  const [editId,setEditId]=useState(null); const [notaTemp,setNotaTemp]=useState("");
  const [filtroFase,setFiltroFase]=useState("todas"); const [docMarcando,setDocMarcando]=useState(null); const [docDica,setDocDica]=useState(null);
  const [editNomeDocId,setEditNomeDocId]=useState(null); const [nomeDocTemp,setNomeDocTemp]=useState("");
  const [buscaDoc,setBuscaDoc]=useState("");
  const fases=getFases(processo.modalidade);
  function upDoc(uid,ch){ if(readonly) return; onUpdate({docs:processo.docs.map(d=>d.uid===uid?{...d,...ch}:d)}); }
  if(!fases.length) return <div style={{padding:40,textAlign:"center",color:C.ghost,fontFamily:"'Space Mono',monospace",fontSize:10}}>// SEM MAPEAMENTO DOCUMENTAL PARA ESTA MODALIDADE</div>;
  const done=processo.docs.filter(d=>d.status==="concluído"||d.status==="dispensado").length;
  const pctD=processo.docs.length?Math.round((done/processo.docs.length)*100):0;
  const docsFilt=(filtroFase==="todas"?processo.docs:processo.docs.filter(d=>d.faseId===filtroFase))
    .filter(d=>!buscaDoc.trim()||d.nome.toLowerCase().includes(buscaDoc.toLowerCase())||(SUBTITULOS_DOC[d.id]||"").toLowerCase().includes(buscaDoc.toLowerCase())||(d.nota||"").toLowerCase().includes(buscaDoc.toLowerCase()));
  const alertas=processo.docs.filter(d=>d.referencias?.some(uid=>{ const r=processo.docs.find(x=>x.uid===uid); return r&&!["concluído","dispensado"].includes(r.status); }));
  const CORES={ochre:{bg:"#f5ead0",border:C.ochreLight,text:C.ochre},terra:{bg:"#f0dcd8",border:"#c07060",text:C.terra},sage:{bg:"#deebd8",border:"#7aaa6a",text:C.sage},violet:{bg:"#ece8f5",border:"#9a7acf",text:C.violet}};
  return(
    <div>
      <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.tape}`,background:C.paperDark,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:140}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <span className="mono" style={{fontSize:8,color:C.faded}}>{done}/{processo.docs.length} DOCUMENTOS</span>
            <span className="mono" style={{fontSize:8,color:C.faded}}>{pctD}%</span>
          </div>
          <ProgressBar p={pctD} height={3}/>
        </div>
        <input value={buscaDoc} onChange={e=>setBuscaDoc(e.target.value)}
          placeholder="filtrar documentos…"
          style={{border:`1px solid ${C.tape}`,borderRadius:2,padding:"5px 9px",fontSize:10,
            background:C.paper,fontFamily:"'Space Mono',monospace",color:C.ink,
            outline:"none",width:160}}/>
        <select value={filtroFase} onChange={e=>setFiltroFase(e.target.value)} style={{border:`1px solid ${C.tape}`,borderRadius:2,padding:"5px 8px",fontSize:10,background:C.paper,fontFamily:"'Space Mono',monospace",color:C.ink}}>
          <option value="todas">TODAS AS FASES</option>
          {fases.map(f=><option key={f.id} value={f.id}>{f.label.toUpperCase()}</option>)}
        </select>
      </div>
      {alertas.length>0&&(
        <div style={{padding:"8px 16px",background:"#f5ead0",borderBottom:`1px solid ${C.ochreLight}`}}>
          <div className="mono" style={{fontSize:9,fontWeight:700,color:C.ochre,marginBottom:4}}>⚠ AGUARDANDO DEPENDÊNCIAS</div>
          {alertas.map(d=>{ const pend=d.referencias.filter(uid=>{ const r=processo.docs.find(x=>x.uid===uid); return r&&!["concluído","dispensado"].includes(r.status); }); return <div key={d.uid} className="mono" style={{fontSize:9,color:C.faded,marginBottom:2}}>[{d.nome.slice(0,22)}] ← {pend.map(uid=>processo.docs.find(x=>x.uid===uid)?.nome.slice(0,18)).filter(Boolean).join(", ")}</div>; })}
        </div>
      )}
      {fases.filter(f=>filtroFase==="todas"||f.id===filtroFase).map(fase=>{
        const docs=docsFilt.filter(d=>d.faseId===fase.id); if(!docs.length) return null;
        const fd=docs.filter(d=>d.status==="concluído"||d.status==="dispensado").length;
        return(
          <div key={fase.id}>
            <div style={{padding:"7px 16px",display:"flex",alignItems:"center",gap:8,background:`${fase.cor}18`,borderBottom:`1px solid ${fase.cor}44`,borderTop:`1px solid ${fase.cor}22`}}>
              <div style={{width:8,height:8,background:fase.cor,flexShrink:0}}/><span className="mono" style={{fontSize:9,fontWeight:700,color:fase.cor,letterSpacing:".1em"}}>{fase.label.toUpperCase()}</span>
              <span className="mono" style={{fontSize:8,color:C.ghost,marginLeft:"auto"}}>{fd}/{docs.length}</span>
            </div>
            {docs.map((doc,di)=>{
              const cfg=STATUS_DOC[doc.status]||STATUS_DOC.pendente;
              const vencido=doc.dataPrazo&&!doc.dataEmissao&&new Date(doc.dataPrazo+"T12:00:00")<new Date()&&!["concluído","dispensado"].includes(doc.status);
              const temM=doc.marcacoes?.length>0; const temR=doc.referencias?.length>0;
              const refsPend=doc.referencias?.filter(uid=>{ const r=processo.docs.find(x=>x.uid===uid); return r&&!["concluído","dispensado"].includes(r.status); });
              const temDica=!!(DICAS_PADRAO[doc.id]||doc.dicaCustom);
              return(
                <div key={doc.uid} className="doc-row" style={{borderBottom:di===docs.length-1?"none":`1px solid ${C.paperDeep}`,background:refsPend?.length>0?'#fdf8ec':"transparent"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,padding:"9px 16px 9px 24px",alignItems:"start"}}>
                    <div>
                      <div style={{display:"flex",gap:6,alignItems:"flex-start",marginBottom:2,flexWrap:"wrap"}}>
                        {editNomeDocId===doc.uid&&!readonly?(
                          <input value={nomeDocTemp} onChange={e=>setNomeDocTemp(e.target.value)} autoFocus
                            onBlur={()=>{upDoc(doc.uid,{nome:nomeDocTemp.trim()||doc.nome});setEditNomeDocId(null);}}
                            onKeyDown={e=>{if(e.key==="Enter"){upDoc(doc.uid,{nome:nomeDocTemp.trim()||doc.nome});setEditNomeDocId(null);}if(e.key==="Escape")setEditNomeDocId(null);}}
                            style={{fontSize:12,fontWeight:600,border:`1px solid ${C.terra}`,borderRadius:2,padding:"2px 6px",flex:1,fontFamily:"'Lora',serif"}}/>
                        ):(
                          <span style={{fontSize:12,fontWeight:600,color:C.ink,opacity:doc.status==="dispensado"?.5:1,fontFamily:"'Lora',serif"}}>{doc.nome}</span>
                        )}
                        {!readonly&&editNomeDocId!==doc.uid&&(
                          <button onClick={()=>{setEditNomeDocId(doc.uid);setNomeDocTemp(doc.nome);}}
                            style={{background:"none",border:"none",cursor:"pointer",color:C.ghost,fontSize:10,padding:"0 2px",flexShrink:0}} title="Editar nome">✎</button>
                        )}
                        {temDica&&<button onClick={()=>setDocDica(doc)} style={{background:doc.dicaCustom?'#f5ead0':C.paperDark,border:`1px solid ${doc.dicaCustom?C.ochreLight:C.tape}`,borderRadius:"50%",width:16,height:16,fontSize:9,cursor:"pointer",color:doc.dicaCustom?C.ochre:C.ghost,fontFamily:"'Space Mono',monospace",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>?</button>}
                        {temM&&<span style={{fontSize:10,color:C.ochre,cursor:"pointer"}} onClick={()=>!readonly&&setDocMarcando(doc)}>📌 {doc.marcacoes.length}</span>}
                        {temR&&<span style={{fontSize:10,color:refsPend?.length>0?C.rust:C.sage,cursor:"pointer"}} onClick={()=>!readonly&&setDocMarcando(doc)}>🔗 {doc.referencias.length}</span>}
                      </div>
                      {SUBTITULOS_DOC[doc.id]&&(
                        <div style={{fontSize:10,color:C.ghost,fontStyle:"italic",marginBottom:3,fontFamily:"'Lora',serif",lineHeight:1.4}}>
                          {SUBTITULOS_DOC[doc.id]}
                        </div>
                      )}
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:3}}>
                        <span className="mono" style={{fontSize:9,color:C.ghost}}>{doc.resp}</span>
                        <span style={{color:C.tape}}>·</span>
                        <DateField label="EMISSÃO" value={doc.dataEmissao} onChange={v=>upDoc(doc.uid,{dataEmissao:v})} readonly={readonly}/>
                        <DateField label="PRAZO" value={doc.dataPrazo} onChange={v=>upDoc(doc.uid,{dataPrazo:v})} readonly={readonly}/>
                        {vencido&&<span className="mono" style={{fontSize:8,color:C.rust,fontWeight:700}}>⚠ VENCIDO</span>}
                        {refsPend?.length>0&&<span className="mono" style={{fontSize:8,color:C.rust,fontWeight:700}}>⚠ AGUARD.</span>}
                      </div>
                      {temM&&<div style={{display:"flex",flexDirection:"column",gap:2,marginBottom:4}}>{doc.marcacoes.map(m=>{ const cor=CORES[m.cor||"ochre"]||CORES.ochre; return <div key={m.id} style={{fontSize:10,background:cor.bg,border:`1px solid ${cor.border}`,borderRadius:2,padding:"2px 6px",color:cor.text,fontFamily:"'Lora',serif"}}>📌 {m.texto}</div>; })}</div>}
                      {editId===doc.uid?(
                        <div style={{marginTop:4}}>
                          <textarea value={notaTemp} onChange={e=>setNotaTemp(e.target.value)} rows={2} autoFocus style={{width:"100%",fontSize:11,border:`1px solid ${C.tape}`,borderRadius:2,padding:"5px 7px",resize:"vertical",background:C.paper}}/>
                          <div style={{display:"flex",gap:5,marginTop:3}}>
                            <button className="btn-primary btn-sm" onClick={()=>{upDoc(doc.uid,{nota:notaTemp});setEditId(null);}}>SALVAR</button>
                            <button className="btn-ghost btn-sm" onClick={()=>setEditId(null)}>CANCELAR</button>
                          </div>
                        </div>
                      ):(
                        <div onClick={()=>{if(!readonly){setEditId(doc.uid);setNotaTemp(doc.nota||"");}}} style={{fontSize:11,color:doc.nota?C.faded:C.ghost,cursor:readonly?"default":"pointer",fontStyle:doc.nota?"normal":"italic",fontFamily:"'Lora',serif"}}>{doc.nota||(!readonly?"＋ observação…":" -- ")}</div>
                      )}
                      <AnexosDoc doc={doc} processoId={processo.id} readonly={readonly}
                        onUpdate={(ch)=>upDoc(doc.uid,ch)}/>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
                      <StatusPill status={doc.status} config={STATUS_DOC} onChange={s=>upDoc(doc.uid,{status:s})} readonly={readonly}/>
                      {!readonly&&<button className="btn-ghost btn-sm" onClick={()=>setDocMarcando(doc)} style={{fontSize:8,padding:"2px 7px"}}>📌</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {docMarcando&&!readonly&&(
        <div className="modal-overlay" onClick={()=>setDocMarcando(null)}>
          <div className="modal-box fade-up" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><div><div className="mono" style={{fontSize:8,color:C.ghost,marginBottom:2}}>MARCAÇÕES // {docMarcando.nome.slice(0,28).toUpperCase()}</div><div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:"'Playfair Display',serif"}}>{docMarcando.nome}</div></div><button onClick={()=>setDocMarcando(null)} className="del-btn" style={{fontSize:16}}>✕</button></div>
            <MarcacoesEditor doc={docMarcando} todosDoc={processo.docs} onSave={(ch)=>{upDoc(docMarcando.uid,ch);setDocMarcando(null);}}/>
          </div>
        </div>
      )}
      {docDica&&<PopoverDica doc={docDica} onClose={()=>setDocDica(null)} onSalvar={(t)=>{upDoc(docDica.uid,{dicaCustom:t});setDocDica({...docDica,dicaCustom:t});}} readonly={readonly}/>}
    </div>
  );
}

function MarcacoesEditor({doc,todosDoc,onSave}){
  const [marcacoes,setMarcacoes]=useState(doc.marcacoes||[]);
  const [referencias,setReferencias]=useState(doc.referencias||[]);
  const [novaMarcacao,setNovaMarcacao]=useState(""); const [showAddM,setShowAddM]=useState(false);
  const [showAddR,setShowAddR]=useState(false); const [refSel,setRefSel]=useState("");
  const CORES={ochre:{bg:"#f5ead0",border:C.ochreLight,text:C.ochre,name:"ATENÇÃO"},terra:{bg:"#f0dcd8",border:"#c07060",text:C.terra,name:"URGENTE"},sage:{bg:"#deebd8",border:"#7aaa6a",text:C.sage,name:"INFO"},violet:{bg:"#ece8f5",border:"#9a7acf",text:C.violet,name:"REF"}};
  return(
    <div style={{padding:"14px 18px"}}>
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span className="mono" style={{fontSize:8,fontWeight:700,color:C.faded,letterSpacing:".1em"}}>// INFORMAÇÕES IMPORTANTES</span><button className="btn-ghost btn-sm" onClick={()=>setShowAddM(v=>!v)}>＋ MARCAR</button></div>
        {showAddM&&<div style={{marginBottom:10,background:C.paperDark,padding:10,border:`1px solid ${C.tape}`,borderRadius:2}}><textarea value={novaMarcacao} onChange={e=>setNovaMarcacao(e.target.value)} rows={2} autoFocus placeholder="Ex: Número gerado: 001/2025  --  usar no TR" style={{width:"100%",fontSize:12,border:`1px solid ${C.tape}`,borderRadius:2,padding:"6px 8px",resize:"vertical",background:C.paper,marginBottom:6}}/><div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><button className="btn-ghost btn-sm" onClick={()=>{setShowAddM(false);setNovaMarcacao("");}}>CANCELAR</button><button className="btn-primary btn-sm" onClick={()=>{if(!novaMarcacao.trim())return;setMarcacoes(p=>[...p,{id:mkId(),texto:novaMarcacao.trim(),cor:"ochre"}]);setNovaMarcacao("");setShowAddM(false);}}>SALVAR</button></div></div>}
        {marcacoes.length===0&&!showAddM&&<div className="mono" style={{fontSize:9,color:C.ghost}}>// nenhuma marcação</div>}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>{marcacoes.map(m=>{ const cor=CORES[m.cor||"ochre"]||CORES.ochre; return(<div key={m.id} style={{background:cor.bg,border:`1px solid ${cor.border}`,borderRadius:2,padding:"7px 10px",display:"flex",gap:8,alignItems:"flex-start"}}><div style={{flex:1}}><div className="mono" style={{fontSize:8,color:cor.text,marginBottom:2}}>[{cor.name}]</div><div style={{fontSize:12,color:C.ink,lineHeight:1.5}}>{m.texto}</div></div><div style={{display:"flex",gap:3,alignItems:"center",flexShrink:0}}>{Object.entries(CORES).map(([k,v])=><button key={k} onClick={()=>setMarcacoes(p=>p.map(x=>x.id===m.id?{...x,cor:k}:x))} style={{width:10,height:10,borderRadius:"50%",background:v.border,border:m.cor===k?`2px solid ${C.ink}`:"2px solid transparent",cursor:"pointer",padding:0}}/>)}<button className="del-btn" style={{fontSize:11}} onClick={()=>setMarcacoes(p=>p.filter(x=>x.id!==m.id))}>✕</button></div></div>); })}</div>
      </div>
      <div style={{borderTop:`1px solid ${C.tape}`,paddingTop:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span className="mono" style={{fontSize:8,fontWeight:700,color:C.faded,letterSpacing:".1em"}}>// DEPENDE DE</span><button className="btn-ghost btn-sm" onClick={()=>setShowAddR(v=>!v)}>＋ VINCULAR</button></div>
        {showAddR&&<div style={{display:"flex",gap:6,marginBottom:10}}><select value={refSel} onChange={e=>setRefSel(e.target.value)} className="field" style={{flex:1,fontSize:11}}><option value="">Selecionar…</option>{todosDoc.filter(d=>d.uid!==doc.uid&&!referencias.includes(d.uid)).map(d=><option key={d.uid} value={d.uid}>{d.nome}</option>)}</select><button className="btn-primary btn-sm" onClick={()=>{if(!refSel||referencias.includes(refSel))return;setReferencias(p=>[...p,refSel]);setRefSel("");}}>OK</button><button className="btn-ghost btn-sm" onClick={()=>setShowAddR(false)}>✕</button></div>}
        {referencias.length===0&&!showAddR&&<div className="mono" style={{fontSize:9,color:C.ghost}}>// nenhuma referência</div>}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>{referencias.map(uid=>{ const ref=todosDoc.find(d=>d.uid===uid); if(!ref) return null; const cfg=STATUS_DOC[ref.status]||STATUS_DOC.pendente; return(<div key={uid} style={{background:C.paperDark,border:`1px solid ${C.tape}`,borderRadius:2,padding:"7px 10px",display:"flex",gap:8,alignItems:"center"}}><Dot color={cfg.dot}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:600,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ref.nome}</div><div className="mono" style={{fontSize:8,color:C.ghost}}>{cfg.label}</div></div><button className="del-btn" style={{fontSize:11}} onClick={()=>setReferencias(p=>p.filter(r=>r!==uid))}>✕</button></div>); })}</div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:14,paddingTop:12,borderTop:`1px solid ${C.tape}`}}><button className="btn-primary" onClick={()=>onSave({marcacoes,referencias})}>SALVAR</button></div>
    </div>
  );
}

// ─── Aba Fluxo ────────────────────────────────────────────────────────────────
const NW=160,NH=84;
function defaultPos(n){ return Array.from({length:n},(_,i)=>({x:30+(i%3)*190,y:30+Math.floor(i/3)*150})); }
function AbaFluxo({processo,onUpdate,readonly}){
  const fases=getFases(processo.modalidade);
  const canvasRef=useRef(null);
  const saved=processo.node_positions||{};
  const [pos,setPos]=useState(()=>fases.map((_,i)=>saved[i]||defaultPos(fases.length)[i]));
  const [exp,setExp]=useState(null);
  const drag=useRef(null); const off=useRef({x:0,y:0});
  useEffect(()=>setPos(fases.map((_,i)=>saved[i]||defaultPos(fases.length)[i])),[processo.modalidade]);
  if(!fases.length) return <div style={{padding:40,textAlign:"center",color:C.ghost,fontFamily:"'Space Mono',monospace",fontSize:10}}>// SEM FLUXO PARA ESTA MODALIDADE</div>;
  const canW=Math.max(...pos.map(p=>p.x+NW))+40; const canH=Math.max(...pos.map(p=>p.y+NH))+60;
  function startDrag(e,i){ if(readonly) return; e.preventDefault(); drag.current=i; const rect=canvasRef.current.getBoundingClientRect(); const cx=e.touches?e.touches[0].clientX:e.clientX; const cy=e.touches?e.touches[0].clientY:e.clientY; off.current={x:cx-rect.left-pos[i].x,y:cy-rect.top-pos[i].y}; }
  function moveDrag(e){ if(drag.current===null) return; const rect=canvasRef.current.getBoundingClientRect(); const cx=e.touches?e.touches[0].clientX:e.clientX; const cy=e.touches?e.touches[0].clientY:e.clientY; setPos(prev=>prev.map((p,i)=>i===drag.current?{x:Math.max(0,cx-rect.left-off.current.x),y:Math.max(0,cy-rect.top-off.current.y)}:p)); }
  function endDrag(){ if(drag.current===null) return; drag.current=null; if(!readonly){ const np={}; pos.forEach((p,i)=>np[i]=p); onUpdate({node_positions:np}); } }
  function center(i){ return {x:pos[i].x+NW/2,y:pos[i].y+NH/2}; }
  return(
    <div style={{background:C.paper}}>
      <div style={{display:"flex",gap:10,padding:"8px 14px",borderBottom:`1px solid ${C.tape}`,flexWrap:"wrap",alignItems:"center"}}>
        <span className="mono" style={{fontSize:9,color:C.ghost}}>// MAPA DE FLUXO{!readonly?" · ARRASTE OS NÓS":""}</span>
        {!readonly&&<button className="btn-ghost btn-sm" style={{marginLeft:"auto"}} onClick={()=>setPos(defaultPos(fases.length))}>RESET</button>}
      </div>
      <div style={{overflow:"auto",maxHeight:500}}>
        <div ref={canvasRef} style={{position:"relative",width:canW,height:canH,userSelect:"none"}} onMouseMove={moveDrag} onMouseUp={endDrag} onMouseLeave={endDrag} onTouchMove={moveDrag} onTouchEnd={endDrag}>
          <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} overflow="visible">
            <defs><marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill={C.tape}/></marker></defs>
            {fases.slice(0,-1).map((_,i)=>{ const a=center(i),b=center(i+1),mx=(a.x+b.x)/2; return <path key={i} d={`M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`} fill="none" stroke={C.tape} strokeWidth={1.5} strokeDasharray="4,3" markerEnd="url(#arr)" opacity={.7}/>; })}
          </svg>
          {fases.map((fase,i)=>{
            const docs=processo.docs.filter(d=>d.faseId===fase.id);
            const dn=docs.filter(d=>d.status==="concluído"||d.status==="dispensado").length;
            const fp=docs.length?Math.round((dn/docs.length)*100):0;
            const p=pos[i];
            return(
              <div key={fase.id}>
                <div style={{position:"absolute",left:p.x,top:p.y,width:NW,height:NH,background:C.paperDark,border:`1.5px solid ${fase.cor}`,borderTop:`4px solid ${fase.cor}`,borderRadius:2,cursor:readonly?"pointer":"grab",userSelect:"none",boxShadow:`2px 2px 0 ${C.tape}`,padding:"8px 10px",zIndex:10}}
                  onMouseDown={e=>startDrag(e,i)} onTouchStart={e=>startDrag(e,i)} onClick={()=>setExp(exp===fase.id?null:fase.id)}>
                  <div className="mono" style={{fontSize:8,fontWeight:700,color:fase.cor,letterSpacing:".1em",marginBottom:3}}>{fase.label.toUpperCase()}</div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span className="mono" style={{fontSize:9,color:C.faded}}>{dn}/{docs.length}</span><span className="mono" style={{fontSize:9,fontWeight:700,color:fp===100?C.sage:C.faded}}>{fp}%</span></div>
                  <ProgressBar p={fp} color={fase.cor} height={3}/>
                  <div style={{display:"flex",gap:2,flexWrap:"wrap",marginTop:4}}>{docs.slice(0,14).map(d=>{ const cfg=STATUS_DOC[d.status]||STATUS_DOC.pendente; return <span key={d.uid} style={{width:5,height:5,background:cfg.dot,display:"inline-block"}} title={d.nome}/>; })}{docs.length>14&&<span className="mono" style={{fontSize:7,color:C.ghost}}>+{docs.length-14}</span>}</div>
                </div>
                {exp===fase.id&&(
                  <div style={{position:"absolute",left:Math.max(4,Math.min(p.x,canW-255)),top:p.y+NH+6,width:248,zIndex:50,background:C.paperDark,border:`1.5px solid ${fase.cor}`,borderTop:`3px solid ${fase.cor}`,borderRadius:2,boxShadow:`4px 4px 0 ${C.tape}`,overflow:"hidden"}}>
                    <div style={{background:fase.cor,padding:"5px 10px",display:"flex",justifyContent:"space-between"}}><span className="mono" style={{fontSize:8,fontWeight:700,color:"white"}}>{fase.label.toUpperCase()}</span><button onClick={e=>{e.stopPropagation();setExp(null);}} style={{background:"none",border:"none",color:"white",cursor:"pointer",fontSize:12}}>✕</button></div>
                    <div style={{maxHeight:260,overflowY:"auto"}}>{docs.map((doc,di)=>{ const cfg=STATUS_DOC[doc.status]||STATUS_DOC.pendente; return(<div key={doc.uid} style={{display:"flex",alignItems:"flex-start",gap:6,padding:"6px 10px",borderBottom:di===docs.length-1?"none":`1px solid ${C.paperDeep}`}}><div style={{width:5,height:5,background:cfg.dot,flexShrink:0,marginTop:4}}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:600,color:C.ink,lineHeight:1.3,fontFamily:"'Lora',serif"}}>{doc.nome}</div><div className="mono" style={{fontSize:8,color:C.ghost}}>{doc.resp}</div>{doc.dataEmissao&&<div className="mono" style={{fontSize:8,color:C.sage}}>✓ {fmtDate(doc.dataEmissao)}</div>}</div><span className="mono" style={{fontSize:7,padding:"1px 4px",background:cfg.bg,color:C.ink,border:`1px solid ${cfg.border}`,whiteSpace:"nowrap",flexShrink:0}}>{cfg.label}</span></div>); })}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Aba Histórico ───────────────────────────────────────────────────────────
function AbaHistorico({processo}){
  const historico=[...(processo.historico||[])].reverse();
  if(historico.length===0) return(
    <div style={{padding:24,textAlign:"center"}}>
      <div className="mono" style={{fontSize:9,color:C.ghost,letterSpacing:".1em"}}>// NENHUMA ALTERAÇÃO REGISTRADA</div>
    </div>
  );
  return(
    <div style={{padding:"16px"}}>
      <div className="mono" style={{fontSize:9,color:C.faded,letterSpacing:".1em",marginBottom:12}}>// HISTÓRICO DE ALTERAÇÕES</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {historico.map((h,i)=>(
          <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"8px 10px",background:i===0?`${C.sage}15`:C.paperDark,border:`1px solid ${C.tape}`,borderLeft:`3px solid ${i===0?C.sage:C.tape}`,borderRadius:2}}>
            <div style={{flexShrink:0}}>
              <div className="mono" style={{fontSize:8,color:C.ghost}}>{new Date(h.at).toLocaleDateString("pt-BR")}</div>
              <div className="mono" style={{fontSize:8,color:C.ghost}}>{new Date(h.at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{flex:1}}>
              <div className="mono" style={{fontSize:9,color:C.terra,fontWeight:700,marginBottom:2}}>{h.por}</div>
              <div style={{fontSize:11,color:C.faded,fontFamily:"'Lora',serif"}}>{h.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Aba Órgãos Processo ─────────────────────────────────────────────────────
function AbaOrgaosProc({processo,secretarias,onUpdate,readonly}){
  const vinc=(secretarias||[]).filter(s=>(processo.secretarias_ids||[]).includes(s.id));
  const disp=(secretarias||[]).filter(s=>!(processo.secretarias_ids||[]).includes(s.id));
  return(
    <div style={{padding:16}}>
      <div className="mono" style={{fontSize:9,fontWeight:700,color:C.faded,letterSpacing:".1em",marginBottom:10}}>// ÓRGÃOS VINCULADOS</div>
      {vinc.length===0&&<div className="mono" style={{fontSize:9,color:C.ghost,marginBottom:12}}>// nenhum vinculado</div>}
      {vinc.length>0&&<div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>{vinc.map(s=>(
        <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,background:C.paperDark,border:`1px solid ${C.tape}`,borderRadius:2,padding:"8px 12px"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:"'Playfair Display',serif"}}>{s.nome}</div>
            {s.secretario&&<div className="mono" style={{fontSize:9,color:C.ghost}}>SEC: {s.secretario}</div>}
            {s.email&&<div className="mono" style={{fontSize:9,color:C.ghost}}>{s.email}</div>}
            <span className="mono" style={{fontSize:8,padding:"1px 6px",borderRadius:1,background:s.possui_fundos?'#deebd8':"#f0dcd8",color:s.possui_fundos?C.sage:C.rust,border:`1px solid ${s.possui_fundos?'#7aaa6a':"#c07060"}`}}>{s.possui_fundos?"✓ FUNDOS":"✗ SEM FUNDOS"}</span>
          </div>
          {!readonly&&<button className="del-btn" onClick={()=>onUpdate({secretarias_ids:(processo.secretarias_ids||[]).filter(x=>x!==s.id)})}>✕</button>}
        </div>
      ))}</div>}
      {!readonly&&disp.length>0&&<><div className="mono" style={{fontSize:9,fontWeight:700,color:C.faded,letterSpacing:".1em",marginBottom:8}}>// VINCULAR ÓRGÃO</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{disp.map(s=><button key={s.id} onClick={()=>onUpdate({secretarias_ids:[...(processo.secretarias_ids||[]),s.id]})} className="btn-ghost" style={{fontSize:9}}>＋ {s.nome}</button>)}</div></>}
    </div>
  );
}

// ─── Aba Pessoas Processo ─────────────────────────────────────────────────────
function AbaPessoasProc({processo,pessoas,onUpdate,readonly}){
  const vinc=(pessoas||[]).filter(p=>(processo.pessoas_ids||[]).includes(p.id));
  const disp=(pessoas||[]).filter(p=>!(processo.pessoas_ids||[]).includes(p.id));
  return(
    <div style={{padding:16}}>
      <div className="mono" style={{fontSize:9,fontWeight:700,color:C.faded,letterSpacing:".1em",marginBottom:10}}>// PESSOAS VINCULADAS</div>
      {vinc.length===0&&<div className="mono" style={{fontSize:9,color:C.ghost,marginBottom:12}}>// nenhuma vinculada</div>}
      {vinc.length>0&&<div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>{vinc.map(p=>(
        <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,background:C.paperDark,border:`1px solid ${C.tape}`,borderRadius:2,padding:"8px 12px"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:"'Playfair Display',serif"}}>{p.nome}</div>
            {p.cargo&&<div className="mono" style={{fontSize:9,color:C.terra,fontWeight:700}}>{p.cargo.toUpperCase()}</div>}
            {p.orgao&&<div className="mono" style={{fontSize:9,color:C.ghost}}>🏛 {p.orgao}</div>}
            {p.email&&<div className="mono" style={{fontSize:9,color:C.ghost}}>{p.email}</div>}
          </div>
          {!readonly&&<button className="del-btn" onClick={()=>onUpdate({pessoas_ids:(processo.pessoas_ids||[]).filter(x=>x!==p.id)})}>✕</button>}
        </div>
      ))}</div>}
      {!readonly&&disp.length>0&&<><div className="mono" style={{fontSize:9,fontWeight:700,color:C.faded,letterSpacing:".1em",marginBottom:8}}>// VINCULAR PESSOA</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{disp.map(p=><button key={p.id} onClick={()=>onUpdate({pessoas_ids:[...(processo.pessoas_ids||[]),p.id]})} className="btn-ghost" style={{fontSize:9}}>＋ {p.nome}{p.cargo?` (${p.cargo})`:""}</button>)}</div></>}
    </div>
  );
}

// ─── Tela Processo ────────────────────────────────────────────────────────────
function TelaProcesso({processo,secretarias,onUpdate,perfil}){
  const [aba,setAba]=useState("etapas"); const [showEdit,setShowEdit]=useState(false);
  const pE=pct(processo.etapas,"status"); const pD=pct(processo.docs,"status");
  const mc=MODAL_CODES[processo.modalidade]||{code:"???",color:C.faded};
  const temDocs=getFases(processo.modalidade).length>0;
  const readonly=perfil==="visualizador";
  return(
    <div>
      <div style={{background:C.paperDark,borderBottom:`2px solid ${C.tape}`,padding:"14px 18px"}}>
        <div style={{maxWidth:920,margin:"0 auto"}}>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
            <div style={{background:mc.color,padding:"3px 10px",borderRadius:1,display:"flex",alignItems:"center",gap:6}}>
              <span className="mono" style={{fontSize:9,fontWeight:700,color:"white",letterSpacing:".12em"}}>CODE_{mc.code} // FILE_{padCode(processo.id)}</span>
            </div>
            {processo.numero&&<span className="mono" style={{fontSize:9,color:C.ghost}}>Nº {processo.numero}</span>}
            {readonly&&<span className="mono" style={{fontSize:8,color:C.ghost,marginLeft:"auto"}}>SOMENTE LEITURA</span>}
          </div>
          <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
            <div style={{flex:1,minWidth:0}}>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:C.ink,lineHeight:1.2,marginBottom:8}}>{processo.objeto||processo.nome}</h2>
              <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
                <DateField label="INÍCIO" value={processo.data_inicio} onChange={v=>onUpdate({data_inicio:v})} readonly={readonly}/>
                <DateField label="PRAZO" value={processo.data_prazo} onChange={v=>onUpdate({data_prazo:v})} readonly={readonly}/>
              </div>
              {/* Observações gerais */}
              {!readonly?(
                <textarea value={processo.obs_geral||""} onChange={e=>onUpdate({obs_geral:e.target.value})}
                  placeholder="＋ observações gerais do processo…"
                  rows={2}
                  style={{width:"100%",fontSize:11,border:`1px dashed ${C.tape}`,borderRadius:2,
                    padding:"6px 10px",resize:"vertical",background:"transparent",
                    fontFamily:"'Lora',serif",color:C.faded,marginTop:4}}/>
              ):(
                processo.obs_geral&&<div style={{fontSize:11,color:C.faded,fontStyle:"italic",
                  marginTop:4,padding:"6px 10px",background:`${C.paper}88`,
                  borderLeft:`2px solid ${C.tape}`,fontFamily:"'Lora',serif"}}>
                  {processo.obs_geral}
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <div style={{display:"flex",gap:6,alignItems:"center"}}><span className="mono" style={{fontSize:8,color:C.ghost,minWidth:40}}>ETAPAS</span><div style={{flex:1}}><ProgressBar p={pE} color={mc.color} height={4}/></div><span className="mono" style={{fontSize:9,color:C.faded,minWidth:30,textAlign:"right"}}>{pE}%</span></div>
                {temDocs&&processo.docs?.length>0&&<div style={{display:"flex",gap:6,alignItems:"center"}}><span className="mono" style={{fontSize:8,color:C.ghost,minWidth:40}}>DOCS</span><div style={{flex:1}}><ProgressBar p={pD} color={C.faded} height={4}/></div><span className="mono" style={{fontSize:9,color:C.faded,minWidth:30,textAlign:"right"}}>{pD}%</span></div>}
              </div>
            </div>
            {!readonly&&<button className="btn-ghost" onClick={()=>setShowEdit(true)} style={{fontSize:9,padding:"5px 10px",flexShrink:0}}>✎ EDITAR</button>}
          </div>
        </div>
      </div>
      <div className="tab-row" style={{maxWidth:920,margin:"0 auto",width:"100%"}}>
        {[["etapas","01 // ETAPAS"],["documentos","02 // DOCUMENTOS"],["fluxo","03 // FLUXO"],["orgaos","04 // ÓRGÃOS"],["pessoas","05 // PESSOAS"],["historico","06 // HISTÓRICO"]].map(([k,l])=>(
          <button key={k} className={`tab-item${aba===k?" active":""}`} onClick={()=>setAba(k)}>{l}</button>
        ))}
      </div>
      <div style={{maxWidth:920,margin:"0 auto",background:"white",borderLeft:`1px solid ${C.tape}`,borderRight:`1px solid ${C.tape}`,borderBottom:`1px solid ${C.tape}`,minHeight:400}}>
        {aba==="etapas"&&<AbaEtapas processo={processo} onUpdate={onUpdate} readonly={readonly}/>}
        {aba==="documentos"&&<AbaDocumentos processo={processo} onUpdate={onUpdate} readonly={readonly}/>}
        {aba==="fluxo"&&<AbaFluxo processo={processo} onUpdate={onUpdate} readonly={readonly}/>}
        {aba==="orgaos"&&<AbaOrgaosProc processo={processo} secretarias={secretarias} onUpdate={onUpdate} readonly={readonly}/>}
        {aba==="pessoas"&&<AbaPessoasProc processo={processo} pessoas={secretarias.filter(s=>s.tipo==="pessoa")} onUpdate={onUpdate} readonly={readonly}/>}
        {aba==="historico"&&<AbaHistorico processo={processo}/>}
      </div>
      {showEdit&&!readonly&&<ModalProcesso processo={processo} onSave={onUpdate} onClose={()=>setShowEdit(false)}/>}
    </div>
  );
}

// ─── Gerador PDF ──────────────────────────────────────────────────────────────
function gerarPDF(processos){
  const STATUS_LABEL={pendente:"Pendente","em andamento":"Em andamento",concluída:"Concluída",bloqueada:"Bloqueada"};
  const total=processos.length; const conc=processos.filter(isConcluido).length; const emAnd=processos.filter(isEmAndamento).length;
  const porMod={};processos.forEach(p=>{if(!porMod[p.modalidade])porMod[p.modalidade]={count:0,conc:0};porMod[p.modalidade].count++;if(isConcluido(p))porMod[p.modalidade].conc++;});
  const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Relatório  --  Processos Licitatórios</title><style>@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Space+Mono:wght@400;700&family=Lora:wght@400;600&display=swap');*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Lora',serif;color:#1a1208;padding:40px;font-size:12px;}.mono{font-family:'Space Mono',monospace;}h1{font-family:'Playfair Display',serif;font-size:24px;margin-bottom:4px;}.header{border-bottom:3px solid #8b3a1a;padding-bottom:16px;margin-bottom:24px;}.meta{font-family:'Space Mono',monospace;font-size:9px;color:#6b5a3e;letter-spacing:.1em;margin-bottom:8px;}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;border:1px solid #d4b896;margin-bottom:24px;}.metric{padding:12px 14px;background:#f0e8d5;border-right:1px solid #d4b896;}.metric:last-child{border-right:none;}.metric-val{font-family:'Space Mono',monospace;font-size:26px;font-weight:700;}.metric-lbl{font-family:'Space Mono',monospace;font-size:8px;color:#6b5a3e;letter-spacing:.1em;margin-top:3px;}.section-title{font-family:'Space Mono',monospace;font-size:9px;color:#6b5a3e;letter-spacing:.12em;border-bottom:1px solid #d4b896;padding-bottom:6px;margin:20px 0 12px;}.processo{border:1px solid #d4b896;border-top:3px solid #8b3a1a;margin-bottom:16px;break-inside:avoid;}.proc-header{background:#e0d4bb;padding:10px 14px;display:flex;justify-content:space-between;align-items:flex-start;}.proc-nome{font-family:'Playfair Display',serif;font-size:14px;font-weight:700;}.proc-meta{font-family:'Space Mono',monospace;font-size:8px;color:#6b5a3e;margin-top:3px;}.prog-bar{height:3px;background:#cfc0a0;}.prog-fill{height:100%;background:#8b3a1a;}.etapas{padding:10px 14px;}.etapa{display:flex;gap:8px;align-items:flex-start;padding:4px 0;border-bottom:1px solid #e0d4bb;}.etapa:last-child{border-bottom:none;}.etapa-num{font-family:'Space Mono',monospace;font-size:8px;color:#9a8870;min-width:20px;}.etapa-nome{flex:1;font-size:11px;}.etapa-status{font-family:'Space Mono',monospace;font-size:8px;padding:1px 5px;}.s-p{background:#ede4d0;color:#6b5a3e;border:1px solid #d4b896;}.s-a{background:#f5ead0;color:#a06820;border:1px solid #c98a2e;}.s-c{background:#deebd8;color:#4a6040;border:1px solid #7aaa6a;}.s-b{background:#f0dcd8;color:#7a2810;border:1px solid #c07060;}.footer{margin-top:32px;border-top:1px solid #d4b896;padding-top:12px;font-family:'Space Mono',monospace;font-size:8px;color:#9a8870;letter-spacing:.08em;}@media print{.processo{break-inside:avoid;}}</style></head><body><div class="header"><div class="meta">RELATÓRIO DE PROCESSOS LICITATÓRIOS // LEI 14.133/2021 // ${new Date().toLocaleDateString("pt-BR")}</div><h1>Processos Licitatórios</h1></div><div class="metrics"><div class="metric"><div class="metric-val">${total}</div><div class="metric-lbl">TOTAL</div></div><div class="metric"><div class="metric-val">${emAnd}</div><div class="metric-lbl">EM CURSO</div></div><div class="metric"><div class="metric-val">${conc}</div><div class="metric-lbl">CONCLUÍDOS</div></div><div class="metric"><div class="metric-val">${total-conc-emAnd}</div><div class="metric-lbl">PENDENTES</div></div></div><div class="section-title">POR MODALIDADE</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:24px;">${Object.entries(porMod).map(([m,{count,conc}])=>`<div style="border:1px solid #d4b896;border-top:3px solid #8b3a1a;padding:10px 12px;background:#f0e8d5;"><div style="font-family:'Space Mono',monospace;font-size:8px;font-weight:700;color:#8b3a1a;margin-bottom:4px;">${m.toUpperCase()}</div><div style="font-family:'Space Mono',monospace;font-size:20px;font-weight:700;">${count}</div><div style="font-family:'Space Mono',monospace;font-size:9px;color:#6b5a3e;">${conc} concluído${conc!==1?"s":""}</div></div>`).join("")}</div><div class="section-title">PROCESSOS E ETAPAS</div>${processos.map(p=>{ const pe=pct(p.etapas,"status"); return `<div class="processo"><div class="proc-header"><div><div style="font-family:'Space Mono',monospace;font-size:8px;color:#8b3a1a;margin-bottom:3px;">${p.modalidade.toUpperCase()}${p.numero?" // Nº "+p.numero:""}</div><div class="proc-nome">${p.nome}</div><div class="proc-meta">${p.data_inicio?"INI: "+fmtDate(p.data_inicio)+" ":""}${p.data_prazo?"PRAZO: "+fmtDate(p.data_prazo):""}</div></div><div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:#8b3a1a;">${pe}%</div></div><div class="prog-bar"><div class="prog-fill" style="width:${pe}%"></div></div><div class="etapas">${p.etapas.map((e,i)=>{ const sc=e.status==="concluída"?"s-c":e.status==="em andamento"?"s-a":e.status==="bloqueada"?"s-b":"s-p"; return `<div class="etapa"><span class="etapa-num">${i+1}</span><span class="etapa-nome">${e.nome}${e.nota?`  --  <em style="color:#6b5a3e">${e.nota}</em>`:""}</span><span class="etapa-status ${sc}">${(STATUS_LABEL[e.status]||e.status).toUpperCase()}</span></div>`; }).join("")}</div></div>`; }).join("")}<div class="footer">GERADO EM ${new Date().toLocaleString("pt-BR")} // LEI 14.133/2021</div></body></html>`;
  const win=window.open("","_blank"); win.document.write(html); win.document.close(); win.focus(); setTimeout(()=>win.print(),800);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({processos,onAbrir,onVerTodos}){
  const total=processos.length; const conc=processos.filter(isConcluido).length; const emAnd=processos.filter(isEmAndamento).length; const pend=total-conc-emAnd;
  const porMod=MODALIDADES.map(m=>({m,count:processos.filter(p=>p.modalidade===m).length,conc:processos.filter(p=>p.modalidade===m&&isConcluido(p)).length})).filter(x=>x.count>0);
  const atencao=processos.filter(p=>p.data_prazo&&new Date(p.data_prazo+"T12:00:00")<new Date(Date.now()+7*86400000)&&!isConcluido(p));
  const recentes=processos.slice(0,5);
  return(
    <div style={{maxWidth:920,margin:"0 auto",padding:"24px 16px 56px"}}>
      <div style={{marginBottom:24,borderBottom:`1px solid ${C.tape}`,paddingBottom:12,display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:10}}>
        <div><div className="mono" style={{fontSize:9,color:C.ghost,letterSpacing:".12em",marginBottom:4}}>ARCHIVE LOG // {new Date().toLocaleDateString("pt-BR")} // LEI 14.133</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:C.ink}}>Processos Licitatórios</div></div>
        {processos.length>0&&<button className="btn-ghost" onClick={()=>gerarPDF(processos)} style={{fontSize:9}}>⬇ EXPORTAR PDF</button>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,marginBottom:28,border:`1px solid ${C.tape}`,borderRadius:2,overflow:"hidden"}}>
        {[{label:"TOTAL",v:total,cor:C.ink,dark:true},{label:"EM CURSO",v:emAnd,cor:C.ochre},{label:"CONCLUÍDOS",v:conc,cor:C.sage},{label:"PENDENTES",v:pend,cor:C.ghost}].map((m,i)=>(
          <div key={m.label} style={{background:m.dark?C.inkLight:C.paperDark,padding:"14px 16px",borderRight:i<3?`1px solid ${C.tape}`:"none"}}>
            <div className="mono" style={{fontSize:8,color:m.dark?C.ghost:C.ghost,letterSpacing:".1em",marginBottom:3}}>{m.label}</div>
            <div style={{fontSize:28,fontWeight:700,color:m.dark?C.paper:m.cor,fontFamily:"'Space Mono',monospace",lineHeight:1}}>{m.v}</div>
          </div>
        ))}
      </div>
      {porMod.length>0&&(
        <div style={{marginBottom:28}}>
          <div className="mono" style={{fontSize:9,color:C.faded,letterSpacing:".12em",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>MODALIDADES<span style={{flex:1,height:1,background:C.tape,display:"inline-block",marginLeft:8}}/></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8}}>
            {porMod.map(({m,count,conc})=>{ const mc=MODAL_CODES[m]||{code:"???",color:C.faded}; const p=count?Math.round((conc/count)*100):0; return(<div key={m} style={{background:C.paperDark,border:`1px solid ${C.tape}`,borderTop:`3px solid ${mc.color}`,borderRadius:2,padding:"11px 13px"}}><div className="mono" style={{fontSize:8,fontWeight:700,color:mc.color,letterSpacing:".1em",marginBottom:4}}>{mc.code}</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:11,color:C.faded,marginBottom:5,lineHeight:1.3}}>{m}</div><div style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:"'Space Mono',monospace",lineHeight:1,marginBottom:5}}>{count}</div><ProgressBar p={p} color={mc.color} height={3}/><div className="mono" style={{fontSize:8,color:C.ghost,marginTop:3}}>{conc} CONC.</div></div>); })}
          </div>
        </div>
      )}
      {atencao.length>0&&(
        <div style={{marginBottom:28,border:`1px solid ${C.rust}44`,borderLeft:`3px solid ${C.rust}`,background:"#fdf5f3",padding:"12px 16px",borderRadius:2}}>
          <div className="mono" style={{fontSize:9,fontWeight:700,color:C.rust,letterSpacing:".1em",marginBottom:8}}>⚠ PRAZOS // PRÓXIMOS 7 DIAS</div>
          {atencao.map(p=>(
            <div key={p.id} onClick={()=>onAbrir(p.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"4px 0",borderBottom:`1px dashed ${C.rust}22`}}>
              <div><div style={{fontSize:12,fontWeight:600,color:C.ink,fontFamily:"'Lora',serif"}}>{p.nome}</div><div className="mono" style={{fontSize:9,color:C.rust}}>PRAZO: {fmtDate(p.data_prazo)}</div></div>
              <span className="mono" style={{fontSize:10,color:C.rust}}>→</span>
            </div>
          ))}
        </div>
      )}
      {recentes.length>0&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div className="mono" style={{fontSize:9,color:C.faded,letterSpacing:".12em"}}>ARQUIVOS RECENTES</div>
            <button onClick={onVerTodos} className="mono" style={{background:"none",border:"none",cursor:"pointer",color:C.terra,fontSize:9,fontWeight:700}}>VER TODOS →</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>{recentes.map((p,idx)=><FolderCard key={p.id} processo={p} onAbrir={onAbrir} onDelete={()=>{}} idx={idx} perfil="visualizador"/>)}</div>
        </div>
      )}
      {total===0&&<div style={{textAlign:"center",padding:"60px 20px",color:C.ghost}}><div className="mono" style={{fontSize:40,marginBottom:14,opacity:.3}}>⊡</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:C.faded,marginBottom:8}}>Nenhum arquivo registrado</div><div className="mono" style={{fontSize:10,letterSpacing:".08em"}}>// USE + NOVO PARA CRIAR O PRIMEIRO PROCESSO</div></div>}
    </div>
  );
}

// ─── Lista Processos ──────────────────────────────────────────────────────────
function ListaProcessos({processos,secretarias,onAbrir,onDelete,perfil}){
  const [filtro,setFiltro]=useState("Todas"); const [busca,setBusca]=useState(""); const [ordem,setOrdem]=useState("lancamento"); const [filtroStatus,setFiltroStatus]=useState("Todos"); const [showF,setShowF]=useState(false);
  const statusOpts=["Todos","Em andamento","Concluídos","Não iniciados"];
  const list=ordenar(processos.filter(p=>filtro==="Todas"||p.modalidade===filtro).filter(p=>filtroStatus==="Todos"||(filtroStatus==="Em andamento"&&isEmAndamento(p))||(filtroStatus==="Concluídos"&&isConcluido(p))||(filtroStatus==="Não iniciados"&&!isConcluido(p)&&!isEmAndamento(p))).filter(p=>p.nome.toLowerCase().includes(busca.toLowerCase())||(p.numero||"").includes(busca)),ordem);
  const filtrosAtivos=(filtro!=="Todas"?1:0)+(filtroStatus!=="Todos"?1:0);
  return(
    <div style={{maxWidth:920,margin:"0 auto",padding:"20px 16px 56px"}}>
      <div className="mono" style={{fontSize:9,color:C.ghost,letterSpacing:".12em",marginBottom:14}}>ARCHIVE INDEX // {processos.length} ARQUIVO{processos.length!==1?"S":""}</div>
      <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="buscar arquivo…" style={{flex:1,minWidth:140,border:`1px solid ${C.tape}`,borderRadius:2,padding:"7px 11px",fontSize:11,background:C.paper,outline:"none",fontFamily:"'Space Mono',monospace",color:C.ink}}/>
        <button onClick={()=>setShowF(v=>!v)} className="mono" style={{background:showF||filtrosAtivos>0?C.terra:C.paperDark,color:showF||filtrosAtivos>0?"white":C.faded,border:`1px solid ${showF||filtrosAtivos>0?C.terra:C.tape}`,borderRadius:2,padding:"7px 12px",fontSize:9,fontWeight:700,cursor:"pointer",letterSpacing:".08em"}}>⊟ FILTROS{filtrosAtivos>0?` (${filtrosAtivos})`:""}</button>
      </div>
      {showF&&(
        <div className="fade-up" style={{background:C.paperDark,border:`1px solid ${C.tape}`,borderRadius:2,padding:"12px 14px",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:10}}>
            {[{label:"ORDENAR POR",val:ordem,set:setOrdem,opts:ORDENACOES.map(o=>({v:o.key,l:o.label}))},{label:"MODALIDADE",val:filtro,set:setFiltro,opts:[{v:"Todas",l:"TODAS"},...MODALIDADES.map(m=>({v:m,l:m.toUpperCase()}))]},{label:"STATUS",val:filtroStatus,set:setFiltroStatus,opts:statusOpts.map(s=>({v:s,l:s.toUpperCase()}))}].map(f=>(
              <div key={f.label}><label className="lbl">{f.label}</label><select value={f.val} onChange={e=>f.set(e.target.value)} style={{width:"100%",border:`1px solid ${C.tape}`,borderRadius:2,padding:"6px 8px",fontSize:10,background:C.paper,fontFamily:"'Space Mono',monospace",color:C.ink}}>{f.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
            ))}
          </div>
          {(filtro!=="Todas"||filtroStatus!=="Todos"||ordem!=="lancamento")&&<button onClick={()=>{setFiltro("Todas");setFiltroStatus("Todos");setOrdem("lancamento");}} className="mono" style={{background:"none",border:"none",cursor:"pointer",color:C.rust,fontSize:9,marginTop:8,letterSpacing:".08em"}}>✕ LIMPAR</button>}
        </div>
      )}
      <div className="mono" style={{fontSize:9,color:C.ghost,marginBottom:8}}>{list.length} resultado{list.length!==1?"s":""} · {ORDENACOES.find(o=>o.key===ordem)?.label}</div>
      {list.length===0?<div className="mono" style={{textAlign:"center",padding:"40px",color:C.ghost,fontSize:10}}>// NENHUM ARQUIVO ENCONTRADO</div>:(
        <div style={{display:"flex",flexDirection:"column",gap:0}}>{list.map((p,idx)=><FolderCard key={p.id} processo={p} onAbrir={onAbrir} onDelete={onDelete} idx={idx} perfil={perfil}/>)}</div>
      )}
    </div>
  );
}

// ─── Agenda Pessoas ───────────────────────────────────────────────────────────
function AgendaPessoas({pessoas,onUpdate,perfil}){
  const [showForm,setShowForm]=useState(false); const [editId,setEditId]=useState(null);
  const blank={nome:"",cargo:"",orgao:"",email:"",telefone:"",obs:""};
  const [form,setForm]=useState(blank);
  const readonly=perfil==="visualizador";
  async function salvar(){ if(!form.nome.trim()) return; const p={...form,id:editId||mkId()}; await supa.upsertSecretaria({...p,tipo:"pessoa"}); onUpdate(); setForm(blank);setShowForm(false);setEditId(null); }
  function editar(p){ setForm({nome:p.nome,cargo:p.cargo||"",orgao:p.orgao||"",email:p.email||"",telefone:p.telefone||"",obs:p.obs||""}); setEditId(p.id); setShowForm(true); }
  async function excluir(id){ if(!confirm("Excluir esta pessoa?")) return; await supa.deleteSecretaria(id); onUpdate(); }
  const fS={width:"100%",border:`1px solid ${C.tape}`,borderRadius:2,padding:"7px 10px",fontSize:12,background:C.paper,outline:"none"}; const lS={display:"block",fontFamily:"'Space Mono',monospace",fontSize:9,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.faded,marginBottom:4};
  return(
    <div style={{maxWidth:860,margin:"0 auto",padding:"20px 16px 56px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div className="mono" style={{fontSize:9,color:C.ghost,letterSpacing:".12em"}}>PESSOAS // {pessoas.length}</div>
        {!readonly&&<button className="btn-primary" onClick={()=>{setForm(blank);setEditId(null);setShowForm(true);}}>+ NOVA</button>}
      </div>
      {showForm&&!readonly&&(
        <div className="fade-up" style={{background:C.paperDark,border:`1px solid ${C.tape}`,borderTop:`3px solid ${C.terra}`,borderRadius:2,padding:18,marginBottom:18,boxShadow:`3px 3px 0 ${C.tape}`}}>
          <div className="mono" style={{fontSize:9,fontWeight:700,color:C.faded,letterSpacing:".1em",marginBottom:14}}>{editId?"EDITAR":"NOVA PESSOA"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><label style={lS}>NOME *</label><input value={form.nome} onChange={e=>setForm(p=>({...p,nome:e.target.value}))} style={fS} autoFocus/></div>
            <div><label style={lS}>CARGO</label><input value={form.cargo} onChange={e=>setForm(p=>({...p,cargo:e.target.value}))} style={fS} placeholder="Ex: Prefeito, Agente de Contratação"/></div>
            <div><label style={lS}>ÓRGÃO</label><input value={form.orgao} onChange={e=>setForm(p=>({...p,orgao:e.target.value}))} style={fS} placeholder="Ex: Prefeitura, SEPLAGE"/></div>
            <div><label style={lS}>E-MAIL</label><input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} style={fS}/></div>
            <div><label style={lS}>TELEFONE</label><input value={form.telefone} onChange={e=>setForm(p=>({...p,telefone:e.target.value}))} style={fS}/></div>
            <div style={{gridColumn:"1/-1"}}><label style={lS}>OBSERVAÇÕES</label><textarea value={form.obs} onChange={e=>setForm(p=>({...p,obs:e.target.value}))} style={{...fS,resize:"vertical"}} rows={2}/></div>
          </div>
          <div style={{display:"flex",gap:7,justifyContent:"flex-end"}}><button className="btn-ghost" onClick={()=>{setShowForm(false);setEditId(null);}}>CANCELAR</button><button className="btn-primary" onClick={salvar}>{editId?"SALVAR":"CADASTRAR"}</button></div>
        </div>
      )}
      {pessoas.length===0&&!showForm?<div style={{textAlign:"center",padding:"50px 20px",color:C.ghost}}><div className="mono" style={{fontSize:9,letterSpacing:".1em"}}>// NENHUMA PESSOA CADASTRADA</div></div>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
          {pessoas.map(p=>(
            <div key={p.id} style={{background:C.paperDark,border:`1px solid ${C.tape}`,borderTop:`3px solid ${C.ochre}`,borderRadius:2,boxShadow:`2px 2px 0 ${C.tape}`}}>
              <div style={{padding:"12px 14px"}}>
                <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:"'Playfair Display',serif",lineHeight:1.3,marginBottom:4}}>{p.nome}</div>
                {p.cargo&&<div className="mono" style={{fontSize:9,color:C.terra,fontWeight:700,marginBottom:4}}>{p.cargo.toUpperCase()}</div>}
                {p.orgao&&<div className="mono" style={{fontSize:9,color:C.ghost,marginBottom:2}}>🏛 {p.orgao}</div>}
                {p.email&&<div className="mono" style={{fontSize:9,color:C.ghost,marginBottom:2}}>✉ {p.email}</div>}
                {p.telefone&&<div className="mono" style={{fontSize:9,color:C.ghost,marginBottom:2}}>📞 {p.telefone}</div>}
                {p.obs&&<div style={{fontSize:10,color:C.faded,fontStyle:"italic",marginTop:5,padding:"4px 7px",background:C.paper,borderLeft:`2px solid ${C.tape}`,fontFamily:"'Lora',serif"}}>{p.obs}</div>}
                {!readonly&&<div style={{display:"flex",gap:6,marginTop:9,justifyContent:"flex-end"}}><button className="btn-ghost btn-sm" onClick={()=>editar(p)}>EDITAR</button><button className="del-btn" onClick={()=>excluir(p.id)}>✕</button></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Agenda Secretarias ───────────────────────────────────────────────────────
function AgendaSecretarias({secretarias,onUpdate,perfil}){
  const [showForm,setShowForm]=useState(false); const [editId,setEditId]=useState(null);
  const blank={nome:"",secretario:"",email:"",telefone:"",possui_fundos:true,obs:""};
  const [form,setForm]=useState(blank);
  const readonly=perfil==="visualizador";
  async function salvar(){ if(!form.nome.trim()) return; const s={...form,id:editId||mkId()}; await supa.upsertSecretaria(s); onUpdate(); setForm(blank);setShowForm(false);setEditId(null); }
  function editar(s){ setForm({nome:s.nome,secretario:s.secretario||"",email:s.email||"",telefone:s.telefone||"",possui_fundos:s.possui_fundos??true,obs:s.obs||""}); setEditId(s.id); setShowForm(true); }
  async function excluir(id){ if(!confirm("Excluir esta secretaria?")) return; await supa.deleteSecretaria(id); onUpdate(); }
  const fS={width:"100%",border:`1px solid ${C.tape}`,borderRadius:2,padding:"7px 10px",fontSize:12,background:C.paper,outline:"none"}; const lS={display:"block",fontFamily:"'Space Mono',monospace",fontSize:9,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.faded,marginBottom:4};
  return(
    <div style={{maxWidth:860,margin:"0 auto",padding:"20px 16px 56px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div className="mono" style={{fontSize:9,color:C.ghost,letterSpacing:".12em"}}>SECRETARIAS // {secretarias.length}</div>
        {!readonly&&<button className="btn-primary" onClick={()=>{setForm(blank);setEditId(null);setShowForm(true);}}>+ NOVA</button>}
      </div>
      {showForm&&!readonly&&(
        <div className="fade-up" style={{background:C.paperDark,border:`1px solid ${C.tape}`,borderTop:`3px solid ${C.terra}`,borderRadius:2,padding:18,marginBottom:18,boxShadow:`3px 3px 0 ${C.tape}`}}>
          <div className="mono" style={{fontSize:9,fontWeight:700,color:C.faded,letterSpacing:".1em",marginBottom:14}}>{editId?"EDITAR":"NOVA SECRETARIA"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div style={{gridColumn:"1/-1"}}><label style={lS}>NOME *</label><input value={form.nome} onChange={e=>setForm(p=>({...p,nome:e.target.value}))} style={fS} autoFocus/></div>
            <div><label style={lS}>SECRETÁRIO(A)</label><input value={form.secretario} onChange={e=>setForm(p=>({...p,secretario:e.target.value}))} style={fS}/></div>
            <div><label style={lS}>E-MAIL</label><input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} style={fS}/></div>
            <div><label style={lS}>TELEFONE</label><input value={form.telefone} onChange={e=>setForm(p=>({...p,telefone:e.target.value}))} style={fS}/></div>
            <div style={{display:"flex",alignItems:"center",gap:10}}><label style={{...lS,marginBottom:0}}>FUNDOS?</label><button onClick={()=>setForm(p=>({...p,possui_fundos:!p.possui_fundos}))} className="mono" style={{background:form.possui_fundos?C.sage:C.rust,color:"white",border:"none",borderRadius:2,padding:"4px 12px",fontSize:9,cursor:"pointer",fontWeight:700}}>{form.possui_fundos?"SIM":"NÃO"}</button></div>
            <div style={{gridColumn:"1/-1"}}><label style={lS}>OBSERVAÇÕES</label><textarea value={form.obs} onChange={e=>setForm(p=>({...p,obs:e.target.value}))} style={{...fS,resize:"vertical"}} rows={2}/></div>
          </div>
          <div style={{display:"flex",gap:7,justifyContent:"flex-end"}}><button className="btn-ghost" onClick={()=>{setShowForm(false);setEditId(null);}}>CANCELAR</button><button className="btn-primary" onClick={salvar}>{editId?"SALVAR":"CADASTRAR"}</button></div>
        </div>
      )}
      {secretarias.length===0&&!showForm?<div style={{textAlign:"center",padding:"50px 20px",color:C.ghost}}><div className="mono" style={{fontSize:9,letterSpacing:".1em"}}>// NENHUMA SECRETARIA CADASTRADA</div></div>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
          {secretarias.map(s=>(
            <div key={s.id} style={{background:C.paperDark,border:`1px solid ${C.tape}`,borderTop:`3px solid ${C.faded}`,borderRadius:2,boxShadow:`2px 2px 0 ${C.tape}`}}>
              <div style={{padding:"12px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:7,marginBottom:7}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:"'Playfair Display',serif",lineHeight:1.3}}>{s.nome}</div>
                  <span className="mono" style={{fontSize:8,padding:"2px 6px",borderRadius:1,flexShrink:0,background:s.possui_fundos?'#deebd8':"#f0dcd8",color:s.possui_fundos?C.sage:C.rust,border:`1px solid ${s.possui_fundos?'#7aaa6a':"#c07060"}`}}>{s.possui_fundos?"✓ FUNDOS":"✗ SEM FUNDOS"}</span>
                </div>
                {s.secretario&&<div className="mono" style={{fontSize:9,color:C.ghost,marginBottom:2}}>👤 {s.secretario}</div>}
                {s.email&&<div className="mono" style={{fontSize:9,color:C.ghost,marginBottom:2}}>✉ {s.email}</div>}
                {s.telefone&&<div className="mono" style={{fontSize:9,color:C.ghost,marginBottom:2}}>📞 {s.telefone}</div>}
                {s.obs&&<div style={{fontSize:10,color:C.faded,fontStyle:"italic",marginTop:5,padding:"4px 7px",background:C.paper,borderLeft:`2px solid ${C.tape}`,fontFamily:"'Lora',serif"}}>{s.obs}</div>}
                {!readonly&&<div style={{display:"flex",gap:6,marginTop:9,justifyContent:"flex-end"}}><button className="btn-ghost btn-sm" onClick={()=>editar(s)}>EDITAR</button><button className="del-btn" onClick={()=>excluir(s.id)}>✕</button></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App(){
  const [user,setUser]=useState(null);
  const [perfil,setPerfil]=useState(null);
  const [perfis,setPerfis]=useState([]);
  const [processos,setProcessos]=useState([]);
  const [secretarias,setSecretarias]=useState([]);
  const [pessoas,setPessoas]=useState([]);
  const [dicasDB,setDicasDB]=useState([]);
  const [loading,setLoading]=useState(true);
  const [tela,setTela]=useState("dashboard");
  const [processoId,setProcessoId]=useState(null);
  const [showModal,setShowModal]=useState(false);
  const [showBusca,setShowBusca]=useState(false);
  const [showBuscaDicas,setShowBuscaDicas]=useState(false);
  const [showActions,setShowActions]=useState(false);
  const [toast,setToast]=useState(null);
  const [salvando,setSalvando]=useState(false);
  const fileRef=useRef();

  function showToast(msg){ setToast(msg); setTimeout(()=>setToast(null),3000); }

  useEffect(()=>{
    const link=document.createElement("link");link.rel="stylesheet";link.href=FONT_URL;document.head.appendChild(link);
    const style=document.createElement("style");style.textContent=STYLES;document.head.appendChild(style);
    const handler=e=>{if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();setShowBusca(true);}};
    window.addEventListener("keydown",handler);
    (async()=>{
      const u=await supa.restoreSession();
      if(u){ setUser(u); await carregarDados(u); }
      setLoading(false);
    })();
    return()=>window.removeEventListener("keydown",handler);
  },[]);

  async function carregarDados(u){
    try{
      const [p,s,pf,pfs,dc]=await Promise.all([supa.getProcessos(),supa.getSecretarias(),supa.getPerfil(u.id),supa.getPerfis(),supa.getDicas()]);
      setProcessos(p||[]); setSecretarias((s||[]).filter(x=>x.tipo!=="pessoa")); setPessoas((s||[]).filter(x=>x.tipo==="pessoa")); setPerfil(pf); setPerfis(pfs||[]); setDicasDB(dc||[]);
    }catch(e){ showToast("⚠ Erro ao carregar: "+e.message); }
  }

  async function handleLogin(u){ setUser(u); await carregarDados(u); }
  async function handleLogout(){ await supa.signOut(); setUser(null);setPerfil(null);setProcessos([]);setSecretarias([]);setTela("dashboard"); }

  function registrarHistorico(proc, descricao){
    const h={at:new Date().toISOString(),por:perfil?.nome||user?.email?.split("@")[0],desc:descricao};
    return {...proc,historico:[...(proc.historico||[]),h].slice(-50)};
  }

  function exportarProcesso(proc){
    const mc=MODALIDADE_CONFIG[proc.modalidade]||MODALIDADE_CONFIG["Concorrência"];
    const etapasConcluidas=proc.etapas.filter(e=>e.status==="concluída");
    const etapasPendentes=proc.etapas.filter(e=>e.status!=="concluída");
    const docsConcluidos=proc.docs.filter(d=>d.status==="entregue");
    const linhas=[
      "LICITAÇÕES -- LEI 14.133/2021",
      "RESUMO DO PROCESSO",
      "=".repeat(60),
      "",
      `OBJETO: ${proc.objeto||proc.nome}`,
      `MODALIDADE: ${proc.modalidade}`,
      proc.numero_licitacao?`Nº DA LICITAÇÃO: ${proc.numero_licitacao}`:"",
      proc.numero?`Nº DO PROCESSO: ${proc.numero}`:"",
      proc.data_inicio?`INÍCIO: ${proc.data_inicio}`:"",
      proc.data_prazo?`PRAZO: ${proc.data_prazo}`:"",
      proc.obs_geral?`
OBSERVAÇÕES: ${proc.obs_geral}`:"",
      "",
      "=".repeat(60),
      `PROGRESSO: ${etapasConcluidas.length}/${proc.etapas.length} etapas concluídas`,
      `DOCUMENTOS: ${docsConcluidos.length}/${proc.docs.length} entregues`,
      "",
      "ETAPAS CONCLUÍDAS:",
      ...etapasConcluidas.map(e=>`  ✓ ${e.nome}${e.dataEntrega?" ("+e.dataEntrega+")":""}`),
      "",
      "ETAPAS PENDENTES:",
      ...etapasPendentes.map(e=>`  ○ ${e.nome}${e.prazo?" -- prazo: "+e.prazo:""}`),
      "",
      "=".repeat(60),
      `Exportado em: ${new Date().toLocaleString("pt-BR")}`,
    ].filter(l=>l!==null);
    const blob=new Blob([linhas.join('\n')],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=`processo-${(proc.numero_licitacao||proc.numero||proc.id).replace(/[/]/g,'-')}.txt`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function salvarProcesso(p){
    if(perfil?.perfil==="visualizador") return;
    setSalvando(true);
    try{
      // Garante que criado_por está preenchido
      const payload={...p,criado_por:p.criado_por||user.id};
      await supa.upsertProcesso(payload);
      setProcessos(prev=>prev.some(x=>x.id===p.id)?prev.map(x=>x.id===p.id?p:x):[p,...prev]);
      showToast("✓ SALVO");
    }catch(e){ showToast("⚠ "+e.message); }
    setSalvando(false);
  }

  async function deletarProcesso(id){
    if(!confirm("Excluir este processo?")) return;
    try{ await supa.deleteProcesso(id); setProcessos(prev=>prev.filter(p=>p.id!==id)); showToast("✓ EXCLUÍDO"); }
    catch(e){ showToast("⚠ "+e.message); }
  }

  function abrirProcesso(id){ setProcessoId(id); setTela("processo"); }

  if(loading) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"'Space Mono',monospace",color:C.ghost,background:C.inkLight}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:9,letterSpacing:".2em",marginBottom:8,color:C.ghost}}>LICITAÇÕES // CARREGANDO…</div><div style={{width:120,height:2,background:"rgba(255,255,255,.1)",borderRadius:1,overflow:"hidden"}}><div style={{width:"70%",height:"100%",background:C.terra}}/></div></div>
    </div>
  );

  if(!user) return <TelaLogin onLogin={handleLogin}/>;

  const aberto=processoId?processos.find(p=>p.id===processoId):null;
  const podeEditar=perfil?.perfil==="admin"||perfil?.perfil==="editor";
  const isAdmin=perfil?.perfil==="admin";
  const NAV=[{key:"dashboard",label:"LOG"},{key:"processos",label:`ARQUIVOS (${processos.length})`},{key:"secretarias",label:"ÓRGÃOS"},{key:"pessoas",label:"PESSOAS"},...(isAdmin?[{key:"usuarios",label:"USUÁRIOS"},{key:"dicas",label:"DICAS"}]:[])];
  const BNAV=[{key:"dashboard",icon:"⊞",label:"LOG"},{key:"processos",icon:"⚖",label:"ARQUIVOS"},{key:"secretarias",icon:"🏛",label:"ÓRGÃOS"},{key:"pessoas",icon:"👤",label:"PESSOAS"},...(isAdmin?[{key:"usuarios",icon:"👥",label:"USUÁRIOS"},{key:"dicas",icon:"💡",label:"DICAS"}]:[])];

  return(
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <div className="brand-name">LICIT<span style={{color:C.ochreLight,fontStyle:"italic"}}>ações</span></div>
          <div className="brand-sub">LEI 14.133 // {perfil?.nome||user.email?.split("@")[0]} // {perfil?.perfil?.toUpperCase()}</div>
        </div>
        <nav className="topbar-nav">
          {NAV.map(n=>(
            <button key={n.key} className={`nav-btn${tela===n.key||(tela==="processo"&&n.key==="processos")?" active":""}`}
              onClick={()=>{ setTela(n.key); if(n.key!=="processos") setProcessoId(null); }}>
              {n.label}
            </button>
          ))}
          {tela==="processo"&&aberto&&<div style={{display:"flex",alignItems:"center",padding:"0 12px",borderLeft:`1px solid rgba(255,255,255,.08)`,color:"rgba(240,232,213,.3)",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:".06em",maxWidth:200,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>// {aberto.nome.toUpperCase().slice(0,24)}</div>}
        </nav>
        <div className="topbar-actions">
          <button onClick={()=>setShowBusca(true)}
            style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:3,
              padding:"5px 12px",cursor:"pointer",color:C.paper,fontFamily:"'Space Mono',monospace",
              fontSize:10,display:"flex",alignItems:"center",gap:6,letterSpacing:".06em"}}>
            ⌕ BUSCAR
          </button>
          <button onClick={()=>setShowBuscaDicas(true)} title="Buscar nas dicas"
            style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:3,
              padding:"5px 10px",cursor:"pointer",color:C.ochreLight,fontSize:12}}>
            💡
          </button>
          {salvando&&<span className="mono" style={{fontSize:8,color:C.ghost,padding:"0 4px"}}>SALVANDO…</span>}
          {(()=>{const urgentes=processos.filter(p=>{if(!p.data_prazo||isConcluido(p)) return false; const d=Math.ceil((new Date(p.data_prazo+"T12:00:00")-new Date())/(1000*60*60*24)); return d<=7;}); return urgentes.length>0?(<button onClick={()=>setTela("processos")} title={`${urgentes.length} processo(s) com prazo vencendo`} style={{background:C.rust,border:"none",borderRadius:"50%",width:20,height:20,color:"white",fontFamily:"'Space Mono',monospace",fontSize:9,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{urgentes.length}</button>):null;})()}
          {podeEditar&&<button className="btn-primary" onClick={()=>setShowModal(true)} style={{fontSize:11,padding:"8px 18px",letterSpacing:".12em"}}>+ NOVO</button>}
          <div style={{width:1,height:20,background:"rgba(255,255,255,.1)",margin:"0 2px"}}/>
          <button onClick={handleLogout}
            style={{background:"none",border:"1px solid rgba(255,255,255,.1)",borderRadius:3,padding:"5px 10px",
              cursor:"pointer",color:"rgba(240,232,213,.4)",fontFamily:"'Space Mono',monospace",fontSize:9,letterSpacing:".08em"}}>
            SAIR
          </button>
        </div>
        <div className="topbar-mobile-right">
          <button className="btn-icon" onClick={()=>setShowBusca(true)}>⌕</button>
          {podeEditar&&<button className="btn-primary" onClick={()=>setShowModal(true)} style={{fontSize:11,padding:"8px 18px",letterSpacing:".12em"}}>+ NOVO</button>}
          <button className="btn-icon" onClick={()=>setShowActions(v=>!v)}>⋯</button>
        </div>
      </div>

      {showActions&&(
        <div className="actions-sheet" onClick={()=>setShowActions(false)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{l:"⬇ PDF",a:()=>gerarPDF(processos)},{l:"SAIR",a:handleLogout}].map(b=>(
              <button key={b.l} onClick={b.a} className="mono" style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:2,padding:"10px 12px",color:"rgba(240,232,213,.8)",fontSize:9,cursor:"pointer",textAlign:"left",letterSpacing:".08em"}}>{b.l}</button>
            ))}
          </div>
        </div>
      )}

      <div className="main-content">
        {/* Sidebar  --  só visível no desktop via CSS */}
        <div className="side-panel">
          <div style={{padding:"12px 16px 14px",borderBottom:`1px solid ${C.tape}`,marginBottom:8}}>
            <div className="mono" style={{fontSize:8,color:C.ghost,letterSpacing:".1em",marginBottom:3}}>USUÁRIO</div>
            <div className="mono" style={{fontSize:11,color:C.ink,fontWeight:700,marginBottom:1}}>{perfil?.nome||user?.email?.split("@")[0]}</div>
            <div className="mono" style={{fontSize:8,color:C.terra,letterSpacing:".1em"}}>{perfil?.perfil?.toUpperCase()}</div>
          </div>
          {[
            {key:"dashboard",icon:"⊞",label:"LOG"},
            {key:"processos",icon:"⚖",label:`ARQUIVOS (${processos.length})`,...(processos.filter(p=>p.data_prazo&&!isConcluido(p)&&Math.ceil((new Date(p.data_prazo+"T12:00:00")-new Date())/(1000*60*60*24))<=7).length>0?{badge:processos.filter(p=>p.data_prazo&&!isConcluido(p)&&Math.ceil((new Date(p.data_prazo+"T12:00:00")-new Date())/(1000*60*60*24))<=7).length}:{})},
            {key:"secretarias",icon:"🏛",label:"ÓRGÃOS"},
            {key:"pessoas",icon:"👤",label:"PESSOAS"},
            ...(isAdmin?[{key:"usuarios",icon:"👥",label:"USUÁRIOS"}]:[]),
          ].map(n=>(
            <button key={n.key} className={`side-nav-btn${tela===n.key||(tela==="processo"&&n.key==="processos")?" active":""}`}
              onClick={()=>{ setTela(n.key); if(n.key!=="processos") setProcessoId(null); }}>
              <span className="side-nav-icon">{n.icon}</span>{n.label}
            </button>
          ))}
          {aberto&&(
            <button className={`side-nav-btn${tela==="processo"?" active":""}`} onClick={()=>setTela("processo")}
              style={{marginTop:8,borderTop:`1px dashed ${C.tape}`,paddingTop:12}}>
              <span className="side-nav-icon">📄</span>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{aberto.nome.slice(0,18)}</span>
            </button>
          )}
          <div style={{padding:"12px 14px",marginTop:"auto"}}>
            <button onClick={handleLogout} className="mono"
              style={{background:"none",border:`1px solid ${C.tape}`,borderRadius:2,padding:"6px 12px",fontSize:9,color:C.ghost,cursor:"pointer",width:"100%",letterSpacing:".08em"}}>
              SAIR
            </button>
          </div>
        </div>
        {/* Conteúdo principal */}
        <div style={{minWidth:0,overflow:"auto"}}>
          {tela==="dashboard"&&<Dashboard processos={processos} onAbrir={abrirProcesso} onVerTodos={()=>setTela("processos")}/>}
          {tela==="processos"&&<ListaProcessos processos={processos} secretarias={secretarias} onAbrir={abrirProcesso} onDelete={deletarProcesso} perfil={perfil?.perfil}/>}
          {tela==="secretarias"&&<AgendaSecretarias secretarias={secretarias} onUpdate={()=>supa.getSecretarias().then(s=>{setSecretarias((s||[]).filter(x=>x.tipo!=="pessoa"));setPessoas((s||[]).filter(x=>x.tipo==="pessoa"));})} perfil={perfil?.perfil}/>}
          {tela==="pessoas"&&<AgendaPessoas pessoas={pessoas} onUpdate={()=>supa.getSecretarias().then(s=>{setSecretarias((s||[]).filter(x=>x.tipo!=="pessoa"));setPessoas((s||[]).filter(x=>x.tipo==="pessoa"));})} perfil={perfil?.perfil}/>}
          {tela==="usuarios"&&isAdmin&&<GestaoUsuarios perfis={perfis} meuPerfil={perfil} onUpdate={()=>supa.getPerfis().then(p=>setPerfis(p||[]))}/>}
          {tela==="dicas"&&isAdmin&&<GestaoDicas dicasDB={dicasDB} perfil={perfil?.perfil} onUpdate={()=>supa.getDicas().then(d=>setDicasDB(d||[]))} processos={processos}/>}
          {tela==="processo"&&aberto&&(
            <TelaProcesso processo={aberto} secretarias={secretarias}
              onUpdate={ch=>{ const atualizado={...aberto,...ch}; setProcessos(prev=>prev.map(p=>p.id===aberto.id?atualizado:p)); salvarProcesso(atualizado); }}
              perfil={perfil?.perfil}/>
          )}
        </div>
      </div>

      <nav className="bottom-nav">
        {BNAV.map(n=>(
          <button key={n.key} className={`bnav-btn${tela===n.key||(tela==="processo"&&n.key==="processos")?" active":""}`}
            onClick={()=>{ setTela(n.key); if(n.key!=="processos") setProcessoId(null); }}>
            <span className="bi">{n.icon}</span>{n.label}
          </button>
        ))}
        <button className={`bnav-btn${tela==="processo"?" active":""}`} onClick={()=>{ if(aberto) setTela("processo"); }} style={{opacity:aberto?1:0.3}}>
          <span className="bi">📄</span>PROC.
        </button>
      </nav>

      {showModal&&podeEditar&&<ModalProcesso onSave={async p=>{ await salvarProcesso(p); setShowModal(false); }} onClose={()=>setShowModal(false)} userId={user.id}/>}
      {showBusca&&<BuscaGlobal processos={processos} secretarias={secretarias} pessoas={pessoas} onSelect={(id)=>{abrirProcesso(id);setShowBusca(false);}} onVerOrgao={()=>{setTela("secretarias");setShowBusca(false);}} onVerPessoa={()=>{setTela("pessoas");setShowBusca(false);}} onClose={()=>setShowBusca(false)}/>}
      {showBuscaDicas&&<BuscaDicas onClose={()=>setShowBuscaDicas(false)}/>}
      {toast&&<Toast msg={toast}/>}
    </div>
  );
}
