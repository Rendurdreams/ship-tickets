"use client";

import { FormEvent, useState } from "react";

type Step = "phone" | "code";

interface ErrorBody {
  error?: { message?: string };
}

async function responseMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as ErrorBody;
  return body.error?.message ?? "Something went wrong";
}

export function PhoneLoginForm() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      if (step === "phone") {
        const response = await fetch("/api/auth/request-otp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        if (!response.ok) throw new Error(await responseMessage(response));
        setStep("code");
        setMessage("Code sent. Check your phone.");
        return;
      }

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      window.location.assign("/dashboard");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="phone">Phone number</label>
      <input
        id="phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="+15555550123"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        disabled={step === "code" || submitting}
        required
      />

      {step === "code" ? (
        <>
          <label htmlFor="code">Verification code</label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={submitting}
            required
          />
        </>
      ) : null}

      <button type="submit" disabled={submitting}>
        {submitting
          ? "Please wait…"
          : step === "phone"
            ? "Send code"
            : "Sign in"}
      </button>

      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
