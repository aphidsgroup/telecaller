$paths = @("src/app/admin/followups/page.js", "src/app/manager/followups/page.js")
foreach ($path in $paths) {
  $content = Get-Content -Path $path -Raw
  
  # 1. Add startingFilter extraction
  $content = $content -replace 'const companyIdFilter = params\.companyId \|\| user\.companyId;', "const companyIdFilter = params.companyId || user.companyId;`n  const startingFilter = params.starting || '';"

  # 2. Increase take to 250 so JS filtering has enough leads
  $content = $content -replace 'take: 100,', 'take: 250,'

  # 3. Add JS filtering and sorting
  $replacement = @"
  let telecallerLeads = serializedLeads.filter(l => {
    const lastDisp = l.dispositions && l.dispositions[l.dispositions.length - 1];
    return !lastDisp || lastDisp.user?.role === 'TELECALLER';
  });

  if (startingFilter) {
    telecallerLeads = telecallerLeads.filter(l => l.extraData && l.extraData.Starting === startingFilter);
  }

  const STARTING_ORDER = {
    'Immediately': 1,
    'Within 1 month': 2,
    'Within 3 months': 3,
    'More than 3 months': 4,
  };

  telecallerLeads.sort((a, b) => {
    const aVal = (a.extraData && STARTING_ORDER[a.extraData.Starting]) ? STARTING_ORDER[a.extraData.Starting] : 99;
    const bVal = (b.extraData && STARTING_ORDER[b.extraData.Starting]) ? STARTING_ORDER[b.extraData.Starting] : 99;
    if (aVal !== bVal) return aVal - bVal;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  const engineerLeads = serializedLeads.filter(l => {
"@
  $content = $content -replace '(?s)  const telecallerLeads = serializedLeads\.filter\(l => \{.*?\n  const engineerLeads = serializedLeads\.filter\(l => \{', $replacement

  # 4. Add the dropdown to the form
  $formReplacement = @"
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          <input type="text" name="q" defaultValue={q} placeholder="Search name or phone..." className="input pl-9 text-sm" />
        </div>
        <select name="starting" defaultValue={startingFilter || ''} className="input text-sm w-full md:w-auto md:min-w-[150px]">
          <option value="">All Starting Times</option>
          <option value="Immediately">Immediately</option>
          <option value="Within 1 month">Within 1 month</option>
          <option value="Within 3 months">Within 3 months</option>
          <option value="More than 3 months">More than 3 months</option>
        </select>
"@
  $content = $content -replace '(?s)        <div className="relative flex-1 min-w-\[200px\]">.*?</div>', $formReplacement

  Set-Content -Path $path -Value $content
}
