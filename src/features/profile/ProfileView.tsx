// ============= Full file contents =============

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, X, ChevronDown, HelpCircle, Clock, Wallet, Calculator, Store, UtensilsCrossed, Truck } from "lucide-react";
import type { StockItem, Product, SavedCard, BusinessHoursSettings, Supplier, OutletSettings, FinishedStock } from "@/types";
import { ProductsView } from "@/features/profile/ProductsView";
import { WalletView } from "@/features/profile/WalletView";
import { BusinessHoursView } from "@/features/profile/BusinessHoursView";
import { SupplierView } from "@/features/profile/SupplierView";
import { OutletView } from "@/features/profile/OutletView";
import { SalaryCalculator } from "@/features/profile/SalaryCalculator";
import { HelpView } from "@/features/profile/HelpView";
import { useUserKey } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";

const PHOTO_KEY_BASE = "warkahbiz_profile_photo";
const EMAIL_KEY_BASE = "warkahbiz_profile_email";
const BIZ_CAT_KEY_BASE = "warkahbiz_business_category";
const PHONE_KEY_BASE = "warkahbiz_phone";
const SUPPLIERS_KEY_BASE = "warkahbiz_suppliers";

const CATEGORIES = ["Gerai", "Kedai", "Online", "Katering", "Lain-lain"] as const;

type Sub = "home" | "products" | "myproducts" | "wallet" | "hours" | "suppliers" | "outlet" | "salary" | "help";

const safeGet = (k: string | null) => (k && typeof window !== "undefined" ? localStorage.getItem(k) || "" : "");

