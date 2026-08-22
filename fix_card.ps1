$content = Get-Content -Path "src/components/manager/ManagerLeadCard.js" -Raw
$newSection = @"
      </div>

      {/* Client Details */}
      {(lead.city || (lead.extraData && Object.keys(lead.extraData).length > 0)) && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Client Details</h4>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
            {lead.city && (
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Location</span>
                <span className="font-semibold text-slate-700">{lead.city}</span>
              </div>
            )}
            {lead.extraData && Object.entries(lead.extraData).map(([key, val]) => (
              <div key={key}>
                <span className="text-slate-400 block text-[9px] uppercase">{key}</span>
                <span className="font-semibold text-slate-700">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lead Journey Timeline */}
"@
$content = $content -replace '      </div>\s*\{\/\* Lead Journey Timeline \*\/\}', $newSection
Set-Content -Path "src/components/manager/ManagerLeadCard.js" -Value $content
