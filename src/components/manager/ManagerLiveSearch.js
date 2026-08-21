'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export default function ManagerLiveSearch({ placeholder = "Search leads by phone number or name...", onSearch }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/manager/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.leads || []);
          setShowDropdown(true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setShowDropdown(false);
      router.push(`/manager/leads?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSelect = (lead) => {
    setQuery(lead.phone);
    setShowDropdown(false);
    router.push(`/manager/leads?q=${encodeURIComponent(lead.phone)}`);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <form onSubmit={handleSubmit} className="relative w-full">
        <input 
          type="text" 
          placeholder={placeholder}
          className="w-full text-sm py-3 pl-4 pr-10 rounded-xl bg-white shadow-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            if (onSearch) onSearch(val);
            if (!showDropdown && val.length >= 3) setShowDropdown(true);
          }}
          onFocus={() => {
            if (query.length >= 3 && results.length > 0) setShowDropdown(true);
          }}
        />
        <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-500">
          <Search size={18} strokeWidth={2.5} />
        </button>
      </form>

      {showDropdown && (query.length >= 3) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-slate-500 animate-pulse">Searching...</div>
          ) : results.length > 0 ? (
            <ul className="py-2">
              {results.map((lead) => (
                <li 
                  key={lead.id} 
                  className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                  onClick={() => handleSelect(lead)}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-800 text-sm">{lead.name || 'Unknown'}</span>
                    <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">{lead.phone}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">{lead.lastLeadStatus || lead.status}</span>
                    <span className="text-slate-400 font-medium">{lead.assignedTo?.name || 'Unassigned'}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-sm text-slate-500">No leads found matching &quot;{query}&quot;</div>
          )}
        </div>
      )}
    </div>
  );
}