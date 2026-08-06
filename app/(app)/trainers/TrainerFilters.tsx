"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextInput } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";

export function TrainerFilters({ initialCity, initialSpecialty }: { initialCity: string; initialSpecialty: string }) {
  const router = useRouter();
  const [city, setCity] = useState(initialCity);
  const [specialty, setSpecialty] = useState(initialSpecialty);

  const onSearch = () => {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (specialty) params.set("specialty", specialty);
    router.push(params.size > 0 ? `/trainers?${params.toString()}` : "/trainers");
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="max-w-[10rem]">
        <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="city-filter">
          City
        </label>
        <TextInput id="city-filter" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      <div className="max-w-[10rem]">
        <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="specialty-filter">
          Specialty
        </label>
        <TextInput id="specialty-filter" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
      </div>
      <Button type="button" variant="secondary" onClick={onSearch}>
        Search
      </Button>
    </div>
  );
}
