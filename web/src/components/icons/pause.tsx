// Icono animado de lucide-animated (https://lucide-animated.com/icons/pause, MIT), basado en Lucide (ISC).
// Ajustes locales: sin `cn` de shadcn y contenedor <span> en vez de <div> (va dentro de botones).
// Se anima desde el botón padre con el ref (startAnimation / stopAnimation): ver useIconAnim.
import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes, MouseEvent as ReactMouseEvent } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

export interface PauseIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface PauseIconProps extends HTMLAttributes<HTMLSpanElement> {
  size?: number;
}

const BASE_RECT_VARIANTS: Variants = {
  normal: {
    y: 0,
  },
};

const BASE_RECT_TRANSITION = {
  transition: {
    times: [0, 0.2, 0.5, 1],
    duration: 0.5,
    stiffness: 260,
    damping: 20,
  },
};

const LEFT_RECT_VARIANTS: Variants = {
  ...BASE_RECT_VARIANTS,
  animate: {
    y: [0, 2, 0, 0],
    ...BASE_RECT_TRANSITION,
  },
};

const RIGHT_RECT_VARIANTS: Variants = {
  ...BASE_RECT_VARIANTS,
  animate: {
    y: [0, 0, 2, 0],
    ...BASE_RECT_TRANSITION,
  },
};

const PauseIcon = forwardRef<PauseIconHandle, PauseIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      (e: ReactMouseEvent<HTMLSpanElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          controls.start("animate");
        }
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: ReactMouseEvent<HTMLSpanElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start("normal");
        }
      },
      [controls, onMouseLeave]
    );

    return (
      <span
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.rect
            animate={controls}
            height="16"
            rx="1"
            variants={LEFT_RECT_VARIANTS}
            width="4"
            x="6"
            y="4"
          />
          <motion.rect
            animate={controls}
            height="16"
            rx="1"
            variants={RIGHT_RECT_VARIANTS}
            width="4"
            x="14"
            y="4"
          />
        </svg>
      </span>
    );
  }
);

PauseIcon.displayName = "PauseIcon";

export { PauseIcon };
