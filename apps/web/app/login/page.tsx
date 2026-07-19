import { PhoneLoginForm } from "./phone-login-form";

export default function LoginPage() {
  return (
    <main>
      <p>Ship Tickets</p>
      <h1>Sign in</h1>
      <p>We will text you a one-time verification code.</p>
      <PhoneLoginForm />
    </main>
  );
}
