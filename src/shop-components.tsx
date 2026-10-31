"use client";
import {
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";

/** Host presentation model for a product card. Amounts are integer cents; map catalogue data explicitly. */
export type ShopProduct = {
  /** Opaque backend identifier or accessible element ID. */
  id: string;
  /** URL-safe host product slug. */
  slug: string;
  /** Customer-visible heading or title supplied by the host. */
  title: string;
  /** Optional host product subtitle. Optional; omitted unless supplied by the host or backend. */
  subtitle?: string;
  /** Optional host producer label. Optional; omitted unless supplied by the host or backend. */
  producer?: string;
  /** Price in integer cents. */
  price: number;
  /** Host-formatted unit price. Optional; omitted unless supplied by the host or backend. */
  unitPrice?: string;
  /** Host-formatted quantity information. Optional; omitted unless supplied by the host or backend. */
  quantityInformation?: string;
  /** Host-owned product or section description. Optional; omitted unless supplied by the host or backend. */
  description?: string;
  /** Host image URL. Optional; omitted unless supplied by the host or backend. */
  image?: string;
  /** Accessible image description. Optional; omitted unless supplied by the host or backend. */
  imageAlt?: string;
  /** Built-in product illustration used when no image is supplied. Optional; omitted unless supplied by the host or backend. */
  placeholder?: "product" | "bottle" | "jar" | "gift" | ReactElement;
  /** Host illustration background color. Optional; omitted unless supplied by the host or backend. */
  tint?: string;
  /** Host illustration fill color. Optional; omitted unless supplied by the host or backend. */
  illustrationColor?: string;
  /** Host illustration cap color. Optional; omitted unless supplied by the host or backend. */
  illustrationCapColor?: string;
  /** Host product badge labels. Optional; omitted unless supplied by the host or backend. */
  badges?: string[];
  /** Optional semantic tones keyed by badge label. Optional; omitted unless supplied by the host or backend. */
  badgeTones?: Record<string, "accent" | "success">;
  /** Host availability copy. Optional; omitted unless supplied by the host or backend. */
  availability?: string;
  /** Disable purchase presentation when true. Optional; omitted unless supplied by the host or backend. */
  unavailable?: boolean;
  /** Whether the host permits a customer-entered amount. Optional; omitted unless supplied by the host or backend. */
  customerDefinedPrice?: boolean;
  /** Minimum customer-defined price in integer cents. Optional; omitted unless supplied by the host or backend. */
  minimumPrice?: number;
  /** Whether the backend excludes this item from withdrawal. Optional; omitted unless supplied by the host or backend. */
  withdrawalExcluded?: boolean;
  /** Host withdrawal notice. Optional; omitted unless supplied by the host or backend. */
  withdrawalNotice?: string;
  /** Whether fulfillment is pickup only. Optional; omitted unless supplied by the host or backend. */
  pickupOnly?: boolean;
  /** Whether age verification applies. Optional; omitted unless supplied by the host or backend. */
  adultOnly?: boolean;
  /** Host product category label. */
  category: string;
  /** Public event variants with backend prices. Optional; omitted unless supplied by the host or backend. */
  variants?: {
    /** Opaque backend identifier or accessible element ID. */
    id: string;
    /** Selected icon or backend name. */
    name: string;
    /** Price in integer cents. */
    price: number;
    /** Whether age verification applies. Optional; omitted unless supplied by the host or backend. */
    adultOnly?: boolean;
    /** Host-formatted unit price. Optional; omitted unless supplied by the host or backend. */
    unitPrice?: string;
  }[];
  /** Host-supplied product declaration rows. Optional; omitted unless supplied by the host or backend. */
  declarations?: {
    /** Accessible customer-visible label. */
    label: string;
    /** Current controlled value. */
    value: string;
  }[];
};
/** Scope shop presentation styles around children. */
export function ShopSurface({
  children,
}: {
  /** Host-supplied child content. */
  children: ReactNode;
}) {
  return <div className="sv-shop">{children}</div>;
}
/** Render a shop-styled button with standard React button attributes; defaults to type button. */
export function ShopButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`sv-shop-button ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
/** Render a status notice or an error alert. */
export function ShopNotice({
  children,
  error = false,
}: {
  /** Host-supplied child content. */
  children: ReactNode;
  /** Customer-visible error or error presentation flag.
   * @defaultValue false */
  error?: boolean;
}) {
  return (
    <div
      className={`sv-shop-notice ${error ? "is-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
/** Render an empty shop state with a host-supplied action. */
export function ShopEmpty({
  title,
  children,
  action,
}: {
  /** Customer-visible heading or title supplied by the host. */
  title: string;
  /** Host-supplied child content. */
  children: ReactNode;
  /** Optional host empty-state action. Optional; omitted unless supplied by the host or backend. */
  action?: ReactNode;
}) {
  return (
    <div className="sv-shop-empty">
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
/** Render catalogue links and a host-owned search form. */
export function ShopNavigation({
  label,
  links,
  searchLabel,
  searchPlaceholder,
  searchAction,
  query,
}: {
  /** Accessible customer-visible label. */
  label: string;
  /** Host navigation links and current state. */
  links: {
    /** Accessible customer-visible label. */
    label: string;
    /** Host navigation URL. */
    href: string;
    /** Current in the shop navigation contract. Optional; omitted unless supplied by the host or backend. */
    current?: boolean;
  }[];
  /** Accessible label for shop search. */
  searchLabel: string;
  /** Host search input placeholder. */
  searchPlaceholder: string;
  /** Host route that accepts the search query. */
  searchAction: string;
  /** Initial search query. Optional; omitted unless supplied by the host or backend. */
  query?: string;
}) {
  const id = useId();
  return (
    <div className="sv-shop-bar">
      <nav aria-label={label}>
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                aria-current={link.current ? "page" : undefined}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <search>
        <form action={searchAction}>
          <label className="sv-shop-sr" htmlFor={id}>
            {searchLabel}
          </label>
          <input
            id={id}
            type="search"
            name="q"
            defaultValue={query}
            placeholder={searchPlaceholder}
          />
          <button type="submit" aria-label={searchLabel}>
            ⌕
          </button>
        </form>
      </search>
    </div>
  );
}
/** Render a host-owned shop introduction with image and actions. */
export function ShopHero({
  eyebrow,
  title,
  description,
  actions,
  image,
  imageAlt,
  note,
}: {
  /** Short host-supplied heading context. */
  eyebrow: string;
  /** Customer-visible heading or title supplied by the host. */
  title: ReactNode;
  /** Host-owned product or section description. */
  description: string;
  /** Host action controls. */
  actions: ReactNode;
  /** Host image URL. */
  image: string;
  /** Accessible image description. */
  imageAlt: string;
  /** Host supplemental content. */
  note: ReactNode;
}) {
  return (
    <section className="sv-shop-hero">
      <div>
        <p className="sv-shop-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="sv-shop-lead">{description}</p>
        <div className="sv-shop-actions">{actions}</div>
      </div>
      <div className="sv-shop-hero-media">
        <img src={image} alt={imageAlt} />
        <div>{note}</div>
      </div>
    </section>
  );
}
/** Group shop content under a host heading and optional link. */
export function ShopSection({
  title,
  link,
  children,
}: {
  /** Customer-visible heading or title supplied by the host. */
  title: ReactNode;
  /** Link in the shop section contract. Optional; omitted unless supplied by the host or backend. */
  link?: ReactNode;
  /** Host-supplied child content. */
  children: ReactNode;
}) {
  return (
    <section className="sv-shop-section">
      <div className="sv-shop-section-title">
        <h2>{title}</h2>
        {link}
      </div>
      {children}
    </section>
  );
}
/** Render a product image or the selected built-in illustration. */
export function ShopMedia({
  product,
}: {
  /** Host-mapped product presentation data. */
  product: ShopProduct;
}) {
  const id = useId().replace(/:/g, "");
  const shapePath =
    product.placeholder === "jar"
      ? "M20 130h60v140q0 10-10 10H30q-10 0-10-10Z"
      : "M42 12h16v60q0 18 12 32 9 12 9 27v145q0 10-10 10H31q-10 0-10-10V131q0-15 9-27 12-14 12-32Z";
  return (
    <div
      className={`sv-shop-media ${product.unavailable ? "is-out" : ""}`}
      style={
        {
          background: product.tint ?? "var(--sv-surface-2)",
          "--sv-product-fill": product.illustrationColor,
          "--sv-product-cap": product.illustrationCapColor,
        } as React.CSSProperties
      }
    >
      {product.image ? (
        <img
          src={product.image}
          alt={product.imageAlt ?? product.title}
          loading="lazy"
        />
      ) : isValidElement(product.placeholder) ? (
        product.placeholder
      ) : !product.placeholder || product.placeholder === "product" ? (
        <svg
          viewBox="0 0 100 120"
          role="img"
          aria-label={product.imageAlt ?? product.title}
        >
          <path d="M15 35 50 15 85 35 50 55Z" fill="var(--sv-accent)" />
          <path d="M15 35v50l35 20V55Z" fill="var(--sv-primary)" />
          <path d="M50 55v50l35-20V35Z" fill="var(--sv-text-2)" />
        </svg>
      ) : product.placeholder === "gift" ? (
        <svg
          viewBox="0 0 100 120"
          role="img"
          aria-label={product.imageAlt ?? product.title}
        >
          <path d="M10 50h80v60H10z" fill="var(--sv-primary)" />
          <path d="M5 40h90v20H5z" fill="var(--sv-accent)" />
          <path
            d="M47 40h6v70H47zM50 40C15 35 20 10 37 22L50 40C85 35 80 10 63 22Z"
            fill="var(--sv-surface)"
          />
        </svg>
      ) : (
        <svg
          viewBox={
            product.placeholder === "jar" ? "0 110 100 190" : "0 0 100 300"
          }
          role="img"
          aria-label={product.imageAlt ?? product.title}
        >
          <defs>
            <linearGradient id={id}>
              <stop stopColor="white" stopOpacity=".25" />
              <stop offset=".4" stopColor="white" stopOpacity="0" />
              <stop offset="1" stopColor="black" stopOpacity=".25" />
            </linearGradient>
          </defs>
          <path
            d={
              product.placeholder === "jar"
                ? "M20 130h60v140q0 10-10 10H30q-10 0-10-10Z"
                : "M42 12h16v60q0 18 12 32 9 12 9 27v145q0 10-10 10H31q-10 0-10-10V131q0-15 9-27 12-14 12-32Z"
            }
            fill="var(--sv-product-fill, #3e4d29)"
          />
          <rect
            x={product.placeholder === "jar" ? 20 : 41}
            y={product.placeholder === "jar" ? 120 : 10}
            width={product.placeholder === "jar" ? 60 : 18}
            height="25"
            rx="2"
            fill="var(--sv-product-cap, var(--sv-primary))"
          />
          <rect
            x="27"
            y="172"
            width="46"
            height="79"
            fill="var(--sv-surface)"
          />
          <rect
            x="31"
            y="176"
            width="38"
            height="71"
            fill="none"
            stroke="var(--sv-border)"
          />
          <text
            x="50"
            y="192"
            textAnchor="middle"
            fontSize="5"
            fill="var(--sv-text)"
          >
            {(product.producer ?? "").slice(0, 15)}
          </text>
          <text
            x="50"
            y="225"
            textAnchor="middle"
            fontSize="28"
            fontFamily="var(--sv-font-display)"
            fill="var(--sv-primary)"
          >
            {product.title[0]}
          </text>
          <path d={shapePath} fill={`url(#${id})`} />
        </svg>
      )}
      <div className="sv-shop-badges">
        {product.badges?.map((b) => (
          <span
            key={b}
            className={
              product.badgeTones?.[b]
                ? `is-${product.badgeTones[b]}`
                : undefined
            }
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}
/** Render a host-formatted cent amount with optional unit price and legal labels. */
export function ShopPrice({
  amount,
  formatPrice,
  unitPrice,
  taxLabel,
  shippingLabel,
  shippingHref,
}: {
  /** Amount in integer cents. */
  amount: number;
  /** Format an integer-cent amount using the host locale and currency. */
  formatPrice: (amount: number) => string;
  /** Host-formatted unit price. Optional; omitted unless supplied by the host or backend. */
  unitPrice?: string;
  /** Host tax information. Optional; omitted unless supplied by the host or backend. */
  taxLabel?: string;
  /** Host shipping information link label. Optional; omitted unless supplied by the host or backend. */
  shippingLabel?: string;
  /** Host shipping information URL. Optional; omitted unless supplied by the host or backend. */
  shippingHref?: string;
}) {
  return (
    <div className="sv-shop-price">
      <strong>{formatPrice(amount)}</strong>
      {unitPrice && <span>{unitPrice}</span>}
      {taxLabel && (
        <span>
          {taxLabel}{" "}
          {shippingHref && <a href={shippingHref}>{shippingLabel}</a>}
        </span>
      )}
    </div>
  );
}
/** Render a controlled product card; the host owns navigation and add behavior. */
export function ShopProductCard({
  product,
  href,
  formatPrice,
  addLabel,
  onAdd,
  addDisabled,
  taxLabel,
  shippingLabel,
  shippingHref,
}: {
  /** Host-mapped product presentation data. */
  product: ShopProduct;
  /** Host navigation URL. */
  href: string;
  /** Format an integer-cent amount using the host locale and currency. */
  formatPrice: (amount: number) => string;
  /** Host add-action label. */
  addLabel: string;
  /** Host-owned add action; the package does not provide a cart flow. Optional; omitted unless supplied by the host or backend. */
  onAdd?: () => void;
  /** Disable the host add action. Optional; omitted unless supplied by the host or backend. */
  addDisabled?: boolean;
  /** Host tax information. Optional; omitted unless supplied by the host or backend. */
  taxLabel?: string;
  /** Host shipping information link label. Optional; omitted unless supplied by the host or backend. */
  shippingLabel?: string;
  /** Host shipping information URL. Optional; omitted unless supplied by the host or backend. */
  shippingHref?: string;
}) {
  return (
    <li className="sv-shop-product-card">
      <ShopMedia product={product} />
      <div className="sv-shop-card-body">
        <span className="sv-shop-eyebrow">{product.producer}</span>
        <h3>
          <a href={href}>{product.title}</a>
        </h3>
        <span className="sv-shop-meta">{product.subtitle}</span>
        {product.availability && (
          <span className="sv-shop-meta">{product.availability}</span>
        )}
      </div>
      <div className="sv-shop-card-foot">
        <ShopPrice
          amount={product.price}
          formatPrice={formatPrice}
          unitPrice={product.unitPrice}
          taxLabel={taxLabel}
          shippingLabel={shippingLabel}
          shippingHref={shippingHref}
        />
        {onAdd ? (
          <button
            type="button"
            className="sv-shop-add"
            aria-label={addLabel}
            disabled={product.unavailable || addDisabled}
            onClick={onAdd}
          >
            +
          </button>
        ) : (
          <a className="sv-shop-add" href={href} aria-label={addLabel}>
            {/* "→" has no emoji form; "↗" renders as a blue emoji on iOS */}→
          </a>
        )}
      </div>
    </li>
  );
}
/** Lay out product cards as a grid or horizontal rail. */
export function ShopProductGrid({
  children,
  rail = false,
}: {
  /** Host-supplied child content. */
  children: ReactNode;
  /** Lay out products as a horizontal rail.
   * @defaultValue false */
  rail?: boolean;
}) {
  return <ul className={rail ? "sv-shop-rail" : "sv-shop-grid"}>{children}</ul>;
}
/** Render a controlled quantity input with host labels and bounds. */
export function ShopQuantity({
  value,
  onChange,
  label,
  decreaseLabel,
  increaseLabel,
  max = 99,
  min = 1,
}: {
  /** Current controlled value. */
  value: number;
  /** Receive the updated controlled value. */
  onChange: (value: number) => void;
  /** Accessible customer-visible label. */
  label: string;
  /** Accessible label for decreasing quantity. */
  decreaseLabel: string;
  /** Accessible label for increasing quantity. */
  increaseLabel: string;
  /** Inclusive maximum selectable value.
   * @defaultValue 99 */
  max?: number;
  /** Inclusive minimum selectable value.
   * @defaultValue 1 */
  min?: number;
}) {
  return (
    <fieldset className="sv-shop-quantity" aria-label={label}>
      <button
        type="button"
        aria-label={decreaseLabel}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </fieldset>
  );
}
/** Render a native modal drawer or sheet with a host close action. */
export function ShopDialog({
  title,
  closeLabel,
  children,
  onClose,
  variant = "drawer",
}: {
  /** Customer-visible heading or title supplied by the host. */
  title: string;
  /** Accessible close button label. */
  closeLabel: string;
  /** Host-supplied child content. */
  children: ReactNode;
  /** Close the modal in host state. */
  onClose: () => void;
  /** Modal presentation variant.
   * @defaultValue "drawer" */
  variant?: "drawer" | "sheet";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const active = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
      active?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`sv-shop-dialog sv-shop-${variant}`}
      aria-labelledby={id}
      onCancel={onClose}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <button type="button" aria-label={closeLabel} onClick={onClose}>
          ×
        </button>
      </header>
      <div className="sv-shop-dialog-body">{children}</div>
    </dialog>
  );
}
/** Render server-authoritative summary amounts; optional minimum rows receive the German prefix ab. */
export function ShopSummary({
  title,
  rows,
  totalLabel,
  total,
  formatPrice,
  children,
  busy,
}: {
  /** Customer-visible heading or title supplied by the host. */
  title: string;
  /** Host summary or declaration rows. */
  rows: {
    /** Accessible customer-visible label. */
    label: string;
    /** Amount in integer cents. */
    amount: number;
    /** Prefix this minimum amount with ab when true. Optional; omitted unless supplied by the host or backend. */
    isFrom?: boolean;
  }[];
  /** Host total label. */
  totalLabel: string;
  /** Server-authoritative total in integer cents. */
  total: number;
  /** Format an integer-cent amount using the host locale and currency. */
  formatPrice: (amount: number) => string;
  /** Host-supplied child content. Optional; omitted unless supplied by the host or backend. */
  children?: ReactNode;
  /** Whether the host is refreshing the summary. Optional; omitted unless supplied by the host or backend. */
  busy?: boolean;
}) {
  return (
    <aside className="sv-shop-summary" aria-busy={busy}>
      <h2>{title}</h2>
      <div>
        {rows.map((r) => (
          <p key={r.label}>
            <span>{r.label}</span>
            <span>
              {r.isFrom ? "ab " : ""}
              {formatPrice(r.amount)}
            </span>
          </p>
        ))}
        <p className="sv-shop-total">
          <strong>{totalLabel}</strong>
          <strong>{formatPrice(total)}</strong>
        </p>
        {children}
      </div>
    </aside>
  );
}
/** Render host-owned checkout step navigation. A complete checkout flow is not provided. */
export function ShopCheckoutSteps({
  label,
  steps,
}: {
  /** Accessible customer-visible label. */
  label: string;
  /** Host-owned checkout steps and current state. */
  steps: {
    /** Accessible customer-visible label. */
    label: string;
    /** Host navigation URL. */
    href: string;
    /** Current in the shop checkout steps contract. Optional; omitted unless supplied by the host or backend. */
    current?: boolean;
  }[];
}) {
  return (
    <nav aria-label={label} className="sv-shop-steps">
      <ol>
        {steps.map((s, i) => (
          <li key={s.href}>
            <a href={s.href} aria-current={s.current ? "step" : undefined}>
              <span>{i + 1}</span>
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
/** Render product or legal declarations supplied by the host. */
export function ShopDeclarations({
  title,
  rows,
}: {
  /** Customer-visible heading or title supplied by the host. */
  title: string;
  /** Host summary or declaration rows. */
  rows: {
    /** Accessible customer-visible label. */
    label: string;
    /** Current controlled value. */
    value: string;
  }[];
}) {
  return (
    <section className="sv-shop-declarations">
      <h2>{title}</h2>
      <dl>
        {rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
