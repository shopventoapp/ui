# Newsletter signup

`NewsletterSignup` supports standalone guest signup, authenticated account adapters, pending double opt-in, explicit retries and a one-shot consent handoff from checkout or reservation. Import `@shopvento/ui/forms.css`; use `--sv-*` tokens on `.sv-newsletter` for colours and fonts.

```tsx
import { NewsletterSignup } from "@shopvento/ui/forms";
<NewsletterSignup siteKey="PUBLIC-TEST-KEY" privacyUrl="/privacy"
  labels={{ "Neuigkeiten zuerst erfahren": "Our latest events" }} />;
```

Guest signup lazily loads Turnstile near the viewport and posts `email`, `source` and `turnstile_token` to `/api/shop/user/newsletter/subscribe`. Sources distinguish footer, reservation and general website consent. Initial email and first name can be supplied without implying consent. The public endpoint must be available through the host's same-origin proxy without requiring an account session.

For account signup, supply `onSubscribe`, for example a callback backed by `profileNewsletterAdapter`. No public challenge is required for that authenticated adapter. `pending` shows the separate confirmation instruction. A cooldown response keeps the form retryable and asks the customer to wait five minutes. Success means that a confirmation may be sent; it does not claim confirmed newsletter membership.

`automatic.onAttempt` must atomically consume a previously recorded explicit consent and return whether this instance may send. It is called once before a request, including when the user is already pending or subscribed; `alreadySubscribed` avoids another request. Do not use automatic signup without prior consent. Checkout uses an expiring order/account-bound intent for this purpose.

German messages are overridable through `labels`; `defaultNewsletterLabels` lists the default keys and placeholder syntax. `variant="card"` is suitable for order/reservation outcomes. `publicApi` and `ScriptComponent` retain a host's runtime transport and framework script loader; defaults are framework-neutral Shopvento requests. No emails are sent by package tests.
