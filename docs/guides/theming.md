# Theming

Import `@shopvento/ui/styles.css` for booking and account, and add `@shopvento/ui/shop.css` for shop primitives. Selectors are scoped; the package ships no global reset or styling runtime. Use `EventColors` and `eventStyle` for per-event calendar colors.

## Scope and precedence

The compact `.sv-booking` form reads inherited properties with inline CSS fallbacks. The calendar/flow `.sv-redesign` scope declares its own defaults, so override tokens on that same element, after the package CSS. Account and shop surfaces read inherited tokens; their selectors do not initialize a full theme.

A host wrapper can also carry `.sv-redesign` to initialize its tokens around account/shop surfaces. Put optional host-only tokens on that wrapper too. For an account or shop surface without that scope, define all properties that its styles read.

```css
.storefront.sv-redesign {
  --sv-font: "Trebuchet MS", sans-serif;
  --sv-background: #fff;
  --sv-text: #351c45;
  --sv-primary: #351c45;
  --sv-primary-hover: #24122f;
  --sv-on-primary: #fff;
  --sv-accent: #b63b2b;
  --sv-accent-fill: #b63b2b;
  --sv-accent-soft: #fff0ed;
  --sv-accent-strong: #922d20;
  --sv-info: #225388;
  --sv-photo-overlay: #351c45cc;
  --sv-voucher-bg: #351c45;
  --sv-voucher-2-bg: #643c6a;
  --sv-voucher-3-bg: #54416c;
  --sv-voucher-ink: #fff;
  --sv-warm: #f7f3f5;
}
```

## Typography and spacing

The defaults below are declared on `.sv-redesign` unless a scope is specified. A dash means the property is unset: supply it on the host, or its CSS declaration has no valid value.

| Property | Default | Purpose |
| --- | --- | --- |
| `--sv-font` | `system-ui, sans-serif` | Body and control family |
| `--sv-font-display` | `var(--sv-font)` | Display headings |
| `--sv-font-label` | `var(--sv-font)` | Labels and compact metadata |
| `--sv-display-weight` | `600` | Display heading weight |
| `--sv-accent-style` | `normal` | Emphasized heading font style |
| `--sv-label-size` | `12px` | Small label size |
| `--sv-label-spacing` | `0.08em` | Label tracking |
| `--sv-label-case` | `uppercase` | Label text transformation |
| `--sv-space` | `1rem` (compact fallback) | Compact form section spacing |
| `--sv-padding` | `1.25rem` (compact fallback) | Compact form outer padding |
| `--sv-radius` | `4px`; compact fallback `0.5rem` | Controls and small surfaces |
| `--sv-radius-lg` | `6px` | Larger surfaces and dialogs |
| `--sv-shadow` | `none` | Card shadow |
| `--sv-shadow-lg` | `0 18px 60px #0003` | Modal shadow |

## Color

| Property | Default | Purpose |
| --- | --- | --- |
| `--sv-background` | `#fff` | Main background |
| `--sv-surface` | `#fff`; compact fallback `#f7f3f5` | Raised/subtle surface |
| `--sv-surface-2` | `#f5f5f5` | Secondary surface |
| `--sv-surface-3` | `#eee` | Tertiary surface |
| `--sv-text` | `#202020`; compact fallback `#241a20` | Primary text |
| `--sv-text-2` | `#505050` | Secondary text |
| `--sv-text-3` | `#767676` | Muted metadata |
| `--sv-primary` | `#202020`; compact fallback `#752844` | Primary action/background |
| `--sv-primary-hover` | `#000` | Primary hover background |
| `--sv-on-primary` | `#fff` | Text on a primary fill |
| `--sv-border` | `#ddd`; compact fallback `#c9bdc3` | Main borders |
| `--sv-border-2` | `#eee` | Subtle separators |
| `--sv-input-border` | `var(--sv-border, #c9bdc3)` (fallback) | Account field border override |
| `--sv-accent` | `#202020` | Links, labels and event accent |
| `--sv-accent-fill` | `#202020` | Filled accent controls |
| `--sv-accent-soft` | `#eee` | Subtle accent backgrounds |
| `--sv-accent-strong` | `#202020` | Strong accent text |
| `--sv-success` | `#35613d` | Success text and accents |
| `--sv-success-soft` | `#e9efdd` | Success background |
| `--sv-warning` | `#854418` | Warning text and accents |
| `--sv-warning-soft` | `#fceadb` | Warning background |
| `--sv-error` | `#a51d32` | Error text, fields and actions |
| `--sv-error-soft` | `#fbe6e9` | Error background |
| `--sv-info` | Unset | Informational text; host must supply |
| `--sv-info-soft` | `#eee`; shop fallback `var(--sv-surface-2)` | Information background |
| `--sv-focus` | `#286ab2`; compact fallback `#155fc0` | Visible keyboard focus |
| `--sv-event` | Unset; calendar falls back to its current event color, then `--sv-primary` where applicable | Per-event tile, dot and outline |
| `--sv-voucher-accent` | `var(--sv-accent)` | Voucher highlight |
| `--sv-photo-overlay` | Unset | Account event-photo overlay |
| `--sv-voucher-bg` | Unset | First account voucher card fill |
| `--sv-voucher-2-bg` | Unset | Second voucher card fill |
| `--sv-voucher-3-bg` | Unset | Third voucher card fill |
| `--sv-voucher-ink` | Unset | Voucher card text and code |
| `--sv-warm` | Unset | Account voucher supplemental surface |
| `--sv-product-cap` | `var(--sv-primary)` (illustration fallback) | Shop illustration cap fill |
| `--sv-product-fill` | `#3e4d29` (illustration fallback) | Shop product illustration fill |

`eventStyle(color)` sets the event color on a particular item. `colors` on date lists and calendars is keyed by the public event ID. The [migration note](/guides/labels/#migration-from-01) explains compatibility names once.

## Button state properties

Dashboard selectors write these properties on each button or action. They are component state values, rather than a global palette; a variant can override an ancestor value. All are included here because they use the public prefix.

| Property | Default | Purpose |
| --- | --- | --- |
| `--sv-button-bg` | `transparent` on base buttons; primary, accent and surface variants set their own fill | Button background |
| `--sv-button-fg` | `var(--sv-text)` on base buttons; variants select primary, error or on-primary text | Button text |
| `--sv-button-bd` | `var(--sv-text)` on base buttons; variants select their border | Button border |
| `--sv-button-c` | Fallback `var(--sv-accent-fill)` for fills, `var(--sv-accent)` for text; status variants use error/success/warning | Compact action color |
| `--sv-button-soft` | Fallback `var(--sv-accent-soft)`; status variants use their soft color | Compact action background |

## Dark themes

The package does not switch themes automatically. Override the same tokens under the host dark-mode selector, including surfaces, text, borders, status backgrounds and focus. Check the contrast of host event colors and product images in both modes. Keep visible keyboard focus and readable disabled and error states.

## Shop flow and public forms

The flow adds `--sv-flow-border` for its structural borders (falling back to `--sv-border-2`) and `--sv-surface-3` for outer checkout/cart surfaces. Reservation and newsletter scopes are `.sv-reservation` and `.sv-newsletter`; set their standard `--sv-font`, `--sv-font-display`, `--sv-font-label`, `--sv-background`, `--sv-surface-2`, `--sv-text`, `--sv-text-2`, `--sv-text-3`, `--sv-border-2`, `--sv-primary`, `--sv-accent` and `--sv-error-soft` tokens on those scopes. Hosts migrating an existing layout can retain its token bridge. Responsive form grids ship with `forms.css` (also included by `shop.css`) and do not require Tailwind.
