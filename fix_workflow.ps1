$content = Get-Content -Path "src/lib/workflow.js" -Raw
$content = $content -replace '(?s)  const updateData = \{.*?\};\s*if \(leadStatus\) \{\s*updateData.lastLeadStatus = leadStatus;\s*\}\s*await prisma\.lead\.update\(\{\s*where: \{ id: leadId \},\s*flaggedForReview: false,\s*flagReason: null,\s*flaggedAt: null,\s*\.\.\.clientUpdate\s*\},\s*\}\);', '  const updateData = {
    status: close ? LEAD_STATUS.CLOSED : LEAD_STATUS.SCHEDULED,
    followUpAt,
    followUpNotifiedAt: null,
    closedAt: close ? submittedAt : null,
    lastContactedAt: submittedAt,
    lastCallCategory: callCategory,
    inProgressAt: null,
    followupRequestedAt: null,
    followupAcceptedAt: null,
    followupDeclinedAt: null,
    followupMessage: null,
    flaggedForReview: false,
    flagReason: null,
    flaggedAt: null,
    ...clientUpdate
  };
  if (leadStatus) updateData.lastLeadStatus = leadStatus;

  await prisma.lead.update({
    where: { id: leadId },
    data: updateData
  });'
Set-Content -Path "src/lib/workflow.js" -Value $content
