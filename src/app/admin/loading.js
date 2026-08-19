export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton h-8 w-16" />
            <div className="skeleton h-3 w-24 mt-1" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="skeleton h-4 w-32" />
        </div>
        <div className="divide-y divide-slate-50">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="skeleton h-8 w-8 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <div className="skeleton h-4 w-36" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="skeleton h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
