import { createClient } from '@/lib/supabase/server';
import { createPdf } from '@/lib/reports/pdf';
import { loadContractorEvaluationReport } from '@/lib/reports/contractor-evaluation';
import { renderContractorEvaluationHtml } from '@/lib/reports/contractor-evaluation-html';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(_:Request,{params}:{params:{id:string}}){try{const client=await createClient();const report=await loadContractorEvaluationReport(client,params.id);if(!report)return Response.json({error:'Avaliação não encontrada.'},{status:404});const pdf=await createPdf(renderContractorEvaluationHtml(report),{landscape:false});return new Response(Buffer.from(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="avaliacao-empreiteiro-${params.id}.pdf"`,'Cache-Control':'private, no-store'}})}catch(error){console.error(error);return Response.json({error:'Não foi possível gerar o PDF.'},{status:500})}}
