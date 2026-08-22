'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export default function AutoSubmitForm({ children, className }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e) {
    const form = e.currentTarget;
    const formData = new FormData(form);
    const params = new URLSearchParams(searchParams.toString());
    
    // Update params with form values
    for (let [key, value] of formData.entries()) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    
    // Navigate with new params
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form className={className} onChange={handleChange} onSubmit={(e) => e.preventDefault()}>
      {children}
    </form>
  );
}
