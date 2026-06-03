import { useTranslation } from "@/hooks/useTranslation.js";

/**
 * @param {{ size?: "lg" | "sm"; showName?: boolean; className?: string }} props
 */
export default function AppLogo({ size = "lg", showName = false, className = "" }) {
  const { t } = useTranslation();
  const isLg = size === "lg";
  const imgClass = isLg ? "h-16 w-auto" : "h-8 w-auto";

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <img src="/warkahbiz-logo.png" alt="WarkahBiz" className={imgClass} />
      {showName ? (
        <span className="mt-2 text-lg font-bold tracking-tight text-[#0F172A] dark:text-slate-100">{t("appName")}</span>
      ) : null}
    </div>
  );
}
