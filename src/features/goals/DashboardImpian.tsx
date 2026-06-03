import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Plus, Loader2, Trash2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { fmt } from "@/lib/format";
import { addSavings, deleteImpian, listImpian, type GoalType, type Impian } from "./impianApi";

const GOAL_META: Record<GoalType, { emoji: string; label: string }> = {
  machine: { emoji: "🏭", label: "Mesin / Peralatan" },
  sales:   { emoji: "📈", label: "Tingkatkan Jualan" },
  branch:  { emoji: "🏠", label: "Cawangan Baru" },
};

const addressBoss = (n: string) => (n?.trim() ? n.trim() : "Boss");

export function DashboardImpian({
  onClose,
  onNewGoal,
  businessName,
}: {
  onClose: () => void;
  onNewGoal: () => void;
  businessName: string;
}) {
  const boss = addressBoss(businessName);
  const [goals, setGoals] = useState<Impian[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [addTarget, setAddTarget] = useState<Impian | null>(null);

  const reload = async () => {
    try {
      const rows = await listImpian();
      setGoals(rows);
    } catch (e) {
      console.error(e);
      toast.error("Gagal muat impian. Cuba lagi.");
      setGoals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteImpian(id);
      setGoals((prev) => prev?.filter((g) => g.id !== id) ?? null);
      toast.success("Impian dipadam");
    } catch {
      toast.error("Gagal padam impian.");
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto animate-fade-in">
      <div className="mx-auto w-full max-w-full sm:max-w-[600px] md:max-w-[760px] lg:max-w-[960px] xl:max-w-[1140px] 2xl:max-w-[1280px] min-h-screen bg-background pb-32">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted tap" aria-label="Tutup">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-extrabold leading-tight">Impian Bisnes {boss}</h1>
            <p className="text-xs text-muted-foreground">Senarai matlamat aktif</p>
          </div>
        </header>

        <div className="px-4 py-5 space-y-4">
          {loading ? (
            <div className="grid place-items-center py-20 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : goals && goals.length > 0 ? (
            <>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Senarai Impian Aktif
              </h2>
              <div className="space-y-3">
                {goals.map((g) => (
                  <ImpianCard
                    key={g.id}
                    goal={g}
                    onAdd={() => setAddTarget(g)}
                    onDelete={() => handleDelete(g.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <EmptyState boss={boss} onNewGoal={onNewGoal} />
          )}
        </div>

        {/* Sticky FAB for new goal */}
        {goals && goals.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-[440px] px-4">
            <Button
              onClick={onNewGoal}
              className="w-full h-14 rounded-2xl text-base font-bold bg-gradient-profit text-profit-foreground shadow-fab"
            >
              <Sparkles className="w-5 h-5 mr-2" /> Bina Impian Baru
            </Button>
          </div>
        )}
      </div>

      <AddSavingsDialog
        goal={addTarget}
        onClose={() => setAddTarget(null)}
        onSaved={(updated) => {
          setGoals((prev) => prev?.map((g) => (g.id === updated.id ? updated : g)) ?? null);
          setAddTarget(null);
        }}
      />
    </div>
  );
}

function ImpianCard({
  goal, onAdd, onDelete,
}: { goal: Impian; onAdd: () => void; onDelete: () => void }) {
  const meta = GOAL_META[goal.goal_type] ?? { emoji: "🎯", label: goal.goal_type };
  const target = Number(goal.target_amount);
  const saved = Number(goal.current_saved);
  const pct = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
  const remaining = Math.max(target - saved, 0);
  const monthsLeft =
    goal.selected_plan && goal.selected_plan.monthly > 0
      ? Math.ceil(remaining / goal.selected_plan.monthly)
      : null;

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-3 shadow-card">
      <div className="flex items-start gap-3">
        <div className="text-3xl leading-none">{meta.emoji}</div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold leading-tight truncate">{goal.goal_name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wider">{meta.label}</p>
        </div>
        <button
          onClick={onDelete}
          className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted tap text-muted-foreground"
          aria-label="Padam"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
          <span>{fmt(saved)}</span>
          <span className="text-muted-foreground">{fmt(target)} ({pct.toFixed(0)}%)</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-gradient-profit transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Baki <span className="font-bold text-foreground">{fmt(remaining)}</span>
          {monthsLeft !== null && remaining > 0 && (
            <> · ~{monthsLeft} bulan lagi pada {fmt(goal.selected_plan!.monthly)}/bln</>
          )}
        </p>
      </div>

      <Button
        onClick={onAdd}
        className="w-full h-11 rounded-xl font-bold bg-gradient-profit text-profit-foreground"
        disabled={remaining <= 0}
      >
        <Plus className="w-4 h-4 mr-1" /> Tambah Simpanan
      </Button>
    </div>
  );
}

function EmptyState({ boss, onNewGoal }: { boss: string; onNewGoal: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="w-24 h-24 rounded-full bg-primary/10 grid place-items-center mb-5">
        <Target className="w-12 h-12 text-primary" />
      </div>
      <h3 className="text-lg font-extrabold leading-tight">
        {boss} belum ada impian aktif.
      </h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-xs">
        Mari cipta sasaran pertama hari ini! AI bantu pecahkan kepada langkah-demi-langkah.
      </p>
      <Button
        onClick={onNewGoal}
        className="mt-6 h-14 px-6 rounded-2xl text-base font-bold bg-gradient-profit text-profit-foreground shadow-fab"
      >
        <Sparkles className="w-5 h-5 mr-2" /> Bina Impian Baru
      </Button>
    </div>
  );
}

function AddSavingsDialog({
  goal, onClose, onSaved,
}: {
  goal: Impian | null;
  onClose: () => void;
  onSaved: (updated: Impian) => void;
}) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setAmount(""); }, [goal?.id]);

  if (!goal) return null;
  const remaining = Math.max(Number(goal.target_amount) - Number(goal.current_saved), 0);

  const submit = async () => {
    const delta = Number(amount);
    if (!delta || delta <= 0) {
      toast.error("Masukkan jumlah lebih besar dari 0");
      return;
    }
    setSaving(true);
    try {
      const updated = await addSavings(goal.id, delta);
      toast.success(`+${fmt(delta)} ditambah ke "${goal.goal_name}" 🎉`);
      onSaved(updated);
    } catch (e) {
      console.error(e);
      toast.error("Gagal kemaskini simpanan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!goal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="rounded-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Tambah Simpanan</DialogTitle>
          <DialogDescription>
            {goal.goal_name} · Baki {fmt(remaining)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">Jumlah (RM)</Label>
          <Input
            type="number"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Contoh: 100"
            className="h-12 rounded-xl"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Batal</Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="rounded-xl bg-gradient-profit text-profit-foreground font-bold"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