export const ProfileView = ({
  stock,
  profileName,
  businessName,
  onSaveProfile,
  onAdjustStock,
  onSaveStock,
  onDeleteStock,
  onGoToBuy,
  products,
  finishedStock,
  onSaveProduct,
  onDeleteProduct,
  cards,
  onSaveCard,
  onDeleteCard,
  onSetPrimaryCard,
  businessHours,
  onSaveBusinessHours,
  outlet,
  onSaveOutlet,
}: {
  stock: StockItem[];
  profileName: string;
  businessName: string;
  onSaveProfile: (name: string, biz: string) => void;
  onAdjustStock: (id: string, delta: number) => void;
  onSaveStock: (item: StockItem) => void;
  onDeleteStock: (id: string) => void;
  onGoToBuy: () => void;
  products: Product[];
  finishedStock: FinishedStock[];
  onSaveProduct: (p: Product) => void;
  onDeleteProduct: (id: string) => void;
  cards: SavedCard[];
  onSaveCard: (c: SavedCard) => void;
  onDeleteCard: (id: string) => void;
  onSetPrimaryCard: (id: string) => void;
  businessHours: BusinessHoursSettings;
  onSaveBusinessHours: (s: BusinessHoursSettings) => void;
  outlet: OutletSettings;
  onSaveOutlet: (s: OutletSettings) => void;
}) => {
  const { t } = useTranslation();
  const PHOTO_KEY = useUserKey(PHOTO_KEY_BASE);
  const EMAIL_KEY = useUserKey(EMAIL_KEY_BASE);
  const BIZ_CAT_KEY = useUserKey(BIZ_CAT_KEY_BASE);
  const PHONE_KEY = useUserKey(PHONE_KEY_BASE);
  const SUPPLIERS_KEY = useUserKey(SUPPLIERS_KEY_BASE);

  const [sub, setSub] = useState<Sub>("home");
  const [editOpen, setEditOpen] = useState(false);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoadedKey, setSuppliersLoadedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!SUPPLIERS_KEY) {
      setSuppliers([]);
      setSuppliersLoadedKey(null);
      return;
    }
    try {
      const raw = localStorage.getItem(SUPPLIERS_KEY);
      setSuppliers(raw ? (JSON.parse(raw) as Supplier[]) : []);
    } catch { setSuppliers([]); }
    setSuppliersLoadedKey(SUPPLIERS_KEY);
  }, [SUPPLIERS_KEY]);
  useEffect(() => {
    if (!SUPPLIERS_KEY || suppliersLoadedKey !== SUPPLIERS_KEY) return;
    try { localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(suppliers)); } catch {}
  }, [SUPPLIERS_KEY, suppliersLoadedKey, suppliers]);

  const [photo, setPhoto] = useState("");
  const name = profileName;
  const [email, setEmail] = useState("");
  const bizName = businessName;
  const [bizCat, setBizCat] = useState("Gerai");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    setPhoto(safeGet(PHOTO_KEY));
    setEmail(safeGet(EMAIL_KEY));
    setBizCat(safeGet(BIZ_CAT_KEY) || "Gerai");
    setPhone(safeGet(PHONE_KEY));
  }, [PHOTO_KEY, EMAIL_KEY, BIZ_CAT_KEY, PHONE_KEY]);

  const comingSoon = () => toast(t("pv_comingSoon"));

  if (sub === "myproducts") {
    return (
      <ProductsView
        products={products}
        stock={stock}
        finishedStock={finishedStock}
        onSave={onSaveProduct}
        onDelete={onDeleteProduct}
        onBack={() => setSub("home")}
      />
    );
  }

  if (sub === "wallet") {
    return (
      <WalletView
        cards={cards}
        onSave={onSaveCard}
        onDelete={onDeleteCard}
        onSetPrimary={onSetPrimaryCard}
        onBack={() => setSub("home")}
      />
    );
  }

  if (sub === "hours") {
    return (
      <BusinessHoursView
        settings={businessHours}
        onSave={onSaveBusinessHours}
        onBack={() => setSub("home")}
      />
    );
  }

  if (sub === "suppliers") {
    return (
      <SupplierView
        suppliers={suppliers}
        onSave={(s) => setSuppliers((prev) => {
          const idx = prev.findIndex((x) => x.id === s.id);
          if (idx >= 0) { const next = [...prev]; next[idx] = s; return next; }
          return [s, ...prev];
        })}
        onDelete={(id) => setSuppliers((prev) => prev.filter((x) => x.id !== id))}
        onBack={() => setSub("home")}
      />
    );
  }

  if (sub === "outlet") {
    return (
      <OutletView
        outlet={outlet}
        onSave={onSaveOutlet}
        onBack={() => setSub("home")}
        businessName={businessName}
        businessHours={businessHours}
      />
    );
  }

  if (sub === "salary") {
    return <SalaryCalculator onBack={() => setSub("home")} />;
  }

  if (sub === "help") {
    return <HelpView onBack={() => setSub("home")} />;
  }

  return (
    <div className="pb-32 px-5 pt-6 space-y-5">
      {/* Profile header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => setEditOpen(true)}
          className="relative w-24 h-24 rounded-3xl overflow-hidden bg-surface border-2 border-border grid place-items-center tap shrink-0"
          aria-label={t("pv_changePhoto")}
        >
          {photo ? (
            <img src={photo} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl">👤</span>
          )}
          <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-gradient-profit grid place-items-center shadow-card">
            <Camera className="w-3.5 h-3.5 text-profit-foreground" strokeWidth={2.5} />
          </div>
        </button>

        <div className="flex-1 min-w-0">
          <div className="text-lg font-extrabold leading-tight truncate">{name || t("pv_yourName")}</div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">{email || t("pv_yourEmail")}</div>
          <div className="text-xs text-muted-foreground truncate mt-1">
            {bizName ? `${bizName} • ` : ""}{bizCat}
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="mt-2 h-9 px-4 rounded-2xl bg-gradient-profit text-profit-foreground text-xs font-bold tap shadow-card"
          >
            {t("editProfile")}
          </button>
        </div>
      </div>

      {/* Menu cards row 1 */}
      <div className="grid grid-cols-3 gap-3">
        <MenuCard data-tutorial="menu-products" icon={<UtensilsCrossed className="w-5 h-5" />} label={t("myProducts")} onClick={() => setSub("myproducts")} />
        <MenuCard icon={<Store className="w-5 h-5" />} label={t("pv_myOutlet")} onClick={() => setSub("outlet")} />
        <MenuCard icon={<Clock className="w-5 h-5" />} label={t("businessHoursTitle")} onClick={() => setSub("hours")} />
      </div>

      {/* Menu cards row 2 */}
      <div className="grid grid-cols-3 gap-3">
        <MenuCard icon={<Wallet className="w-5 h-5" />} label={t("pv_myWallet")} onClick={() => setSub("wallet")} />
        <MenuCard icon={<Calculator className="w-5 h-5" />} label={t("pv_salaryCalc")} onClick={() => setSub("salary")} />
        <MenuCard icon={<Truck className="w-5 h-5" />} label={t("pv_mySuppliers")} onClick={() => setSub("suppliers")} />
      </div>

      {/* Help */}
      <button onClick={() => setSub("help")} className="w-full h-12 rounded-2xl bg-surface border border-border flex items-center justify-center gap-2 tap text-sm font-bold">
        <HelpCircle className="w-4 h-4" /> {t("pv_help")}
      </button>

      {editOpen && (
        <EditProfileSheet
          photo={photo}
          name={name}
          email={email}
          bizName={bizName}
          bizCat={bizCat}
          phone={phone}
          onClose={() => setEditOpen(false)}
          onSave={(d) => {
            setPhoto(d.photo);
            setEmail(d.email);
            setBizCat(d.bizCat);
            setPhone(d.phone);
            try {
              if (PHOTO_KEY) {
                if (d.photo) localStorage.setItem(PHOTO_KEY, d.photo); else localStorage.removeItem(PHOTO_KEY);
              }
              if (EMAIL_KEY) localStorage.setItem(EMAIL_KEY, d.email);
              if (BIZ_CAT_KEY) localStorage.setItem(BIZ_CAT_KEY, d.bizCat);
              if (PHONE_KEY) localStorage.setItem(PHONE_KEY, d.phone);
            } catch {}
            onSaveProfile(d.name, d.bizName);
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
};

const MenuCard = ({ icon, label, onClick, ...rest }: { icon: React.ReactNode; label: string; onClick: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button onClick={onClick} {...rest} className="aspect-square rounded-2xl bg-surface border border-border p-3 flex flex-col items-center justify-center gap-2 tap">
    <div className="w-10 h-10 rounded-xl bg-gradient-profit text-profit-foreground grid place-items-center">{icon}</div>
    <span className="text-[11px] font-bold text-center leading-tight">{label}</span>
  </button>
);

const EditProfileSheet = ({
  photo: initPhoto, name: initName, email: initEmail, bizName: initBiz, bizCat: initCat, phone: initPhone,
  onClose, onSave,
}: {
  photo: string; name: string; email: string; bizName: string; bizCat: string; phone: string;
  onClose: () => void;
  onSave: (d: { photo: string; name: string; email: string; bizName: string; bizCat: string; phone: string }) => void;
}) => {
  const { t } = useTranslation();
  const [photo, setPhoto] = useState(initPhoto);
  const [name, setName] = useState(initName);
  const [email, setEmail] = useState(initEmail);
  const [bizName, setBizName] = useState(initBiz);
  const [bizCat, setBizCat] = useState(initCat);
  const [phone, setPhone] = useState(initPhone);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) {
      toast.error(t("pv_photoTooBig"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(f);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-full sm:max-w-[600px] md:max-w-[760px] mx-auto bg-surface rounded-t-3xl p-5 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto"
      >
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoPick} />

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold">{t("editProfile")}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-background border border-border grid place-items-center tap">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 mb-5">
          <button
            onClick={() => fileRef.current?.click()}
            className="relative w-24 h-24 rounded-3xl overflow-hidden bg-background border-2 border-border grid place-items-center tap"
          >
            {photo ? (
              <img src={photo} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">👤</span>
            )}
            <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-gradient-profit grid place-items-center shadow-card">
              <Camera className="w-3.5 h-3.5 text-profit-foreground" strokeWidth={2.5} />
            </div>
          </button>
          <button onClick={() => fileRef.current?.click()} className="text-xs font-bold text-primary tap">
            {t("pv_changePhoto")}
          </button>
        </div>

        <div className="space-y-3">
          <Field label={t("profileName")}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={t("pv_namePh")}
              className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
          <Field label={t("emailLabel")}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={120}
              placeholder={t("pv_emailPh")}
              className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
          <Field label={t("profileBusiness")}>
            <input
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              maxLength={80}
              placeholder={t("pv_bizNamePh")}
              className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
          <Field label={t("pv_category")}>
            <div className="relative">
              <select
                value={bizCat}
                onChange={(e) => setBizCat(e.target.value)}
                className="w-full h-12 pl-4 pr-10 rounded-2xl bg-background border border-border text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>
          </Field>
          <Field label={t("phoneLabel")}>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\-\s]/g, "").slice(0, 20))}
              placeholder={t("pv_phonePh")}
              className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>

          <button
            onClick={() => {
              if (!name.trim()) { toast.error(t("pv_pleaseEnterName")); return; }
              onSave({ photo, name: name.trim(), email: email.trim(), bizName: bizName.trim(), bizCat, phone: phone.trim() });
            }}
            className="w-full h-12 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap mt-3 shadow-card"
          >
            {t("saveBtn")}
          </button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[11px] font-bold text-muted-foreground mb-1.5 ml-1">{label}</div>
    {children}
  </div>
);
