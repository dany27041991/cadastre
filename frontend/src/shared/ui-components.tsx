/**
 * Shared UI building blocks on dxc-webkit.
 * Aligned with cu1.5-fe SelezionaAOI / ui-components for visual parity.
 */
import { Box, Loader, icons } from "dxc-webkit";
import type { FC } from "react";

interface SVGRProps {
  className?: string;
}

const DummyIcon: FC<SVGRProps> = (props) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect width="16" height="16" fill="#ccc" />
  </svg>
);

export interface ButtonProps {
  title: string;
  iconName: keyof typeof icons;
  onClick?: () => void;
  style?: React.CSSProperties;
  danger?: boolean;
  disabled?: boolean;
  /** Selected look (same as hover / filled primary). */
  selected?: boolean;
  right?: React.ReactNode;
  /** Icon size token (dxc: xs=24px, sm=32px). Default xs. */
  iconSize?: "xs" | "sm" | "md" | "lg" | "xl" | "auto";
  /** stroke = outline icons; fill = silhouettes (e.g. UnitaAmministrativeIcon). */
  iconPaint?: "stroke" | "fill";
}

export const Button: FC<ButtonProps> = ({
  title,
  iconName,
  onClick,
  disabled,
  selected,
  right,
  iconSize = "xs",
  iconPaint = "stroke",
}) => {
  const IconComponent = icons[iconName];
  const paint = selected ? "white" : "primary";
  return (
    <Box
      as="div"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
      className={`ui-components-button my-2${disabled ? " my-disabled" : ""}${selected ? " is-selected" : ""}${iconPaint === "fill" ? " ui-components-button--fill-icon" : ""}`}
      onClick={disabled ? undefined : onClick}
      role="button"
      aria-pressed={selected}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => e.key === "Enter" && !disabled && onClick?.()}
    >
      <Box
        as="div"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        {IconComponent && (
          <span className="ui-components-button__icon" style={{ display: "inline-flex", flexShrink: 0 }}>
            {iconPaint === "fill" ? (
              <IconComponent fill={paint} stroke="transparent" size={iconSize} title={title} />
            ) : (
              <IconComponent stroke={paint} fill="transparent" size={iconSize} title={title} />
            )}
          </span>
        )}
        {title}
      </Box>
      {right}
    </Box>
  );
};

export const ButtonInv: FC<ButtonProps> = ({
  title,
  iconName,
  onClick,
  style,
  danger,
  disabled,
}) => {
  const IconComponent = icons[iconName];
  const className = danger
    ? "ui-components-button-danger"
    : "ui-components-button-inv";
  return (
    <Box
      as="div"
      style={{
        ...style,
        opacity: disabled ? 0.45 : 1,
        pointerEvents: disabled ? "none" : "auto",
        cursor: disabled ? "default" : "pointer",
      }}
      className={`${className} my-2`}
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
    >
      {IconComponent && (
        <span style={{ marginRight: "12px", marginTop: "-12px" }}>
          <IconComponent stroke="white" size="xs" title={title} />
        </span>
      )}
      {title}
    </Box>
  );
};

export const Line: FC = () => (
  <hr style={{ borderColor: "var(--ol-subtle-foreground-color, #ccc)" }} />
);

const SPINNER_SIZE_MAP = { s: "sm", m: "md", l: "lg" } as const;

export type SpinnerSize = keyof typeof SPINNER_SIZE_MAP;

export type SpinnerProps = {
  readonly size?: SpinnerSize;
  readonly ariaLabel?: string;
};

/** Loading indicator backed by the dxc-webkit Loader (circle, green). */
export const Spinner: FC<SpinnerProps> = ({
  size = "m",
  ariaLabel = "Caricamento",
}) => (
  <Loader
    type="circle"
    size={SPINNER_SIZE_MAP[size]}
    value={50}
    showPercentage={false}
    className="green-circle-loader"
    ariaLabelProgressBar={ariaLabel}
  />
);

export { DummyIcon };
