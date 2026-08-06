"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertMyTrainerProfile } from "@/domains/trainer/service";
import { FormField, TextInput, TextArea } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import type { TrainerProfile } from "@/domains/trainer/types";

export function TrainerProfileForm({ initialProfile }: { initialProfile: TrainerProfile | null }) {
  const router = useRouter();
  const [bio, setBio] = useState(initialProfile?.bio ?? "");
  const [yearsExperience, setYearsExperience] = useState(initialProfile?.yearsExperience?.toString() ?? "");
  const [specialties, setSpecialties] = useState(initialProfile?.specialties.join(", ") ?? "");
  const [locationCity, setLocationCity] = useState(initialProfile?.locationCity ?? "");
  const [locationRegion, setLocationRegion] = useState(initialProfile?.locationRegion ?? "");
  const [isDiscoverable, setIsDiscoverable] = useState(initialProfile?.isDiscoverable ?? false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const onSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await upsertMyTrainerProfile({
        bio: bio || null,
        yearsExperience: yearsExperience ? Number(yearsExperience) : null,
        specialties: specialties
          ? specialties
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        locationCity: locationCity || null,
        locationRegion: locationRegion || null,
        isDiscoverable,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <FormField label="Bio" htmlFor="bio" hint="Shown on your public profile.">
        <TextArea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
      </FormField>

      <FormField label="Years of experience" htmlFor="yearsExperience">
        <TextInput
          id="yearsExperience"
          type="number"
          value={yearsExperience}
          onChange={(e) => setYearsExperience(e.target.value)}
        />
      </FormField>

      <FormField label="Specialties" htmlFor="specialties" hint="Comma-separated, e.g. hypertrophy, injury rehab">
        <TextInput id="specialties" value={specialties} onChange={(e) => setSpecialties(e.target.value)} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="City" htmlFor="locationCity">
          <TextInput id="locationCity" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} />
        </FormField>
        <FormField label="State / region" htmlFor="locationRegion">
          <TextInput
            id="locationRegion"
            value={locationRegion}
            onChange={(e) => setLocationRegion(e.target.value)}
          />
        </FormField>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isDiscoverable} onChange={(e) => setIsDiscoverable(e.target.checked)} />
        Listed publicly — clients can find and request you at /trainers
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved && !isPending ? <p className="text-sm text-green-700 dark:text-green-400">Saved.</p> : null}

      <Button type="button" disabled={isPending} onClick={onSave}>
        {isPending ? "Saving…" : "Save profile"}
      </Button>
    </div>
  );
}
