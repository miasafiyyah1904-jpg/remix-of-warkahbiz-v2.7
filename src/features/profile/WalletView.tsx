import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus, X, Star, Trash2, Pencil, ShieldCheck, Smartphone, Building2, ChevronDown, ArrowLeft, QrCode, Upload,
} from "lucide-react";
import type { SavedCard, PaymentMethodType } from "@/types";
import { useUserKey } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";

const QR_STORAGE_KEY_BASE = "warkahbiz_payment_qr";

const EWALLET_PROVIDERS = [
  "Touch 'n Go eWallet",
  "GrabPay",
  "Boost",
  "MAE by Maybank",
  "ShopeePay",
  "BigPay",
  "Lain-lain",
] as const;

const BANKS = [
  "Maybank", "CIMB Bank", "Public Bank", "RHB Bank", "Hong Leong Bank",
  "AmBank", "Bank Islam", "Bank Rakyat", "BSN", "OCBC Bank",
  "Standard Chartered", "HSBC", "Alliance Bank", "Affin Bank", "Lain-lain",
] as const;

function TypeIcon({ type }: { type: PaymentMethodType }) {
  if (type === "ewallet") return <Smartphone className="w-5 h-5" />;
  return <Building2 className="w-5 h-5" />;
}

function CardDisplay({ card, onEdit, onDelete, onSetPrimary }: {
  card: SavedCard;
  onEdit: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
}) {
  const { t } = useTranslation();

  const title = () => {
    if (card.type === "ewallet") return card.nickname || card.ewalletProvider || "E-Wallet";
    return card.nickname || card.bankName || t("wv_bankAccount");
  };

  const subtitle = () => {
    if (card.type === "ewallet") {
      return card.ewalletPhone ? `📱 ${card.ewalletPhone}` : card.ewalletProvider || "";
    }
    return card.accountNumber
      ? t("wv_accountMasked").replace("{{last4}}", card.accountNumber.slice(-4))
      : card.bankName || "";
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl bg-surface border ${card.isPrimary ? "border-primary" : "border-border"}`}>
      <div className="w-11 h-11 rounded-xl bg-gradient-profit text-profit-foreground grid place-items-center shrink-0">
        <TypeIcon type={card.type} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold truncate">{title()}</span>
          {card.isPrimary && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-gradient-profit text-profit-foreground">
              <Star className="w-3 h-3 fill-current" /> {t("wv_primary")}
            </span>
          )}
        </div>
        {subtitle() && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle()}</div>
        )}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        {!card.isPrimary && (
          <button onClick={onSetPrimary} className="w-8 h-8 rounded-lg bg-background border border-border grid place-items-center tap" aria-label={t("wv_setPrimary")}>
            <Star className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={onEdit} className="w-8 h-8 rounded-lg bg-background border border-border grid place-items-center tap" aria-label="Edit">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="w-8 h-8 rounded-lg bg-background border border-border grid place-items-center tap text-cost" aria-label={t("deleteBtn")}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function QRSection() {
  const { t } = useTranslation();
  const QR_STORAGE_KEY = useUserKey(QR_STORAGE_KEY_BASE);
  const [qr, setQr] = useState<string>("");
  const [qrLoadedKey, setQrLoadedKey] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!QR_STORAGE_KEY) {
      setQr("");
      setQrLoadedKey(null);
      return;
    }
    try { setQr(localStorage.getItem(QR_STORAGE_KEY) || ""); } catch { setQr(""); }
    setQrLoadedKey(QR_STORAGE_KEY);
  }, [QR_STORAGE_KEY]);

  useEffect(() => {
    if (!QR_STORAGE_KEY || qrLoadedKey !== QR_STORAGE_KEY) return;
    try {
      if (qr) localStorage.setItem(QR_STORAGE_KEY, qr);
      else localStorage.removeItem(QR_STORAGE_KEY);
    } catch {}
  }, [QR_STORAGE_KEY, qrLoadedKey, qr]);

  const pick = () => fileRef.current?.click();

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error(t("wv_selectImageFile")); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error(t("wv_fileTooLarge")); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setQr(String(reader.result || ""));
      toast.success(t("wv_qrSaved"));
    };
    reader.onerror = () => toast.error(t("wv_fileReadError"));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider ml-1">{t("wv_myPaymentQR")}</div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] || null)}
      />
      {!qr ? (
        <button
          onClick={pick}
          className="w-full rounded-2xl border-2 border-dashed border-border bg-surface p-6 flex flex-col items-center justify-center gap-2 tap hover:border-primary transition-colors"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-profit text-profit-foreground grid place-items-center">
            <QrCode className="w-7 h-7" />
          </div>
          <div className="text-sm font-extrabold">{t("wv_uploadQR")}</div>
          <div className="text-[11px] text-muted-foreground text-center max-w-[240px]">
            {t("wv_qrScanHint")}
          </div>
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
            <Upload className="w-3.5 h-3.5" /> {t("wv_selectImage")}
          </div>
        </button>
      ) : (
        <div className="rounded-2xl bg-surface border border-border p-4 space-y-3">
          <div className="aspect-square w-full max-w-[260px] mx-auto rounded-xl overflow-hidden bg-background border border-border grid place-items-center">
            <img src={qr} alt={t("wv_paymentQR")} className="w-full h-full object-contain" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={pick}
              className="h-11 rounded-xl bg-background border border-border font-bold text-sm tap inline-flex items-center justify-center gap-1.5"
            >
              <Upload className="w-4 h-4" /> {t("wv_change")}
            </button>
            <button
              onClick={() => { setQr(""); toast.success(t("wv_qrDeleted")); }}
              className="h-11 rounded-xl bg-cost text-cost-foreground font-bold text-sm tap inline-flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> {t("deleteBtn")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const WalletView = ({
  cards,
  onSave,
  onDelete,
  onSetPrimary,
  onBack,
}: {
  cards: SavedCard[];
  onSave: (c: SavedCard) => void;
  onDelete: (id: string) => void;
  onSetPrimary: (id: string) => void;
  onBack: () => void;
}) => {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<SavedCard | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const visibleCards = cards.filter((c) => c.type !== "card");
  const byType = (type: PaymentMethodType) => visibleCards.filter((c) => c.type === type);

  const Section = ({ label, type }: { label: string; type: PaymentMethodType }) => {
    const items = byType(type);
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider ml-1">{label}</div>
        {items.map((c) => (
          <CardDisplay
            key={c.id}
            card={c}
            onEdit={() => { setEditing(c); setSheetOpen(true); }}
            onDelete={() => setDeleteConfirm(c.id)}
            onSetPrimary={() => onSetPrimary(c.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="pb-32 px-5 pt-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <button onClick={onBack} className="text-xs font-bold text-primary tap mb-1 inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> {t("wv_backToProfile")}
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("wv_myWallet")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {visibleCards.length === 0
              ? t("wv_noPaymentMethod")
              : t("wv_paymentMethodCount").replace("{{count}}", String(visibleCards.length))}
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setSheetOpen(true); }}
          className="w-11 h-11 rounded-2xl bg-gradient-profit text-profit-foreground grid place-items-center tap shadow-card"
          aria-label={t("wv_add")}
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-2xl bg-surface border border-border">
        <ShieldCheck className="w-4 h-4 text-profit shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {t("wv_localStorageNote")}
        </p>
      </div>

      <QRSection />

      {visibleCards.length === 0 && (
        <div className="text-center py-10 space-y-3">
          <div className="text-5xl">💳</div>
          <h3 className="text-base font-extrabold">{t("wv_savePaymentInfo")}</h3>
          <p className="text-xs text-muted-foreground max-w-[260px] mx-auto">
            {t("wv_addPaymentHint")}
          </p>
          <button
            onClick={() => { setEditing(null); setSheetOpen(true); }}
            className="mt-2 h-11 px-6 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap shadow-card"
          >
            {t("wv_addFirst")}
          </button>
        </div>
      )}

      {visibleCards.length > 0 && (
        <div className="space-y-5">
          <Section label="E-Wallet" type="ewallet" />
          <Section label={t("wv_bankAccount")} type="bank" />
        </div>
      )}

      {sheetOpen && (
        <CardSheet
          initial={editing}
          onClose={() => setSheetOpen(false)}
          onSave={(c) => {
            onSave(c);
            setSheetOpen(false);
            toast.success(editing ? t("wv_infoUpdated") : t("wv_paymentAdded"));
          }}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-sm bg-surface rounded-3xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold">{t("wv_deletePaymentConfirm")}</h3>
            <p className="text-xs text-muted-foreground">{t("wv_cannotUndo")}</p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => setDeleteConfirm(null)} className="tap h-11 rounded-xl border border-border font-semibold">{t("cancel")}</button>
              <button
                onClick={() => { onDelete(deleteConfirm); setDeleteConfirm(null); toast.success(t("wv_deleted")); }}
                className="tap h-11 rounded-xl bg-cost text-cost-foreground font-bold"
              >{t("deleteBtn")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function CardSheet({ initial, onClose, onSave }: {
  initial: SavedCard | null;
  onClose: () => void;
  onSave: (c: SavedCard) => void;
}) {
  const { t } = useTranslation();
  const initType: PaymentMethodType = initial?.type === "card" ? "ewallet" : (initial?.type || "ewallet");
  const [type, setType] = useState<PaymentMethodType>(initType);

  const [provider, setProvider]       = useState<string>(initial?.ewalletProvider || EWALLET_PROVIDERS[0]);
  const [ewalletPhone, setEwalletPhone] = useState(initial?.ewalletPhone || "");

  const [bankName, setBankName]         = useState<string>(initial?.bankName || BANKS[0]);
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber || "");
  const [accountHolder, setAccountHolder] = useState(initial?.accountHolder || "");

  const [nickname, setNickname] = useState(initial?.nickname || "");

  const handleSave = () => {
    if (type === "ewallet" && !ewalletPhone.trim()) {
      toast.error(t("wv_fillEwalletPhone")); return;
    }
    if (type === "bank") {
      if (!accountNumber.trim()) { toast.error(t("wv_fillAccountNumber")); return; }
      if (!accountHolder.trim()) { toast.error(t("wv_fillAccountHolder")); return; }
    }

    onSave({
      id: initial?.id || `card-${Date.now()}`,
      type,
      ewalletProvider: type === "ewallet" ? provider : undefined,
      ewalletPhone: type === "ewallet" ? ewalletPhone.trim() : undefined,
      bankName: type === "bank" ? bankName : undefined,
      accountNumber: type === "bank" ? accountNumber.trim() : undefined,
      accountHolder: type === "bank" ? accountHolder.trim() : undefined,
      nickname: nickname.trim() || undefined,
      isPrimary: initial?.isPrimary || false,
      createdAt: initial?.createdAt || new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-full sm:max-w-[600px] md:max-w-[760px] mx-auto bg-surface rounded-t-3xl p-5 pb-10 animate-slide-up max-h-[94vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold">{initial ? t("wv_editPaymentMethod") : t("wv_addPaymentMethod")}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-background border border-border grid place-items-center tap">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-background border border-border mb-4">
          {(["ewallet", "bank"] as PaymentMethodType[]).map((tp) => {
            const labels: Record<string, string> = { ewallet: "E-Wallet", bank: t("wv_bankAccount") };
            const icons: Record<string, React.ReactNode> = {
              ewallet: <Smartphone className="w-4 h-4" />,
              bank: <Building2 className="w-4 h-4" />,
            };
            return (
              <button
                key={tp}
                onClick={() => setType(tp)}
                className={`h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 tap transition-all text-[10px] font-bold ${type === tp ? "bg-gradient-profit text-profit-foreground shadow-card" : "text-muted-foreground"}`}
              >
                {icons[tp]}
                {labels[tp]}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {type === "ewallet" && (
            <>
              <Field label={t("wv_ewalletProvider")}>
                <div className="relative">
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full h-12 pl-4 pr-10 rounded-2xl bg-background border border-border text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {EWALLET_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
              </Field>
              <Field label={t("wv_phoneNumber")}>
                <input
                  value={ewalletPhone}
                  onChange={(e) => setEwalletPhone(e.target.value.replace(/[^0-9+\-\s]/g, "").slice(0, 20))}
                  placeholder="012-3456789"
                  className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </Field>
            </>
          )}

          {type === "bank" && (
            <>
              <Field label={t("wv_bank")}>
                <div className="relative">
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full h-12 pl-4 pr-10 rounded-2xl bg-background border border-border text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
              </Field>
              <Field label={t("wv_accountNumber")}>
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 20))}
                  placeholder="1234567890123"
                  className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </Field>
              <Field label={t("wv_accountHolderName")}>
                <input
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder={t("wv_egName")}
                  maxLength={80}
                  className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </Field>
            </>
          )}

          <Field label={t("wv_nickname")}>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={40}
              placeholder={type === "ewallet" ? t("wv_egNicknameEwallet") : t("wv_egNicknameBank")}
              className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>

          <div className="flex items-start gap-2 p-3 rounded-2xl bg-background border border-border">
            <ShieldCheck className="w-4 h-4 text-profit shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t("wv_privacyNote")}
            </p>
          </div>

          <button
            onClick={handleSave}
            className="w-full h-12 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap mt-2 shadow-card"
          >
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[11px] font-bold text-muted-foreground mb-1.5 ml-1">{label}</div>
    {children}
  </div>
);
