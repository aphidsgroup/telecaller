export default function LeadsLoading() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="skeleton h-9 w-48" />
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 flex gap-3">
          <div className="skeleton h-9 flex-1" />
          <div className="skeleton h-9 w-28" />
        </div>
        <div className="divide-y divide-slate-50">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-5 w-16 rounded-full ml-auto" />
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
