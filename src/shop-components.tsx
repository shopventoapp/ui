"use client";
import { type ReactNode, useEffect, useId, useRef } from "react";

export type ShopProduct = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  producer?: string;
  price: number;
  unitPrice?: string;
  quantityInformation?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  placeholder?: "bottle" | "jar" | "gift";
  tint?: string;
  illustrationColor?: string;
  illustrationCapColor?: string;
  badges?: string[];
  badgeTones?: Record<string, "accent" | "success">;
  availability?: string;
  unavailable?: boolean;
  customerDefinedPrice?: boolean;
  minimumPrice?: number;
  withdrawalExcluded?: boolean;
  withdrawalNotice?: string;
  pickupOnly?: boolean;
  adultOnly?: boolean;
  category: string;
  variants?: {
    id: string;
    name: string;
    price: number;
    adultOnly?: boolean;
    unitPrice?: string;
  }[];
  declarations?: { label: string; value: string }[];
};
export function ShopSurface({ children }: { children: ReactNode }) {
  return <div className="sv-shop">{children}</div>;
}
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
export function ShopNotice({
  children,
  error = false,
}: {
  children: ReactNode;
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
export function ShopEmpty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
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
export function ShopNavigation({
  label,
  links,
  searchLabel,
  searchPlaceholder,
  searchAction,
  query,
}: {
  label: string;
  links: { label: string; href: string; current?: boolean }[];
  searchLabel: string;
  searchPlaceholder: string;
  searchAction: string;
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
export function ShopHero({
  eyebrow,
  title,
  description,
  actions,
  image,
  imageAlt,
  note,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  actions: ReactNode;
  image: string;
  imageAlt: string;
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
export function ShopSection({
  title,
  link,
  children,
}: {
  title: ReactNode;
  link?: ReactNode;
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
export function ShopMedia({ product }: { product: ShopProduct }) {
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
export function ShopPrice({
  amount,
  formatPrice,
  unitPrice,
  taxLabel,
  shippingLabel,
  shippingHref,
}: {
  amount: number;
  formatPrice: (amount: number) => string;
  unitPrice?: string;
  taxLabel?: string;
  shippingLabel?: string;
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
  product: ShopProduct;
  href: string;
  formatPrice: (amount: number) => string;
  addLabel: string;
  onAdd?: () => void;
  addDisabled?: boolean;
  taxLabel?: string;
  shippingLabel?: string;
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
export function ShopProductGrid({
  children,
  rail = false,
}: {
  children: ReactNode;
  rail?: boolean;
}) {
  return <ul className={rail ? "sv-shop-rail" : "sv-shop-grid"}>{children}</ul>;
}
export function ShopQuantity({
  value,
  onChange,
  label,
  decreaseLabel,
  increaseLabel,
  max = 99,
  min = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  max?: number;
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
export function ShopDialog({
  title,
  closeLabel,
  children,
  onClose,
  variant = "drawer",
}: {
  title: string;
  closeLabel: string;
  children: ReactNode;
  onClose: () => void;
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
export function ShopSummary({
  title,
  rows,
  totalLabel,
  total,
  formatPrice,
  children,
  busy,
}: {
  title: string;
  rows: { label: string; amount: number; isFrom?: boolean }[];
  totalLabel: string;
  total: number;
  formatPrice: (amount: number) => string;
  children?: ReactNode;
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
export function ShopCheckoutSteps({
  label,
  steps,
}: {
  label: string;
  steps: { label: string; href: string; current?: boolean }[];
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
export function ShopDeclarations({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string }[];
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
