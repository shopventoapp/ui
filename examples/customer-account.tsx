"use client";
import { createAccountClient, LoginForm } from "@shopvento/ui";

const client = createAccountClient({
  onUnauthorized: () => window.location.assign("/login"),
});

export function CustomerAccountExample() {
  return (
    <div className="sv-redesign">
      <LoginForm
        client={client}
        registerUrl="/register"
        passwordResetUrl="/password-reset"
        onSuccess={() => window.location.assign("/account")}
      />
    </div>
  );
}
