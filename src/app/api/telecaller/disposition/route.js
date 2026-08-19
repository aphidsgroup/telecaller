import { requireTelecaller } from '@/lib/auth';
import { ok, readJson, route } from '@/lib/api';
import { submitDisposition } from '@/lib/workflow';
import { queueSummary, serialiseLeadForCaller, serveCurrentLead } from '@/lib/queue';

export const dynamic = 'force-dynamic';

// Submitting the disposition is what unlocks the next lead - the two happen in
// the same request so the telecaller is never left staring at an empty screen.
export const POST = route(async (req) => {
  const user = await requireTelecaller();
  const body = await readJson(req);

  const result = await submitDisposition({
    userId: user.id,
    leadId: body.leadId,
    clientEventId: body.clientEventId,
    callCategory: body.callCategory,
    leadStatus: body.leadStatus,
    notes: body.notes,
    audioBase64: body.audioBase64,
    callClickedAt: body.callClickedAt,
    queuedOffline: Boolean(body.queuedOffline),
  });

  const { lead, resumed } = await serveCurrentLead(user.id);
  const queue = await queueSummary(user.id);

  return ok({
    result,
    lead: await serialiseLeadForCaller(lead),
    resumed,
    queue,
  });
});
