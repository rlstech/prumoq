(()=>{var e={};e.id=163,e.ids=[163],e.modules={2934:e=>{"use strict";e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},5315:e=>{"use strict";e.exports=require("path")},7360:e=>{"use strict";e.exports=require("url")},2051:(e,t,r)=>{"use strict";r.r(t),r.d(t,{GlobalError:()=>n.a,__next_app__:()=>u,originalPathname:()=>p,pages:()=>c,routeModule:()=>f,tree:()=>d}),r(3202),r(2567),r(7824);var o=r(3282),a=r(5736),i=r(3906),n=r.n(i),s=r(6880),l={};for(let e in s)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(l[e]=()=>s[e]);r.d(t,l);let d=["",{children:["relatorio",{children:["fvs",{children:["[fvsId]",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(r.bind(r,3202)),"C:\\Code\\prumoq\\apps\\web\\app\\relatorio\\fvs\\[fvsId]\\page.tsx"]}]},{}]},{}]},{metadata:{icon:[async e=>(await Promise.resolve().then(r.bind(r,1026))).default(e)],apple:[],openGraph:[],twitter:[],manifest:void 0}}]},{layout:[()=>Promise.resolve().then(r.bind(r,2567)),"C:\\Code\\prumoq\\apps\\web\\app\\layout.tsx"],"not-found":[()=>Promise.resolve().then(r.t.bind(r,7824,23)),"next/dist/client/components/not-found-error"],metadata:{icon:[async e=>(await Promise.resolve().then(r.bind(r,1026))).default(e)],apple:[],openGraph:[],twitter:[],manifest:void 0}}],c=["C:\\Code\\prumoq\\apps\\web\\app\\relatorio\\fvs\\[fvsId]\\page.tsx"],p="/relatorio/fvs/[fvsId]/page",u={require:r,loadChunk:()=>Promise.resolve()},f=new o.AppPageRouteModule({definition:{kind:a.x.APP_PAGE,page:"/relatorio/fvs/[fvsId]/page",pathname:"/relatorio/fvs/[fvsId]",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:d}})},7443:()=>{},6876:(e,t,r)=>{Promise.resolve().then(r.bind(r,2416))},4265:(e,t,r)=>{Promise.resolve().then(r.t.bind(r,4424,23)),Promise.resolve().then(r.t.bind(r,7752,23)),Promise.resolve().then(r.t.bind(r,5275,23)),Promise.resolve().then(r.t.bind(r,9842,23)),Promise.resolve().then(r.t.bind(r,1633,23)),Promise.resolve().then(r.t.bind(r,9224,23))},2416:(e,t,r)=>{"use strict";r.d(t,{default:()=>u});var o=r(3227),a=r(3677);let i={pendente:"Pendente",em_andamento:"Em andamento",conforme:"Conforme",nao_conforme:"N\xe3o conforme",concluida:"Conclu\xedda",concluida_ressalva:"Conclu\xedda com ressalva",em_revisao:"Em revis\xe3o"};function n(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}function s(e){return e?new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo"}).format(new Date(10===e.length?`${e}T12:00:00-03:00`:e)):"—"}function l(e,t){return`<div class="info"><b>${n(e)}:</b> ${n(t||"—")}</div>`}function d(e,t=!1){var r;let{header:o}=e,a=`${o.ambiente_nome} (${"interno"===o.ambiente_tipo?"Interno":"Externo"}${o.ambiente_localizacao?` - ${o.ambiente_localizacao}`:""})`;return t?`
      <div class="compact-identity">
        <strong>${n(o.fvs_subservico)}</strong>
        <span>${n(o.obra_nome)} \xb7 ${n(a)}${o.fvs_revisao?` \xb7 Rev. ${n(o.fvs_revisao)}`:""}</span>
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
      ${l("Status",i[r=o.fvs_status]||r)}
      ${l("Ambiente",a)}
      ${l("Revis\xe3o",o.fvs_revisao?`Rev. ${o.fvs_revisao}`:"—")}
      ${o.fvs_concluida_em?l("Conclu\xedda em",s(o.fvs_concluida_em)):""}
    </div>`}function c(e){return e.label?e.label:"nc"===e.kind?"Evid\xeancia de n\xe3o conformidade":"reinspection"===e.kind?"Evid\xeancia de reinspe\xe7\xe3o":"Evid\xeancia da verifica\xe7\xe3o"}let p=`
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
`;function u({fvsId:e,header:t,verificacoes:r,ncs:u,conclusao:f,emitidoEm:m,initialIncludeAttachments:g}){let[v,b]=(0,a.useState)(g),[x,h]=(0,a.useState)(!1),[y,_]=(0,a.useState)(""),$=function(e,t={}){let r=t.includeAttachments??!0,o=function(e,t=4){if(!Number.isInteger(t)||t<1)throw Error("verificationsPerPage deve ser um inteiro maior que zero.");let r=new Map;for(let t of e)for(let e of t.items){let o=e.fvs_padrao_item_id?`item:${e.fvs_padrao_item_id}`:`legacy:${e.ordem}:${e.titulo.trim().toLocaleLowerCase("pt-BR")}`,a=r.get(o)??{key:o,ordem:e.ordem,titulo:e.titulo,metodo_verif:e.metodo_verif,tolerancia:e.tolerancia,resultados:{}};a.ordem=e.ordem,a.titulo=e.titulo||a.titulo,a.metodo_verif=e.metodo_verif||a.metodo_verif,a.tolerancia=e.tolerancia||a.tolerancia,a.resultados[t.id]=e.resultado,r.set(o,a)}let o=[];for(let r=0;r<e.length;r+=t)o.push(e.slice(r,r+t));return{rows:Array.from(r.values()).sort((e,t)=>e.ordem-t.ordem||e.titulo.localeCompare(t.titulo,"pt-BR")),verificationGroups:o}}(e.verificacoes),a=new Map;for(let t of e.ncs){let e=a.get(t.verificacao_id)??[];e.push(t),a.set(t.verificacao_id,e)}let p=[];for(let e=0;e<o.rows.length;e+=14)p.push(o.rows.slice(e,e+14));p.length||p.push([]);let u=o.verificationGroups.length?o.verificationGroups.flatMap((t,r)=>p.map((a,l)=>(function(e,t,r,o,a,l,c){let p=4*o+1,u=p+r.length-1,f=4-r.length,m=0===o&&0===a,g=m?"":d(e,!0),v=14*a+1,b=v+t.length-1,x=l>1?` \xb7 Itens ${v}-${b} de ${c}`:"",h=r.map(e=>{var t;return`
        <th class="verification-column">
          <strong>V. ${e.numero_verif}</strong>
          <span>${n(s(e.data_verif))}</span>
          <span>${n(i[t=e.status]||t)}</span>
        </th>`}).join(""),y=Array.from({length:f},()=>'<th class="verification-column verification-placeholder"></th>').join(""),_=Array.from({length:f},()=>'<td class="result-cell verification-placeholder"></td>').join(""),$=t.map(e=>`
        <tr>
          <td class="order">${e.ordem}</td>
          <td class="item-title">${n(e.titulo)}</td>
          <td>${n(e.metodo_verif||"—")}</td>
          <td>${n(e.tolerancia||"—")}</td>
          ${r.map(t=>{var r;return`<td class="result-cell">${"conforme"===(r=e.resultados[t.id])?'<span class="result result-ok" aria-label="Conforme">C</span>':"nao_conforme"===r?'<span class="result result-nok" aria-label="N\xe3o conforme">NC</span>':"na"===r?'<span class="result result-na" aria-label="N\xe3o aplic\xe1vel">N/A</span>':'<span class="result result-empty" aria-label="N\xe3o registrado">—</span>'}</td>`}).join("")}
          ${_}
        </tr>`).join("");return`
    <section class="matrix-sheet${m?"":" matrix-continuation"}">
      ${g}
      <div class="section-heading">
        <div><strong>Matriz de verifica\xe7\xf5es</strong><span>Verifica\xe7\xf5es ${p}-${u} de ${e.verificacoes.length}${x}</span></div>
        <div class="legend"><span class="result result-ok">C</span> Conforme <span class="result result-nok">NC</span> N\xe3o conforme <span class="result result-na">N/A</span> N\xe3o aplic\xe1vel</div>
      </div>
      <table class="matrix">
        <colgroup>
          <col class="col-order">
          <col class="col-item">
          <col class="col-method">
          <col class="col-tolerance">
          ${r.map(()=>'<col class="col-verification">').join("")}
          ${Array.from({length:f},()=>'<col class="col-verification">').join("")}
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Item de verifica\xe7\xe3o</th>
            <th>M\xe9todo</th>
            <th>Toler\xe2ncia</th>
            ${h}
            ${y}
          </tr>
        </thead>
        <tbody>${$}</tbody>
      </table>
    </section>`})(e,a,t,r,l,p.length,o.rows.length))).join(""):'<p class="empty">Nenhuma verifica\xe7\xe3o registrada para esta FVS no per\xedodo selecionado.</p>',f=e.verificacoes.length||e.conclusao?`
      <section class="details">
        <div class="compact-identity">
          <strong>Registros complementares</strong>
          <span>${n(e.header.fvs_subservico)} \xb7 ${e.verificacoes.length} registro(s)</span>
        </div>
        ${e.verificacoes.map(e=>(function(e,t){var r;let o=t.map(e=>{var t;return`
        <tr>
          <td>${n(e.item_titulo)}</td>
          <td>${n(e.descricao)}</td>
          <td>${n(e.solucao_proposta||"—")}</td>
          <td>${n(s(e.data_nova_verif))}</td>
          <td>${n(e.responsavel_nome||"—")}</td>
          <td>${n(i[t=e.status]||t)}</td>
        </tr>`}).join("");return`
    <section class="verification-detail">
      <header>
        <strong>Verifica\xe7\xe3o #${e.numero_verif} - ${n(s(e.data_verif))}</strong>
        <span>${n(e.inspetor_nome||"—")} \xb7 ${n(i[r=e.status]||r)}</span>
      </header>
      <div class="verification-detail-body">
        ${e.observacoes?`<p class="note"><strong>Observa\xe7\xf5es:</strong> ${n(e.observacoes)}</p>`:'<p class="note muted-note">Sem observa\xe7\xf5es registradas.</p>'}
        ${o?`<h3>N\xe3o conformidades (${t.length})</h3><table class="nc"><thead><tr><th>Item</th><th>Descri\xe7\xe3o</th><th>Solu\xe7\xe3o</th><th>Prazo</th><th>Respons\xe1vel</th><th>Status</th></tr></thead><tbody>${o}</tbody></table>`:""}
        ${e.assinatura_url?`<div class="signature"><strong>Assinatura digital</strong><img data-pdf-kind="signature" loading="eager" decoding="async" src="${n(e.assinatura_url)}" alt="Assinatura"><span>${n(e.inspetor_nome||"")}</span></div>`:""}
      </div>
    </section>`})(e,a.get(e.id)??[])).join("")}
        ${e.conclusao?`<section class="conclusion"><strong>Conclus\xe3o da FVS</strong><div class="grid">${l("Resultado","aprovado"===e.conclusao.resultado?"Aprovado":"Com ressalva")}${e.conclusao.observacao_final?l("Observa\xe7\xe3o",e.conclusao.observacao_final):""}</div></section>`:""}
      </section>`:"",m=r?e.verificacoes.filter(e=>e.fotos.length>0).map(t=>(function(e,t){let r=[];for(let e=0;e<t.fotos.length;e+=6)r.push(t.fotos.slice(e,e+6));return r.map((o,a)=>{let i=o.map((e,r)=>{let o="pending"===e.availability?"Foto aguardando sincroniza\xe7\xe3o":"expired"===e.availability?"Imagem n\xe3o sincronizada - refer\xeancia local expirada":"";return`
            <figure${o?' class="photo-unavailable"':""}>
              <div class="photo-frame">
                <img data-pdf-kind="photo" loading="eager" decoding="async" src="${n(e.r2_url)}" alt="${n(c(e))}">
              </div>
              <figcaption>
                <div>
                  <strong>${n(c(e))}</strong>
                  ${o?`<em>${n(o)}</em>`:""}
                </div>
                <span>Foto ${6*a+r+1} de ${t.fotos.length}</span>
              </figcaption>
            </figure>`}).join("");return`
        <section class="photo-annex-page">
          ${d(e,!0)}
          <div class="section-heading attachment-heading">
            <div><strong>Anexos fotogr\xe1ficos</strong><span>Verifica\xe7\xe3o #${t.numero_verif} \xb7 ${n(s(t.data_verif))}</span></div>
            <span>P\xe1gina ${a+1} de ${r.length}</span>
          </div>
          <div class="photos">${i}</div>
        </section>`}).join("")})(e,t)).join(""):"";return`
    <article class="report">
      ${d(e)}
      ${u}
      ${f}
      ${m}
    </article>`}({header:t,verificacoes:r,ncs:u,conclusao:f,emitidoEm:m},{includeAttachments:v}),w=r.reduce((e,t)=>e+t.fotos.length,0);async function k(){h(!0),_("");try{let t=await fetch(`/admin/relatorio/fvs/${e}/pdf?attachments=${v?"1":"0"}`);if(!t.ok){let e=await t.json().catch(()=>null);throw Error(e?.error||"N\xe3o foi poss\xedvel gerar o PDF.")}let r=await t.blob(),o=URL.createObjectURL(r),a=document.createElement("a");a.href=o,a.download=`fvs-${e}.pdf`,a.click(),URL.revokeObjectURL(o)}catch(e){_(e instanceof Error?e.message:"N\xe3o foi poss\xedvel gerar o PDF.")}finally{h(!1)}}return(0,o.jsxs)(o.Fragment,{children:[o.jsx("style",{children:`
        ${p}
        .no-print { display: flex; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white; }
        }
        @media screen {
          body { background: #F4F1E8; padding: 32px 16px 64px; }
          .report-preview {
            background: white;
            max-width: 1123px;
            margin: 0 auto;
            box-shadow: 0 4px 32px rgba(20, 37, 34, 0.10);
            border-radius: 8px;
          }
          .report-preview .report { padding: 36px 42px; }
        }
      `}),(0,o.jsxs)("div",{className:"no-print",style:{position:"fixed",top:16,right:16,zIndex:999,gap:8,alignItems:"center",background:"white",border:"1px solid #D9DDD9",borderRadius:8,boxShadow:"0 6px 24px rgba(20, 37, 34, 0.14)",padding:8},children:[(0,o.jsxs)("label",{style:{alignItems:"center",display:"flex",gap:7,padding:"0 8px",fontSize:13},children:[o.jsx("input",{type:"checkbox",checked:v,onChange:e=>b(e.target.checked)}),"Incluir anexos (",w,")"]}),o.jsx("button",{onClick:k,disabled:x,style:{background:"#163B50",color:"white",border:"none",padding:"9px 18px",borderRadius:6,fontWeight:600,cursor:x?"wait":"pointer",fontSize:13,opacity:x?.65:1},children:x?"Gerando PDF...":"Baixar PDF"}),o.jsx("button",{onClick:()=>window.close(),style:{background:"#F4F1E8",color:"#142522",border:"1px solid #C9D0CA",padding:"9px 14px",borderRadius:6,cursor:"pointer",fontSize:13},children:"Fechar"}),y&&o.jsx("span",{style:{color:"#B23A3A",fontSize:12},children:y})]}),o.jsx("div",{className:"report-preview",dangerouslySetInnerHTML:{__html:$}})]})}},2567:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>n,metadata:()=>a,viewport:()=>i});var o=r(9013);r(1);let a={title:"PrumoQ",description:"Gest\xe3o da Qualidade para Obras"},i={themeColor:"#163B50"};function n({children:e}){return o.jsx("html",{lang:"pt-BR",children:o.jsx("body",{children:e})})}},3202:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>l});var o=r(9013),a=r(9011),i=r(3451),n=r(3244);let s=(0,r(3189).createProxy)(String.raw`C:\Code\prumoq\apps\web\app\relatorio\fvs\[fvsId]\PrintClient.tsx#default`);async function l({params:e,searchParams:t}){let r=await (0,i.L)(await (0,n.e)(),e.fvsId);return r?o.jsx(s,{fvsId:e.fvsId,header:r.header,verificacoes:r.verificacoes,ncs:r.ncs,conclusao:r.conclusao,emitidoEm:r.emitidoEm,initialIncludeAttachments:"0"!==t.attachments}):(0,a.notFound)()}},9011:(e,t,r)=>{"use strict";var o=r(2349);r.o(o,"notFound")&&r.d(t,{notFound:function(){return o.notFound}}),r.o(o,"redirect")&&r.d(t,{redirect:function(){return o.redirect}})},2349:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{ReadonlyURLSearchParams:function(){return n},RedirectType:function(){return o.RedirectType},notFound:function(){return a.notFound},permanentRedirect:function(){return o.permanentRedirect},redirect:function(){return o.redirect}});let o=r(9520),a=r(8433);class i extends Error{constructor(){super("Method unavailable on `ReadonlyURLSearchParams`. Read more: https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams")}}class n extends URLSearchParams{append(){throw new i}delete(){throw new i}set(){throw new i}sort(){throw new i}}("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)},8433:(e,t)=>{"use strict";Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{isNotFoundError:function(){return a},notFound:function(){return o}});let r="NEXT_NOT_FOUND";function o(){let e=Error(r);throw e.digest=r,e}function a(e){return"object"==typeof e&&null!==e&&"digest"in e&&e.digest===r}("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)},8218:(e,t)=>{"use strict";var r;Object.defineProperty(t,"__esModule",{value:!0}),Object.defineProperty(t,"RedirectStatusCode",{enumerable:!0,get:function(){return r}}),function(e){e[e.SeeOther=303]="SeeOther",e[e.TemporaryRedirect=307]="TemporaryRedirect",e[e.PermanentRedirect=308]="PermanentRedirect"}(r||(r={})),("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)},9520:(e,t,r)=>{"use strict";var o;Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{RedirectType:function(){return o},getRedirectError:function(){return l},getRedirectStatusCodeFromError:function(){return m},getRedirectTypeFromError:function(){return f},getURLFromRedirectError:function(){return u},isRedirectError:function(){return p},permanentRedirect:function(){return c},redirect:function(){return d}});let a=r(4580),i=r(2934),n=r(8218),s="NEXT_REDIRECT";function l(e,t,r){void 0===r&&(r=n.RedirectStatusCode.TemporaryRedirect);let o=Error(s);o.digest=s+";"+t+";"+e+";"+r+";";let i=a.requestAsyncStorage.getStore();return i&&(o.mutableCookies=i.mutableCookies),o}function d(e,t){void 0===t&&(t="replace");let r=i.actionAsyncStorage.getStore();throw l(e,t,(null==r?void 0:r.isAction)?n.RedirectStatusCode.SeeOther:n.RedirectStatusCode.TemporaryRedirect)}function c(e,t){void 0===t&&(t="replace");let r=i.actionAsyncStorage.getStore();throw l(e,t,(null==r?void 0:r.isAction)?n.RedirectStatusCode.SeeOther:n.RedirectStatusCode.PermanentRedirect)}function p(e){if("object"!=typeof e||null===e||!("digest"in e)||"string"!=typeof e.digest)return!1;let[t,r,o,a]=e.digest.split(";",4),i=Number(a);return t===s&&("replace"===r||"push"===r)&&"string"==typeof o&&!isNaN(i)&&i in n.RedirectStatusCode}function u(e){return p(e)?e.digest.split(";",3)[2]:null}function f(e){if(!p(e))throw Error("Not a redirect error");return e.digest.split(";",2)[1]}function m(e){if(!p(e))throw Error("Not a redirect error");return Number(e.digest.split(";",4)[3])}(function(e){e.push="push",e.replace="replace"})(o||(o={})),("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)},1026:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>a});var o=r(7201);let a=e=>[{type:"image/svg+xml",sizes:"any",url:(0,o.fillMetadataSegment)("/admin",e.params,"icon.svg")+"?b73f5aab674add05"}]},1:()=>{}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),o=t.X(0,[522,920,679,201,729],()=>r(2051));module.exports=o})();