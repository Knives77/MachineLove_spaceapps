// Icono animado de lucide-animated (https://lucide-animated.com/icons/play, MIT), basado en Lucide (ISC).
// Ajustes locales: sin `cn` de shadcn y contenedor <span> en vez de <div> (va dentro de botones).
// Se anima desde el botón padre con el ref (startAnimation / stopAnimation): ver useIconAnim.
import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes, MouseEvent as ReactMouseEvent } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

export interface PlayIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface PlayIconProps extends HTMLAttributes<HTMLSpanElement> {
  size?: number;
}

const PATH_VARIANTS: Variants = {
  normal: {
    x: 0,
    rotate: 0,
  },
  animate: {
    x: [0, -1, 2, 0],
    rotate: [0, -10, 0, 0],
    transition: {
      duration: 0.5,
      times: [0, 0.2, 0.5, 1],
      stiffness: 260,
      damping: 20,
    },
  },
};

const PlayIcon = forwardRef<PlayIconHandle, PlayIconProps>(
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
        <motion.svg
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
          <motion.polygon
            animate={controls}
            points="6 3 20 12 6 21 6 3"
            variants={PATH_VARIANTS}
          />
        </motion.svg>
      </span>
    );
  }
);

PlayIcon.displayName = "PlayIcon";

export { PlayIcon };
