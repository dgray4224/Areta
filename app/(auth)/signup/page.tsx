"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/platform/auth/schema";
import { signUpWithPassword } from "@/platform/auth/actions";
import { FormField, TextInput } from "@/platform/ui/FormField";

export default function SignupPage() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  const onSubmit = (values: SignupInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await signUpWithPassword(values.email, values.password);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      if (result.data.requiresEmailConfirmation) {
        setConfirmationSent(true);
      } else {
        window.location.href = "/onboarding";
      }
    });
  };

  if (confirmationSent) {
    return (
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 p-6 text-center dark:border-neutral-800">
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-neutral-500">
          We sent a confirmation link. Click it, then come back and log in.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm underline">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
      noValidate
    >
      <h1 className="text-lg font-semibold">Create your account</h1>

      <FormField label="Email" htmlFor="email" error={errors.email?.message}>
        <TextInput id="email" type="email" autoComplete="email" {...register("email")} />
      </FormField>

      <FormField label="Password" htmlFor="password" error={errors.password?.message}>
        <TextInput
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
      </FormField>

      <FormField
        label="Confirm password"
        htmlFor="confirmPassword"
        error={errors.confirmPassword?.message}
      >
        <TextInput
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
      </FormField>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {isPending ? "Creating account…" : "Sign up"}
      </button>

      <p className="text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
