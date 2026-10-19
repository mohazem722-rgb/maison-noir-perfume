export type Category =
  "men" | "women" | "unisex" | "oriental" | "home" | "gift";
export type Product = {
  id: string;
  name_en: string;
  name_ar: string;
  brand: string;
  size: string;
  price: number;
  category: Category;
  image_url: string;
  stock: number;
  discount: number;
  rating: number;
  reviews_count: number;
  sales: number;
};
export const categories: {
  slug: Category;
  en: string;
  ar: string;
  image: string;
  count: number;
}[] = [
  {
    slug: "men",
    en: "For Him",
    ar: "عطور رجالية",
    image: "/images/fresh.jpg",
    count: 25,
  },
  {
    slug: "women",
    en: "For Her",
    ar: "عطور نسائية",
    image: "/images/floral.jpg",
    count: 25,
  },
  {
    slug: "unisex",
    en: "Beyond Gender",
    ar: "عطور للجميع",
    image: "/images/hero.jpg",
    count: 10,
  },
  {
    slug: "oriental",
    en: "Oud & Oriental",
    ar: "العود والشرقي",
    image: "/images/oud.jpg",
    count: 15,
  },
  {
    slug: "home",
    en: "The Art of Home",
    ar: "عطور المنزل",
    image: "/images/oud.jpg",
    count: 10,
  },
  {
    slug: "gift",
    en: "Gifts of Distinction",
    ar: "أطقم الهدايا",
    image: "/images/floral.jpg",
    count: 5,
  },
];
const groups: {
  category: Category;
  rows: [string, string, string, number, string][];
  total: number;
}[] = [
  {
    category: "men",
    total: 25,
    rows: [
      ["Bleu de Chanel", "بلو دو شانيل", "CHANEL", 3200, "100ml"],
      ["Sauvage", "سوفاج", "DIOR", 2900, "100ml"],
      ["Acqua di Giò", "أكوا دي جيو", "GIORGIO ARMANI", 2500, "100ml"],
      ["1 Million", "ون مليون", "PACO RABANNE", 2200, "100ml"],
      ["Aventus", "أفينتوس", "CREED", 5500, "100ml"],
      [
        "La Nuit de L’Homme",
        "لا نوي دو لوم",
        "YVES SAINT LAURENT",
        2700,
        "100ml",
      ],
      ["Oud Wood", "عود وود", "TOM FORD", 4800, "50ml"],
      ["Eros", "إيروس", "VERSACE", 2100, "100ml"],
      [
        "Black Opium Men",
        "بلاك أوبيوم رجالي",
        "YVES SAINT LAURENT",
        2600,
        "100ml",
      ],
      ["Tobacco Vanille", "توباكو فانيلا", "TOM FORD", 4500, "50ml"],
    ],
  },
  {
    category: "women",
    total: 25,
    rows: [
      ["Coco Mademoiselle", "كوكو مادموزيل", "CHANEL", 3100, "100ml"],
      ["La Vie Est Belle", "لا في إي بيل", "LANCÔME", 2800, "75ml"],
      ["Black Opium", "بلاك أوبيوم", "YVES SAINT LAURENT", 2600, "90ml"],
      ["Good Girl", "جود جيرل", "CAROLINA HERRERA", 2400, "80ml"],
      ["N°5", "شانيل رقم ٥", "CHANEL", 3300, "100ml"],
      ["Flowerbomb", "فلاور بومب", "VIKTOR & ROLF", 2200, "100ml"],
      ["Miss Dior", "ميس ديور", "DIOR", 2900, "100ml"],
      ["Lost Cherry", "لوست تشيري", "TOM FORD", 4600, "50ml"],
      ["Olympéa", "أوليمبيا", "PACO RABANNE", 2000, "80ml"],
      ["Mon Paris", "مون باريس", "YVES SAINT LAURENT", 2500, "90ml"],
    ],
  },
  {
    category: "unisex",
    total: 10,
    rows: [
      [
        "Baccarat Rouge 540",
        "باكارات روج ٥٤٠",
        "MAISON FRANCIS KURKDJIAN",
        6500,
        "70ml",
      ],
      ["Oud Tobacco", "عود توباكو", "TOM FORD", 4800, "50ml"],
      ["Silver Mountain Water", "سيلفر ماونتن ووتر", "CREED", 5200, "100ml"],
      ["Santal 33", "سانتال ٣٣", "LE LABO", 5000, "100ml"],
      ["Neroli Portofino", "نيرولي بورتوفينو", "TOM FORD", 4200, "50ml"],
    ],
  },
  {
    category: "oriental",
    total: 15,
    rows: [
      ["Oud Cambodi", "عود كمبودي", "MAISON NOIR", 1500, "Tola"],
      ["Aged Oud", "عود معتّق", "MAISON NOIR", 2000, "Tola"],
      ["White Musk", "مسك أبيض", "MAISON NOIR", 350, "50ml"],
      ["Musk Al Ghazal", "مسك الغزال", "MAISON NOIR", 500, "50ml"],
      ["Royal Amber", "عنبر ملكي", "MAISON NOIR", 450, "50ml"],
      ["Super Oud Incense", "بخور عود فاخر", "MAISON NOIR", 300, "50g"],
      ["Luxury Incense", "بخور فاخر", "MAISON NOIR", 250, "100g"],
      ["Taif Rose", "ورد طائفي", "MAISON NOIR", 600, "50ml"],
    ],
  },
  {
    category: "home",
    total: 10,
    rows: [
      ["Reed Diffuser Oud", "فواحة أعواد العود", "MAISON NOIR", 350, "200ml"],
      ["Rose Candle", "شمعة الورد", "MAISON NOIR", 200, "200g"],
      ["Car Freshener", "معطر السيارة", "MAISON NOIR", 150, "50ml"],
      ["Electric Diffuser", "فواحة كهربائية", "MAISON NOIR", 450, "1 pc"],
      ["Fabric Spray", "معطر الأقمشة", "MAISON NOIR", 180, "250ml"],
    ],
  },
  {
    category: "gift",
    total: 5,
    rows: [
      [
        "The Gentleman Set",
        "طقم الرجل الأنيق",
        "MAISON NOIR",
        1800,
        "3 pieces",
      ],
      ["The Lady Set", "طقم السيدة", "MAISON NOIR", 1600, "3 pieces"],
      ["The Oud Ritual", "طقم طقوس العود", "MAISON NOIR", 2500, "3 pieces"],
      ["The Musk Box", "صندوق المسك", "MAISON NOIR", 900, "3 pieces"],
      [
        "The Bridal Collection",
        "مجموعة العروس",
        "MAISON NOIR",
        3500,
        "5 pieces",
      ],
    ],
  },
];
let i = 0;
export const seedProducts: Product[] = groups.flatMap((g) =>
  Array.from({ length: g.total }, (_, j) => {
    const r = g.rows[j] || [
      `Collection No. ${j + 1}`,
      `مجموعة رقم ${j + 1}`,
      "MAISON NOIR",
      900 + j * 100,
      "100ml",
    ];
    i++;
    return {
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      name_en: r[0],
      name_ar: r[1],
      brand: r[2],
      size: r[4],
      price: r[3],
      category: g.category,
      image_url:
        g.category === "women"
          ? "/images/floral.jpg"
          : g.category === "men"
            ? "/images/fresh.jpg"
            : "/images/oud.jpg",
      stock: j >= g.rows.length ? 0 : 20,
      discount: j % 4 === 1 ? 15 : 0,
      rating: 4.6 + (j % 4) / 10,
      reviews_count: 18 + j * 7,
      sales: 1000 - i * 7,
    };
  }),
);
export const governorates = [
  ["Cairo", "القاهرة", 60],
  ["Alexandria", "الإسكندرية", 65],
  ["Giza", "الجيزة", 60],
  ["Assiut", "أسيوط", 75],
  ["Aswan", "أسوان", 90],
  ["Luxor", "الأقصر", 85],
  ["Qena", "قنا", 85],
  ["Sohag", "سوهاج", 80],
  ["Minya", "المنيا", 75],
  ["Beni Suef", "بني سويف", 70],
  ["Fayoum", "الفيوم", 70],
  ["Dakahlia", "الدقهلية", 70],
  ["Sharqia", "الشرقية", 70],
  ["Gharbia", "الغربية", 70],
  ["Monufia", "المنوفية", 70],
  ["Qalyubia", "القليوبية", 65],
  ["Beheira", "البحيرة", 70],
  ["Kafr El Sheikh", "كفر الشيخ", 75],
  ["Damietta", "دمياط", 75],
  ["Port Said", "بورسعيد", 75],
  ["Ismailia", "الإسماعيلية", 75],
  ["Suez", "السويس", 75],
  ["North Sinai", "شمال سيناء", 100],
  ["South Sinai", "جنوب سيناء", 100],
  ["Red Sea", "البحر الأحمر", 95],
  ["New Valley", "الوادي الجديد", 100],
  ["Matrouh", "مطروح", 95],
] as const;
export const priceOf = (p: Product) =>
  Math.round(p.price * (1 - p.discount / 100));
