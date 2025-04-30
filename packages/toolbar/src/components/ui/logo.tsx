import { type FC, type HTMLAttributes } from "react";

export type LogoColor =
  | "default"
  | "black"
  | "white"
  | "gray"
  | "current"
  | "gradient";

export type LoadingSpeed = "slow" | "fast";

export interface LogoProps extends HTMLAttributes<HTMLDivElement> {
  color?: LogoColor;
  loading?: boolean;
  loadingSpeed?: LoadingSpeed;
}

export const Logo: FC<LogoProps> = ({
  color = "default",
  loading = false,
  loadingSpeed = "slow",
  ...props
}) => {
  const colorStyle: Record<LogoColor, string> = {
    default: "fill-stagewise-700 stroke-none",
    black: "fill-zinc-950 stroke-none",
    white: "fill-white stroke-none",
    gray: "fill-zinc-500/50 stroke-none",
    current: "fill-current stroke-none",
    gradient: "fill-white stroke-black/30 stroke-1",
  };
  return (
    <div
      className={`relative ${
        color === "gradient"
          ? "rounded-full overflow-hidden"
          : "overflow-visible"
      } ${props.className || ""} ${
        loading ? "drop-shadow-xl" : ""
      } aspect-square`}
    >
      {color === "gradient" && (
        <>
          <div className="absolute inset-0">
            <div className="absolute size-full inset-0 bg-gradient-to-tr from-indigo-600 to-emerald-400" />
            <div className="absolute size-9/12 top-1/2 left-1/2 bg-[radial-gradient(circle,rgba(219,39,119,0.2)_0%,rgba(219,39,119,0)_100%)]" />
            <div className="absolute size-full bottom-1/2 right-1/2 bg-[radial-gradient(circle,rgba(219,39,119,0.2)_0%,rgba(219,39,119,0)_100%)]" />
            <div className="absolute size-full inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0)_60%,rgba(255,255,255,0.2)_70%)]" />
            <div className="absolute w-full h-[120%] top-[-20%] left-0 bg-[radial-gradient(circle,rgba(55,48,163,0)_55%,rgba(55,48,163,0.35)_73%)]" />
          </div>
        </>
      )}
      <svg
        className={`absolute overflow-visible ${
          color === "gradient"
            ? "left-[25%] top-[25%] h-[50%] w-[50%]"
            : "left-0 top-0 h-full w-full"
        }`}
        viewBox="0 0 2048 2048"
      >
        <title>stagewise</title>
        <ellipse
          className={colorStyle[color] + (loading ? " animate-pulse" : "")}
          id="path3"
          ry="624"
          rx="624"
          cy="1024"
          cx="1024"
        />
      </svg>
      <svg
        className={`absolute overflow-visible ${
          color === "gradient"
            ? "left-[25%] top-[25%] h-[50%] w-[50%]"
            : "left-0 top-0 h-full w-full"
        }`}
        viewBox="0 0 2048 2048"
      >
        <path
          id="path4"
          className={
            "origin-center " +
            colorStyle[color] +
            (loading
              ? loadingSpeed === "fast"
                ? " animate-spin-fast"
                : " animate-spin-slow"
              : "")
          }
          d="M 1024 0 A 1024 1024 0 0 0 0 1024 A 1024 1024 0 0 0 1024 2048 L 1736 2048 L 1848 2048 C 1958.7998 2048 2048 1958.7998 2048 1848 L 2048 1736 L 2048 1024 A 1024 1024 0 0 0 1024 0 z M 1024.9414 200 A 824 824 0 0 1 1848.9414 1024 A 824 824 0 0 1 1024.9414 1848 A 824 824 0 0 1 200.94141 1024 A 824 824 0 0 1 1024.9414 200 z "
        />
      </svg>
    </div>
  );
};
