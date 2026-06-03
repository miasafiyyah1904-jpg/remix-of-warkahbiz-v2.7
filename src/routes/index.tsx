import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import Index from "@/pages/Index";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "WarkahBiz — Asisten F&B Pintar" },
      {
        name: "description",
        content:
          "WarkahBiz: rakan kongsi pintar untuk peniaga F&B — log jualan, stok, ramalan, AI dan banyak lagi.",
      },
    ],
  }),
  component: ProtectedIndex,
});

function ProtectedIndex() {
  const navigate = useNavigate();
  const { userId, loading } = useAuth();

  useEffect(() => {
    if (!loading && !userId) navigate({ to: "/login", replace: true });
  }, [loading, navigate, userId]);

  if (loading || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return <Index key={userId} />;
}
