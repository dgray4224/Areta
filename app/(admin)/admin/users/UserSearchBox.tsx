"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TextInput } from "@/platform/ui/FormField";

/** Search box for the admin users list. State lives in the URL (`?q=`),
 * same convention as StatusTabs, so the list stays a plain server
 * component and a search is shareable/back-button-able. Debounced
 * locally so every keystroke doesn't push a new URL entry. */
export function UserSearchBox({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="max-w-xs">
      <TextInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by name or email…"
        aria-label="Search users"
      />
    </div>
  );
}
