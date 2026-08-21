'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';

export default function MissedTargetModal() {
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only check once per day locally so we don't spam them if they refresh
    const lastCheck = localStorage.getItem('lastTargetCheck');
    const today = new Date().toDateString();
    
    if (lastCheck === today) {
      setDismissed(true);
      return;
    }

    fetch('/api/telecaller/target-check')
      .then(r => r.json())
      .then(d => {
        if (d.missed) {
          setData(d);
        } else {
          localStorage.setItem('lastTargetCheck', today);
          setDismissed(true);
        }
      })
      .catch(() => setDismissed(true));
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('lastTargetCheck', new Date().toDateString());
    setDismissed(true);
  };

  if (dismissed || !data) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="bg-rose-50 p-5 flex flex-col items-center text-center border-b border-rose-100">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
            <TrendingDown className="h-8 w-8 text-rose-600" />
          </div>
          <h2 className="text-xl font-black text-rose-700">Target Missed Yesterday</h2>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-slate-600 leading-relaxed text-center mb-6">
            You only completed <strong className="text-rose-600 text-base">{data.achieved}</strong> out of your <strong className="text-slate-800 text-base">{data.target}</strong> assigned connected calls yesterday.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-6">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-medium leading-relaxed">
              <strong>Note:</strong> Calls marked as "Not Answered" do not count towards your daily target. Continued failure to meet the daily minimum target may lead to a salary reduction or performance review. Please ensure you meet your target today.
            </p>
          </div>

          <button 
            onClick={handleDismiss}
            className="w-full bg-rose-600 text-white font-bold text-sm px-4 py-3.5 rounded-xl hover:bg-rose-700 transition-colors shadow-sm shadow-rose-200"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
