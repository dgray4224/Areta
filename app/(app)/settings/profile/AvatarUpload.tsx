"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadAvatar } from "@/domains/identity/service";
import { AvatarPhoto } from "@/platform/ui/AvatarPhoto";
import { Button } from "@/platform/ui/Button";

const SIZE = 96;

/** Web counterpart to areta-mobile's profile.tsx avatar picker. No
 * camera/library split (browsers only expose one file picker) and no
 * interactive crop step (mobile relies on expo-image-picker's native
 * allowsEditing crop, which has no equivalent here without pulling in a
 * cropping library) — the photo displays via AvatarPhoto's
 * `object-fit: cover` instead, same pragmatic square-crop-on-display
 * approach RecipePhoto already uses for recipe photos. Saves immediately
 * on pick, same as mobile — not part of ProfileForm's Save button. */
export function AvatarUpload({ userId, initialUrl }: { userId: string; initialUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onFileSelected(file: File | undefined) {
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadAvatar(userId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUrl(result.data.avatarUrl);
      router.refresh();
    });
  }

  return (
    <div className="mb-6 flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className="relative shrink-0 rounded-full disabled:opacity-60"
        aria-label={url ? "Change photo" : "Add photo"}
      >
        <AvatarPhoto url={url} size={SIZE} />
        {isPending ? (
          <span
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 text-xs font-medium text-white"
            style={{ width: SIZE, height: SIZE }}
          >
            Uploading…
          </span>
        ) : null}
      </button>
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
        >
          {url ? "Change photo" : "Add photo"}
        </Button>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => onFileSelected(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
