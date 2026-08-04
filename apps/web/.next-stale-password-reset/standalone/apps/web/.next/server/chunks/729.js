"use strict";exports.id=729,exports.ids=[729],exports.modules={3451:(e,t,a)=>{a.d(t,{L:()=>l});var o=a(9646);let i="https://pub-fd4eb9827712433599dec5fe1fef3fa5.r2.dev";function r(e,t){if(e)throw Error(`${t}: ${e.message}`)}async function n(e,t){let a=[];for(let o=0;;o+=1e3){let i=await e(o,o+1e3-1);r(i.error,t);let n=i.data??[];if(a.push(...n),n.length<1e3)return a}}async function s(e,t){let a=[];for(let e=0;e<t.length;e+=100)a.push(t.slice(e,e+100));return(await Promise.all(a.map(t=>n((a,o)=>e.from("verificacao_itens").select("id, verificacao_id, fvs_padrao_item_id, ordem, titulo, metodo_verif, tolerancia, resultado").in("verificacao_id",t).order("verificacao_id").order("ordem").range(a,o),"Falha ao carregar os itens da verifica\xe7\xe3o")))).flat()}async function l(e,t){let a=n((a,o)=>e.rpc("get_verificacoes_fvs",{p_fvs_id:t}).range(a,o),"Falha ao carregar as verifica\xe7\xf5es"),l=a.then(t=>{let a=t.map(e=>e.id);return a.length>0?s(e,a):Promise.resolve([])}),[c,d,p,f,g,m]=await Promise.all([e.rpc("get_fvs_header",{p_fvs_id:t}),a,n((a,o)=>e.rpc("get_fvs_attachments",{p_fvs_id:t}).range(a,o),"Falha ao carregar os anexos fotogr\xe1ficos"),n((a,o)=>e.rpc("get_ncs_fvs",{p_fvs_id:t}).range(a,o),"Falha ao carregar as n\xe3o conformidades"),e.from("fvs_conclusoes").select("numero_conclusao, percentual_final, resultado, observacao_final, assinatura_url, inspetor_id, created_at").eq("fvs_planejada_id",t).order("numero_conclusao",{ascending:!1}).limit(1),l]);r(c.error,"Falha ao carregar o cabe\xe7alho da FVS"),r(g.error,"Falha ao carregar a conclus\xe3o");let u=c.data?.[0];if(!u)return null;let v=[...d].reverse(),h=new Map;for(let e of p){let t=(0,o.Y2)(e.r2_key,i);if(!t)continue;let a=h.get(e.verificacao_id)??[];a.push({id:e.id,r2_url:t.url,ordem:e.ordem??0,kind:"nc"===e.kind||"reinspection"===e.kind?e.kind:"verification",label:e.label,availability:t.availability}),h.set(e.verificacao_id,a)}let x=new Map;for(let e of m){let t=x.get(e.verificacao_id)??[];t.push(e),x.set(e.verificacao_id,t)}return{header:u,verificacoes:v.map(e=>{var t;return{...e,assinatura_url:(t=e.assinatura_url)?t.startsWith("http")||t.startsWith("data:")?t:t.startsWith("pending:")||t.startsWith("blob:")?null:`${i}/${t}`:null,items:x.get(e.id)??[],fotos:h.get(e.id)??[]}}),ncs:f,conclusao:g.data?.[0]??null,emitidoEm:new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"America/Sao_Paulo"}).format(new Date)}}},3244:(e,t,a)=>{a.d(t,{e:()=>r});var o=a(6603),i=a(9362);async function r(){let e=await (0,i.cookies)();return(0,o.createServerClient)("https://xdeyoxdtfbueuymvbsbl.supabase.co","sb_publishable_f2BZJspm9XZyeXjhO_e51Q_iQb3iblG",{cookies:{getAll:()=>e.getAll(),setAll(t){try{t.forEach(({name:t,value:a,options:o})=>e.set(t,a,o))}catch(e){}}}})}},9646:(e,t,a)=>{function o(e){let t=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650"><rect width="100%" height="100%" fill="#F4F1E8"/><rect x="24" y="24" width="952" height="602" rx="18" fill="none" stroke="#C9D0CA" stroke-width="4" stroke-dasharray="14 10"/><text x="50%" y="47%" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="700" fill="#52615B">${"pending"===e?"Foto aguardando sincroniza\xe7\xe3o":"Imagem n\xe3o sincronizada"}</text><text x="50%" y="56%" text-anchor="middle" font-family="Arial, sans-serif" font-size="23" fill="#6E7A75">${"pending"===e?"Conecte o dispositivo e tente novamente":"A refer\xeancia local expirou e o arquivo n\xe3o foi enviado"}</text></svg>`;return`data:image/svg+xml;charset=utf-8,${encodeURIComponent(t)}`}function i(e,t){return e?e.startsWith("data:")||e.startsWith("http")?{url:e,availability:"available"}:e.startsWith("pending:")?{url:o("pending"),availability:"pending"}:e.startsWith("blob:")?{url:o("expired"),availability:"expired"}:{url:`${t.replace(/\/+$/,"")}/${e}`,availability:"available"}:null}a.d(t,{Wt:()=>f,Y2:()=>i});let r={pendente:"Pendente",em_andamento:"Em andamento",conforme:"Conforme",nao_conforme:"N\xe3o conforme",concluida:"Conclu\xedda",concluida_ressalva:"Conclu\xedda com ressalva",em_revisao:"Em revis\xe3o"};function n(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}function s(e){return e?new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo"}).format(new Date(10===e.length?`${e}T12:00:00-03:00`:e)):"—"}function l(e,t){return`<div class="info"><b>${n(e)}:</b> ${n(t||"—")}</div>`}function c(e,t=!1){var a;let{header:o}=e,i=`${o.ambiente_nome} (${"interno"===o.ambiente_tipo?"Interno":"Externo"}${o.ambiente_localizacao?` - ${o.ambiente_localizacao}`:""})`;return t?`
      <div class="compact-identity">
        <strong>${n(o.fvs_subservico)}</strong>
        <span>${n(o.obra_nome)} \xb7 ${n(i)}${o.fvs_revisao?` \xb7 Rev. ${n(o.fvs_revisao)}`:""}</span>
      </div>`:`
    <div class="brand-row">
      <div><div class="brand">PrumoQ</div><small>Qualidade em Obras</small></div>
      <div class="document-title"><strong>Ficha de Verifica\xe7\xe3o de Servi\xe7o</strong><small>Emitido em ${n(e.emitidoEm)}</small></div>
    </div>
    <div class="brand-rule"></div>
    <div class="grid neutral">
      ${l("Obra",o.obra_nome)}
      ${l("Empresa",o.empresa_nome)}
      ${l("Munic\xedpio/UF",[o.obra_municipio,o.obra_uf].filter(Boolean).join("/"))}
      ${l("Endere\xe7o",o.obra_endereco)}
      ${l("Engenheiro respons\xe1vel",o.obra_eng_responsavel)}
      ${l("CREA/CAU",o.obra_crea_cau)}
    </div>
    <div class="grid fvs">
      ${l("Servi\xe7o (FVS)",o.fvs_subservico)}
      ${l("Status",r[a=o.fvs_status]||a)}
      ${l("Ambiente",i)}
      ${l("Revis\xe3o",o.fvs_revisao?`Rev. ${o.fvs_revisao}`:"—")}
      ${o.fvs_concluida_em?l("Conclu\xedda em",s(o.fvs_concluida_em)):""}
    </div>`}function d(e){return e.label?e.label:"nc"===e.kind?"Evid\xeancia de n\xe3o conformidade":"reinspection"===e.kind?"Evid\xeancia de reinspe\xe7\xe3o":"Evid\xeancia da verifica\xe7\xe3o"}let p=`
  @page { size: A4 landscape; margin: 1.2cm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #142522; font-family: "IBM Plex Sans", Arial, Helvetica, sans-serif; font-size: 9px; }
  .report + .report { break-before: page; }
  .brand-row { display: flex; align-items: flex-start; justify-content: space-between; }
  .brand { color: #163B50; font-size: 22px; font-weight: 900; letter-spacing: -1px; }
  small { display: block; color: #6E7A75; margin-top: 2px; }
  .document-title { text-align: right; text-transform: uppercase; font-size: 12px; letter-spacing: .4px; }
  .document-title small { text-transform: none; font-size: 9px; font-weight: 400; }
  .brand-rule { border-top: 3px solid #D8E568; margin: 9px 0 10px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 18px; }
  .neutral, .fvs { border-radius: 7px; padding: 7px 10px; margin-bottom: 8px; }
  .neutral { background: #F4F1E8; }
  .fvs { background: #F3F7D5; border-left: 3px solid #163B50; }
  .info b { color: #6E7A75; font-size: 7px; letter-spacing: .3px; text-transform: uppercase; }
  .compact-identity { border-bottom: 2px solid #D8E568; display: flex; justify-content: space-between; gap: 18px; margin-bottom: 8px; padding-bottom: 6px; }
  .compact-identity strong { color: #163B50; font-size: 13px; }
  .compact-identity span { color: #52615B; }
  .matrix-sheet { break-after: page; page-break-after: always; }
  .section-heading { align-items: end; display: flex; justify-content: space-between; gap: 16px; margin: 8px 0 5px; }
  .section-heading > div:first-child { display: flex; align-items: baseline; gap: 8px; }
  .section-heading strong { color: #163B50; font-size: 11px; text-transform: uppercase; }
  .section-heading span { color: #6E7A75; font-size: 8px; }
  .legend { align-items: center; color: #52615B; display: flex; gap: 4px; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; font-size: 7px; }
  thead { display: table-header-group; }
  .matrix tr { break-inside: avoid; page-break-inside: avoid; }
  th { background: #E4E7E1; color: #52615B; font-size: 6.6px; letter-spacing: .2px; padding: 3px 4px; text-align: left; text-transform: uppercase; }
  td { border-top: 1px solid #E4E7E1; line-height: 1.25; padding: 3px 4px; vertical-align: top; overflow-wrap: anywhere; }
  tbody tr:nth-child(even) { background: #FAFAF8; }
  .matrix { table-layout: fixed; }
  .col-order { width: 8mm; }
  .col-item { width: 50mm; }
  .col-method { width: 80mm; }
  .col-tolerance { width: 30mm; }
  .order { color: #6E7A75; text-align: center; }
  .item-title { font-weight: 600; }
  .verification-column { background: #163B50; color: #fff; text-align: center; }
  .verification-column strong, .verification-column span { color: inherit; display: block; font-size: 7px; line-height: 1.35; }
  .verification-column strong { font-size: 8px; }
  .verification-placeholder { background: #F4F1E8; border-color: #E4E7E1; }
  .result-cell { text-align: center; vertical-align: middle; }
  .result { align-items: center; border: 1px solid transparent; border-radius: 3px; display: inline-flex; font-size: 7px; font-weight: 800; justify-content: center; min-height: 15px; min-width: 21px; padding: 1px 3px; }
  .result-ok { background: #E8F4EC; border-color: #B9D9C4; color: #2D7A4B; }
  .result-nok { background: #FAEAEA; border-color: #E9BDBD; color: #B23A3A; }
  .result-na { background: #EEF0EC; border-color: #D8DDD7; color: #52615B; }
  .result-empty { color: #9C9A93; }
  .details { break-before: page; break-after: page; page-break-before: always; page-break-after: always; }
  .verification-detail { border: 1px solid #D9DDD9; border-radius: 7px; break-inside: auto; box-decoration-break: clone; -webkit-box-decoration-break: clone; margin: 0 0 10px; overflow: visible; page-break-inside: auto; }
  .verification-detail > header { background: #163B50; color: #fff; display: flex; justify-content: space-between; gap: 12px; padding: 6px 10px; break-after: avoid-page; page-break-after: avoid; }
  .verification-detail-body { break-inside: auto; page-break-inside: auto; padding: 7px 10px 9px; }
  .note { background: #F4F1E8; border-left: 3px solid #6E7A75; border-radius: 4px; margin: 0 0 7px; padding: 5px 7px; }
  .muted-note { color: #6E7A75; }
  h3 { color: #52615B; font-size: 8px; letter-spacing: .4px; margin: 7px 0 4px; text-transform: uppercase; break-after: avoid; }
  .nc { break-inside: auto; margin-bottom: 7px; page-break-inside: auto; }
  .nc th { background: #FAEAEA; color: #B23A3A; }
  .nc tbody tr { break-inside: auto; page-break-inside: auto; }
  .photo-annex-page { break-after: page; page-break-after: always; }
  .attachment-heading { margin-bottom: 8px; }
  .photos { display: grid; gap: 7px; grid-template-columns: repeat(3, 1fr); }
  figure { border: 1px solid #D9DDD9; border-radius: 5px; break-inside: avoid; margin: 0; overflow: hidden; }
  .photo-frame { align-items: center; background: #F4F1E8; display: flex; height: 62mm; justify-content: center; padding: 4px; }
  figure img { display: block; height: 100%; max-width: 100%; object-fit: contain; width: 100%; }
  figcaption { align-items: center; background: #F4F1E8; color: #52615B; display: flex; font-size: 7px; justify-content: space-between; min-height: 8mm; padding: 4px 6px; }
  figcaption strong { color: #163B50; }
  figcaption div { display: flex; flex-direction: column; gap: 2px; }
  figcaption em { color: #B23A3A; font-size: 6.5px; font-style: normal; font-weight: 600; }
  .photo-unavailable { border-color: #E9BDBD; }
  .signature { border-top: 1px solid #E4E7E1; display: flex; align-items: end; gap: 10px; margin-top: 7px; padding-top: 6px; break-inside: avoid; }
  .signature img { background: white; border: 1px solid #D9DDD9; max-height: 50px; max-width: 160px; object-fit: contain; }
  .conclusion { background: #E8F4EC; border: 1px solid #B9D9C4; border-radius: 7px; color: #2D7A4B; margin-top: 10px; padding: 7px 10px; break-inside: avoid; }
  .conclusion .grid { color: #142522; margin-top: 5px; }
  .empty { color: #6E7A75; padding: 24px 0; text-align: center; }
  .report > :last-child { break-after: auto; page-break-after: auto; }
  @media print {
    html, body, #root {
      display: block !important;
      flex: none !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      position: static !important;
    }
    #root > *, .report-preview, .report, .details {
      height: auto !important;
      max-height: none !important;
      min-height: 0 !important;
      overflow: visible !important;
    }
    .report-preview {
      box-shadow: none !important;
      max-width: none !important;
    }
  }
`;function f(e,t={}){return`<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>${p}</style>
    </head>
    <body>${e.map(e=>(function(e,t={}){let a=t.includeAttachments??!0,o=function(e,t=4){if(!Number.isInteger(t)||t<1)throw Error("verificationsPerPage deve ser um inteiro maior que zero.");let a=new Map;for(let t of e)for(let e of t.items){let o=e.fvs_padrao_item_id?`item:${e.fvs_padrao_item_id}`:`legacy:${e.ordem}:${e.titulo.trim().toLocaleLowerCase("pt-BR")}`,i=a.get(o)??{key:o,ordem:e.ordem,titulo:e.titulo,metodo_verif:e.metodo_verif,tolerancia:e.tolerancia,resultados:{}};i.ordem=e.ordem,i.titulo=e.titulo||i.titulo,i.metodo_verif=e.metodo_verif||i.metodo_verif,i.tolerancia=e.tolerancia||i.tolerancia,i.resultados[t.id]=e.resultado,a.set(o,i)}let o=[];for(let a=0;a<e.length;a+=t)o.push(e.slice(a,a+t));return{rows:Array.from(a.values()).sort((e,t)=>e.ordem-t.ordem||e.titulo.localeCompare(t.titulo,"pt-BR")),verificationGroups:o}}(e.verificacoes),i=new Map;for(let t of e.ncs){let e=i.get(t.verificacao_id)??[];e.push(t),i.set(t.verificacao_id,e)}let p=[];for(let e=0;e<o.rows.length;e+=14)p.push(o.rows.slice(e,e+14));p.length||p.push([]);let f=o.verificationGroups.length?o.verificationGroups.flatMap((t,a)=>p.map((i,l)=>(function(e,t,a,o,i,l,d){let p=4*o+1,f=p+a.length-1,g=4-a.length,m=0===o&&0===i,u=m?"":c(e,!0),v=14*i+1,h=v+t.length-1,x=l>1?` \xb7 Itens ${v}-${h} de ${d}`:"",b=a.map(e=>{var t;return`
        <th class="verification-column">
          <strong>V. ${e.numero_verif}</strong>
          <span>${n(s(e.data_verif))}</span>
          <span>${n(r[t=e.status]||t)}</span>
        </th>`}).join(""),_=Array.from({length:g},()=>'<th class="verification-column verification-placeholder"></th>').join(""),$=Array.from({length:g},()=>'<td class="result-cell verification-placeholder"></td>').join(""),y=t.map(e=>`
        <tr>
          <td class="order">${e.ordem}</td>
          <td class="item-title">${n(e.titulo)}</td>
          <td>${n(e.metodo_verif||"—")}</td>
          <td>${n(e.tolerancia||"—")}</td>
          ${a.map(t=>{var a;return`<td class="result-cell">${"conforme"===(a=e.resultados[t.id])?'<span class="result result-ok" aria-label="Conforme">C</span>':"nao_conforme"===a?'<span class="result result-nok" aria-label="N\xe3o conforme">NC</span>':"na"===a?'<span class="result result-na" aria-label="N\xe3o aplic\xe1vel">N/A</span>':'<span class="result result-empty" aria-label="N\xe3o registrado">—</span>'}</td>`}).join("")}
          ${$}
        </tr>`).join("");return`
    <section class="matrix-sheet${m?"":" matrix-continuation"}">
      ${u}
      <div class="section-heading">
        <div><strong>Matriz de verifica\xe7\xf5es</strong><span>Verifica\xe7\xf5es ${p}-${f} de ${e.verificacoes.length}${x}</span></div>
        <div class="legend"><span class="result result-ok">C</span> Conforme <span class="result result-nok">NC</span> N\xe3o conforme <span class="result result-na">N/A</span> N\xe3o aplic\xe1vel</div>
      </div>
      <table class="matrix">
        <colgroup>
          <col class="col-order">
          <col class="col-item">
          <col class="col-method">
          <col class="col-tolerance">
          ${a.map(()=>'<col class="col-verification">').join("")}
          ${Array.from({length:g},()=>'<col class="col-verification">').join("")}
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Item de verifica\xe7\xe3o</th>
            <th>M\xe9todo</th>
            <th>Toler\xe2ncia</th>
            ${b}
            ${_}
          </tr>
        </thead>
        <tbody>${y}</tbody>
      </table>
    </section>`})(e,i,t,a,l,p.length,o.rows.length))).join(""):'<p class="empty">Nenhuma verifica\xe7\xe3o registrada para esta FVS no per\xedodo selecionado.</p>',g=e.verificacoes.length||e.conclusao?`
      <section class="details">
        <div class="compact-identity">
          <strong>Registros complementares</strong>
          <span>${n(e.header.fvs_subservico)} \xb7 ${e.verificacoes.length} registro(s)</span>
        </div>
        ${e.verificacoes.map(e=>(function(e,t){var a;let o=t.map(e=>{var t;return`
        <tr>
          <td>${n(e.item_titulo)}</td>
          <td>${n(e.descricao)}</td>
          <td>${n(e.solucao_proposta||"—")}</td>
          <td>${n(s(e.data_nova_verif))}</td>
          <td>${n(e.responsavel_nome||"—")}</td>
          <td>${n(r[t=e.status]||t)}</td>
        </tr>`}).join("");return`
    <section class="verification-detail">
      <header>
        <strong>Verifica\xe7\xe3o #${e.numero_verif} - ${n(s(e.data_verif))}</strong>
        <span>${n(e.inspetor_nome||"—")} \xb7 ${n(r[a=e.status]||a)}</span>
      </header>
      <div class="verification-detail-body">
        ${e.observacoes?`<p class="note"><strong>Observa\xe7\xf5es:</strong> ${n(e.observacoes)}</p>`:'<p class="note muted-note">Sem observa\xe7\xf5es registradas.</p>'}
        ${o?`<h3>N\xe3o conformidades (${t.length})</h3><table class="nc"><thead><tr><th>Item</th><th>Descri\xe7\xe3o</th><th>Solu\xe7\xe3o</th><th>Prazo</th><th>Respons\xe1vel</th><th>Status</th></tr></thead><tbody>${o}</tbody></table>`:""}
        ${e.assinatura_url?`<div class="signature"><strong>Assinatura digital</strong><img data-pdf-kind="signature" loading="eager" decoding="async" src="${n(e.assinatura_url)}" alt="Assinatura"><span>${n(e.inspetor_nome||"")}</span></div>`:""}
      </div>
    </section>`})(e,i.get(e.id)??[])).join("")}
        ${e.conclusao?`<section class="conclusion"><strong>Conclus\xe3o da FVS</strong><div class="grid">${l("Resultado","aprovado"===e.conclusao.resultado?"Aprovado":"Com ressalva")}${e.conclusao.observacao_final?l("Observa\xe7\xe3o",e.conclusao.observacao_final):""}</div></section>`:""}
      </section>`:"",m=a?e.verificacoes.filter(e=>e.fotos.length>0).map(t=>(function(e,t){let a=[];for(let e=0;e<t.fotos.length;e+=6)a.push(t.fotos.slice(e,e+6));return a.map((o,i)=>{let r=o.map((e,a)=>{let o="pending"===e.availability?"Foto aguardando sincroniza\xe7\xe3o":"expired"===e.availability?"Imagem n\xe3o sincronizada - refer\xeancia local expirada":"";return`
            <figure${o?' class="photo-unavailable"':""}>
              <div class="photo-frame">
                <img data-pdf-kind="photo" loading="eager" decoding="async" src="${n(e.r2_url)}" alt="${n(d(e))}">
              </div>
              <figcaption>
                <div>
                  <strong>${n(d(e))}</strong>
                  ${o?`<em>${n(o)}</em>`:""}
                </div>
                <span>Foto ${6*i+a+1} de ${t.fotos.length}</span>
              </figcaption>
            </figure>`}).join("");return`
        <section class="photo-annex-page">
          ${c(e,!0)}
          <div class="section-heading attachment-heading">
            <div><strong>Anexos fotogr\xe1ficos</strong><span>Verifica\xe7\xe3o #${t.numero_verif} \xb7 ${n(s(t.data_verif))}</span></div>
            <span>P\xe1gina ${i+1} de ${a.length}</span>
          </div>
          <div class="photos">${r}</div>
        </section>`}).join("")})(e,t)).join(""):"";return`
    <article class="report">
      ${c(e)}
      ${f}
      ${g}
      ${m}
    </article>`})(e,t)).join("")}</body>
  </html>`}}};