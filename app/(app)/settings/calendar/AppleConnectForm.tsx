"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { appleConnectSchema, type AppleConnectInput } from "@/domains/calendar/schema";
import { connectAppleCalendar } from "@/domains/calendar/connect-actions";
import { FormField, TextInput } from "@/platform/ui/FormField";

/** Apple Calendar has no consent screen — connecting is a credential form,
 * not a redirect. Success is verified with a real CalDAV round-trip inside
 * connectAppleCalendar before anything is stored, so a wrong password
 * surfaces here as a normal form error rather than a mysterious failure
 * later. */
export function AppleConnectForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AppleConnectInput>({
    resolver: zodResolver(appleConnectSchema),
  });

  const onSubmit = (values: AppleConnectInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await connectAppleCalendar(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="font-medium">Apple Calendar (iCloud)</p>
      <p className="mt-1 mb-3 text-sm text-neutral-500">
        Apple has no connect-and-consent screen — generate an app-specific password at{" "}
        <span className="font-medium">appleid.apple.com → Sign-In and Security → App-Specific
        Passwords</span>{" "}
        (requires two-factor authentication, already on by default) and enter it below.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <FormField label="Apple ID" htmlFor="appleId" error={errors.appleId?.message}>
          <TextInput id="appleId" type="email" autoComplete="off" {...register("appleId")} />
        </FormField>
        <FormField
          label="App-specific password"
          htmlFor="appSpecificPassword"
          error={errors.appSpecificPassword?.message}
        >
          <TextInput
            id="appSpecificPassword"
            type="password"
            autoComplete="off"
            placeholder="abcd-efgh-ijkl-mnop"
            {...register("appSpecificPassword")}
          />
        </FormField>
        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {isPending ? "Connecting…" : "Connect"}
        </button>
      </form>
    </div>
  );
}
