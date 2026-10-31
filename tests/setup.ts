import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Keep native server HTTP APIs: browser shims suppress Origin and Set-Cookie.
const http = { Request, Response, Headers, fetch };
GlobalRegistrator.register();
Object.assign(globalThis, http);
