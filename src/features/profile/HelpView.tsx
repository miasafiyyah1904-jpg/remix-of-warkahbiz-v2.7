import { ArrowLeft, MessageCircle, Mail } from "lucide-react";
import { useTranslation } from "@/context/LanguageContext";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FAQ = { q: string; a: string };
type Group = { category: string; items: FAQ[] };

const GROUPS: Group[] = [
  {
    category: "Rekod & Kewangan",
    items: [
      {
        q: "Macam mana nak rekod jualan?",
        a: "Tekan butang \"Dapat Duit\" di skrin Hari Ini. Masukkan jumlah, pilih emoji dan label, kemudian tekan Simpan. Rekod akan tersimpan serta-merta dalam tab Rekod.",
      },
      {
        q: "Boleh tak export rekod ke Excel atau PDF?",
        a: "Boleh. Pergi ke tab Rekod → tekan ikon Export (📤) di atas kanan. Pilih format yang Boss nak — Excel/CSV, PDF Ringkasan, atau kongsi terus via WhatsApp.",
      },
      {
        q: "Rekod saya hilang. Apa yang berlaku?",
        a: "Semua data disimpan di peranti Boss sahaja. Jika Boss tukar telefon atau kosongkan cache browser, data mungkin hilang. Export rekod secara berkala sebagai sandaran.",
      },
    ],
  },
  {
    category: "Stok & Bekalan",
    items: [
      {
        q: "Macam mana sistem tahu stok saya nak habis?",
        a: "WarkahBiz bandingkan kuantiti semasa dengan tahap minimum (min restock) yang Boss tetapkan. Jika stok sama atau di bawah tahap itu, ia akan muncul dalam senarai \"Nak Beli\" secara automatik.",
      },
      {
        q: "Boleh tak tambah bahan sendiri?",
        a: "Boleh. Pergi ke tab Stok → tekan \"+ Tambah Bahan\". Isi nama, unit, kuantiti semasa dan tahap minimum.",
      },
    ],
  },
  {
    category: "AI & Ramalan",
    items: [
      {
        q: "AI WarkahBiz guna data mana untuk bagi cadangan?",
        a: "AI guna data jualan, belanja, stok dan petty cash yang Boss rekodkan hari ini dan minggu ini. Lagi banyak Boss rekod, lagi tepat cadangan AI.",
      },
      {
        q: "Ramalan jualan betul ke?",
        a: "Ramalan adalah anggaran berdasarkan corak jualan lepas dan faktor cuaca. Ia bukan jaminan. Gunakan sebagai panduan perancangan, bukan angka tetap.",
      },
    ],
  },
  {
    category: "Profil & Tetapan",
    items: [
      {
        q: "Macam mana nak tukar nama perniagaan?",
        a: "Pergi ke tab Profil → tekan \"Edit Profil\" → kemaskini medan Nama Perniagaan → tekan Simpan.",
      },
      {
        q: "Waktu operasi saya dah betul tapi status outlet masih tutup. Kenapa?",
        a: "Semak bahagian \"Outlet Saya\" → pastikan togol \"Buka hari ini?\" dihidupkan. Togol ini adalah override manual yang mengatasi jadual waktu operasi.",
      },
      {
        q: "Data saya selamat ke?",
        a: "Semua data disimpan terus di peranti Boss menggunakan localStorage — tiada data dihantar ke pelayan kami kecuali apabila Boss menggunakan ciri Tanya AI. WarkahBiz tidak menyimpan maklumat kewangan Boss di cloud.",
      },
    ],
  },
  {
    category: "Kalkulator Gaji",
    items: [
      {
        q: "Kadar EPF, SOCSO dan EIS yang digunakan betul ke?",
        a: "Kalkulator menggunakan kadar 2026 yang dikemaskini — EPF 13% majikan / 11% pekerja, SOCSO siling RM6,000, EIS 0.2% setiap pihak. Kiraan adalah anggaran. Rujuk portal rasmi KWSP dan PERKESO untuk angka tepat.",
      },
      {
        q: "Pekerja asing kena bayar EPF ke?",
        a: "Ya, bermula Oktober 2025, pekerja asing wajib caruman EPF pada kadar 2% majikan dan 2% pekerja. Mereka tidak dilindungi EIS.",
      },
    ],
  },
];

export const HelpView = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto animate-fade-in">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-5 py-3">
        <button onClick={onBack} className="text-xs font-bold text-primary tap mb-1 inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> {t("prof_backToProfile")}
        </button>
        <h1 className="text-base font-extrabold">Bantuan & Soalan Lazim</h1>
      </div>

      <div className="px-5 pt-5 pb-32 space-y-4">
        {/* Section A — Quick Actions */}
        <div className="rounded-2xl bg-surface border border-border p-4">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
            Perlukan bantuan lanjut?
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => window.open("https://wa.me/60112345678", "_blank")}
              className="w-full h-12 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap shadow-card flex items-center justify-center gap-2 text-sm"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp Kami
            </button>
            <button
              onClick={() => window.open("mailto:support@warkahbiz.com")}
              className="w-full h-12 rounded-2xl bg-surface border border-border flex items-center justify-center gap-2 tap text-sm font-bold"
            >
              <Mail className="w-4 h-4" /> Emel Sokongan
            </button>
          </div>
        </div>

        {/* Section B — FAQ */}
        <div>
          {GROUPS.map((group, gi) => (
            <div key={group.category} className={gi === 0 ? "" : "mt-6"}>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                {group.category}
              </div>
              <Accordion type="single" collapsible className="rounded-2xl bg-surface border border-border px-4">
                {group.items.map((item, i) => (
                  <AccordionItem
                    key={i}
                    value={`${group.category}-${i}`}
                    className={i === group.items.length - 1 ? "border-b-0" : ""}
                  >
                    <AccordionTrigger className="text-sm font-bold text-left">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>

        {/* Section C — Version & Credits */}
        <div className="text-[11px] text-muted-foreground text-center space-y-1 pt-4">
          <div>WarkahBiz v1.0</div>
          <div>Dibina untuk peniaga mikro Malaysia 🇲🇾</div>
          <div>© 2026 WarkahBiz. Hak cipta terpelihara.</div>
        </div>
      </div>
    </div>
  );
};
