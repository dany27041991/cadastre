/**
 * Shared UI building blocks on dxc-webkit.
 * Aligned with cu1.5-fe-MVP3-local for consistency across the MASE ecosystem.
 */
import { Box, icons } from "dxc-webkit";
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
}

export const Button: FC<ButtonProps> = ({
  title,
  iconName,
  onClick,
  danger,
  disabled,
}) => {
  const IconComponent = icons[iconName];
  return (
    <Box
      as="div"
      className={`ui-components-button my-2 ${disabled ? "my-disabled" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => e.key === "Enter" && !disabled && onClick?.()}
    >
      {IconComponent && (
        <span
          className={disabled ? "my-disabled" : ""}
          style={{ marginRight: "12px", marginTop: "-12px" }}
        >
          <IconComponent
            className={disabled ? "my-disabled" : ""}
            color="primary"
            size="xs"
            title={title}
          />
        </span>
      )}
      {title}
    </Box>
  );
};

export const ButtonInv: FC<ButtonProps> = ({
  title,
  iconName,
  onClick,
  style,
  danger,
}) => {
  const IconComponent = icons[iconName];
  const className = danger
    ? "ui-components-button-danger"
    : "ui-components-button-inv";
  return (
    <Box as="div" style={style} className={`${className} my-2`} onClick={onClick}>
      {IconComponent && (
        <span style={{ marginRight: "12px", marginTop: "-12px" }}>
          <IconComponent color="white" size="xs" title={title} />
        </span>
      )}
      {title}
    </Box>
  );
};

export const Line: FC = () => (
  <hr style={{ borderColor: "var(--ol-subtle-foreground-color, #ccc)" }} />
);

export const Spinner: FC<{ size?: "s" | "m" | "l" }> = () => (
  <Box as="div" className="progress-spinner progress-spinner-active" role="status">
    <span className="visually-hidden">Caricamento...</span>
  </Box>
);

export { DummyIcon };
