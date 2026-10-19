import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
} from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  ShoppingBag,
  User,
  Menu,
  X,
  Heart,
  Plus,
  Minus,
  Check,
  Star,
  Truck,
  ShieldCheck,
  Gift,
  Globe,
  MessageCircle,
  Instagram,
  Mail,
  MapPin,
  Phone,
  SlidersHorizontal,
  Copy,
  LogOut,
  Package,
  BarChart3,
  Upload,
  Trash2,
  ArrowDown,
  LockKeyhole,
} from "lucide-react";
import type { User as AuthUser } from "@supabase/supabase-js";
import {
  Product,
  Category,
  seedProducts,
  categories,
  governorates,
  priceOf,
} from "./data";
import { supabase, api, stored } from "./lib";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/cairo/arabic-400.css";
import "@fontsource/cairo/arabic-500.css";
import "@fontsource/cairo/arabic-600.css";
import "@fontsource/cairo/arabic-700.css";
import "./styles.css";
import { Seo } from "./Seo";
import { HeroVideo } from "./HeroVideo";
import { saveStored } from "./storage";
import { useCart } from "./useCart";
import { ForgotPassword, ResetPassword } from "./AuthRecovery";
import {
  parseWish,
  cartKey,
  checkoutRequestKey,
  finishCheckout,
  type CartItem,
} from "./cart";
function SiteBackground() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      // One original texture pixel per device pixel. Repeat instead of enlarging grain.
      ref.current?.style.setProperty("--texture-width", `${1600 / dpr}px`);
      ref.current?.style.setProperty("--texture-height", `${896 / dpr}px`);
      document.documentElement.style.setProperty("--asset-dpr", String(dpr));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return <div className="site-background" ref={ref} aria-hidden="true" />;
}

type Ctx = {
  authReady: boolean;
  catalogReady: boolean;
  shippingRates: Record<string, number>;
  ar: boolean;
  t: (en: string, ar: string) => string;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  add: (id: string) => void;
  notify: (s: string) => void;
  user: AuthUser | null;
  openCart: () => void;
  wish: string[];
  toggleWish: (id: string) => void;
};
const Context = createContext<Ctx>(null!);
const useShop = () => useContext(Context);
const money = (n: number) => n.toLocaleString("en-US");
function App() {
  const [shippingRates, setShippingRates] = useState<Record<string, number>>(
    () => Object.fromEntries(governorates.map((g) => [g[0], g[2]])),
  );
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(!supabase);
  const [catalogReady, setCatalogReady] = useState(!supabase);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [ar, setAr] = useState(
    () => stored<string>("mn-language", "en") === "ar",
  );
  const [products, setProducts] = useState<Product[]>(() =>
    supabase ? [] : seedProducts,
  );
  const loadCatalog = async () => {
    if (!supabase) return;
    setCatalogReady(false);
    setCatalogFailed(false);
    try {
      const { data, error } = await supabase.from("products").select("*");
      if (error || !Array.isArray(data))
        throw error || new Error("Catalog unavailable");
      setProducts(data);
      setCatalogReady(true);
    } catch {
      setCatalogFailed(true);
    }
  };
  const [wish, setWish] = useState<string[]>(() =>
    parseWish(stored("mn-wish", [])),
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const { cart, setCart } = useCart(products, catalogReady, user, authReady);
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const notify = (s: string) => {
    setToast(s);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  };
  useEffect(() => {
    document.documentElement.dir = ar ? "rtl" : "ltr";
    document.documentElement.lang = ar ? "ar" : "en";
    saveStored("mn-language", ar ? "ar" : "en");
  }, [ar]);
  useEffect(() => {
    saveStored("mn-wish", wish);
  }, [wish]);
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("shipping_rates")
      .select("governorate,price")
      .then(({ data }) => {
        if (data?.length)
          setShippingRates(
            Object.fromEntries(data.map((r) => [r.governorate, r.price])),
          );
      });
    loadCatalog();
    let revision = 0;
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active && revision === 0) {
          setUser(data.user);
          setAuthReady(true);
        }
      })
      .catch(() => {
        if (active && revision === 0) setAuthReady(true);
      });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      revision++;
      setUser(session?.user || null);
      setAuthReady(true);
      if (event === "PASSWORD_RECOVERY")
        navigate("/reset-password", { replace: true });
    });
    const ch = supabase
      .channel("products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        loadCatalog,
      )
      .subscribe();
    return () => {
      active = false;
      data.subscription.unsubscribe();
      supabase!.removeChannel(ch);
    };
  }, []);
  const add = (id: string) => {
    if (!authReady || !catalogReady) {
      notify(
        t(
          "Please wait for your session and catalog to load.",
          "انتظر تحميل الحساب والمنتجات أولاً.",
        ),
      );
      return;
    }
    const p = products.find((p) => p.id === id);
    if (!p || p.stock < 1) {
      notify(t("This item is coming soon.", "هذا المنتج متاح قريباً."));
      return;
    }
    setCart((c) => {
      const exists = c.find((x) => x.id === id);
      if (exists && exists.qty >= p.stock) return c;
      return exists
        ? c.map((x) => (x.id === id ? { ...x, qty: x.qty + 1 } : x))
        : [...c, { id, qty: 1 }];
    });
    notify(
      t(
        "A little luxury, added to your bag.",
        "أُضيفت لمسة من الفخامة إلى حقيبتك.",
      ),
    );
  };
  const toggleWish = (id: string) =>
    setWish((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  return (
    <Context.Provider
      value={{
        authReady,
        catalogReady,
        shippingRates,
        ar,
        t,
        products,
        setProducts,
        cart,
        setCart,
        add,
        notify,
        user,
        openCart: () => setCartOpen(true),
        wish,
        toggleWish,
      }}
    >
      <Seo ar={ar} products={products} />
      <SiteBackground />
      <ScrollManager />
      <Header setAr={setAr} />
      <main>
        {!catalogReady && (
          <div className="notice shell catalog-notice" role="status">
            {catalogFailed
              ? t(
                  "The catalog is temporarily unavailable. Checkout is paused; demonstration products are not used in place of live stock.",
                  "المنتجات غير متاحة مؤقتاً. تأكيد الطلب متوقف؛ لا نستبدل المخزون الحقيقي بمنتجات تجريبية.",
                )
              : t("Loading the catalog…", "جارٍ تحميل المنتجات…")}
            {catalogFailed && (
              <button className="btn glass" onClick={loadCatalog}>
                {t("Retry", "إعادة المحاولة")}
              </button>
            )}
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products key="catalog" />} />
          <Route path="/products/:id" element={<ProductPage />} />
          <Route
            path="/offers"
            element={<Products key="offers" mode="offers" />}
          />
          <Route
            path="/bestsellers"
            element={<Products key="bestsellers" mode="bestsellers" />}
          />
          <Route
            path="/wishlist"
            element={<Products key="wishlist" mode="wishlist" />}
          />
          <Route path="/reset-password" element={<PasswordReset />} />
          <Route path="/about" element={<About />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/returns" element={<Returns />} />
          <Route
            path="/account"
            element={<Account key={user?.id ?? "guest"} />}
          />
          <Route
            path="/checkout"
            element={<Checkout key={user?.id ?? "guest"} />}
          />
          <Route path="/admin" element={<Admin key={user?.id ?? "guest"} />} />
          <Route
            path="*"
            element={
              <div className="page shell">
                <h1>404</h1>
                <Link className="btn gold" to="/">
                  Return home
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
      <Footer />
      <WhatsApp />
      {cartOpen && <CartDrawer close={() => setCartOpen(false)} />}
      <div className={`toast ${toast ? "show" : ""}`} role="status">
        <Check size={18} />
        {toast}
      </div>
    </Context.Provider>
  );
}
function useDialog(active: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!active) return;
    const prior = document.activeElement as HTMLElement;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => {
      const modal = document.querySelector('[role="dialog"]');
      (
        modal?.querySelector("button,a,input,select,textarea") as HTMLElement
      )?.focus();
    }, 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const modal = document.querySelector('[role="dialog"]');
        const nodes = Array.from(
          modal?.querySelectorAll(
            "button:not(:disabled),a,input,select,textarea",
          ) || [],
        ) as HTMLElement[];
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = before;
      document.removeEventListener("keydown", onKey);
      prior?.focus();
    };
  }, [active]);
}
function ScrollManager() {
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const obs = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            obs.unobserve(e.target);
          }
        }),
      { threshold: 0.15 },
    );
    const timer = setTimeout(
      () => document.querySelectorAll(".reveal").forEach((e) => obs.observe(e)),
      80,
    );
    return () => {
      clearTimeout(timer);
      obs.disconnect();
    };
  }, [loc.pathname, loc.search]);
  return null;
}
function Logo() {
  return (
    <Link className="logo logo-modern" to="/" aria-label="Maison Noir home">
      <svg
        className="logo-monogram"
        width="42"
        height="42"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 37V10L24 29L42 10V37M19 37V10L42 37"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="miter"
        />
        <path d="M6 43H42" stroke="currentColor" strokeWidth=".65" />
      </svg>
      <span className="logo-wordmark">
        MAISON NOIR<small>FINE FRAGRANCES</small>
      </span>
    </Link>
  );
}
const nav = [
  ["/", "Home", "الرئيسية"],
  ["/products", "Collection", "المجموعة"],
  ["/offers", "Offers", "العروض"],
  ["/bestsellers", "Bestsellers", "الأكثر مبيعاً"],
  ["/about", "Our Maison", "دارنا"],
  ["/faq", "FAQ", "الأسئلة الشائعة"],
  ["/contact", "Contact", "تواصل معنا"],
];
function Header({
  setAr,
}: {
  setAr: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { ar, t, cart, openCart } = useShop();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setMenu(false);
    setSearch(false);
  }, [loc]);
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Logo />
          <nav className="desktop-nav">
            {nav.map(([url, en, ar]) => (
              <Link
                key={url}
                className={loc.pathname === url ? "active" : ""}
                to={url}
              >
                {t(en, ar)}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <button className="language" onClick={() => setAr((x) => !x)}>
              <Globe size={14} />
              {ar ? "EN" : "العربية"}
            </button>
            <span className="nav-divider" />
            <button
              className="icon-btn"
              aria-label={t("Search", "بحث")}
              onClick={() => setSearch((x) => !x)}
            >
              <Search size={19} />
            </button>
            <Link
              className="icon-btn account-link"
              aria-label={t("Your account", "حسابك")}
              to="/account"
            >
              <User size={19} />
            </Link>
            <button
              className="icon-btn bag-button"
              onClick={openCart}
              aria-label={t("Shopping bag", "حقيبة التسوق")}
            >
              <ShoppingBag size={19} />
              {cart.length > 0 && <b>{cart.reduce((n, c) => n + c.qty, 0)}</b>}
            </button>
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label="Menu"
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-nav">
            {nav.map(([url, en, ar]) => (
              <Link key={url} to={url}>
                {t(en, ar)}
                <ArrowUpRight size={16} />
              </Link>
            ))}
            <Link to="/wishlist">
              {t("Saved fragrances", "العطور المحفوظة")}
            </Link>
            <Link to="/account">{t("My account", "حسابي")}</Link>
          </nav>
        )}
        {search && <SearchPanel close={() => setSearch(false)} />}
      </header>
    </>
  );
}
function SearchPanel({ close }: { close: () => void }) {
  const { products, ar, t } = useShop();
  const [q, setQ] = useState("");
  return (
    <div className="search-panel shell">
      <div className="search-input">
        <Search size={20} />
        <input
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          placeholder={t("Find your signature scent…", "ابحث عن عطرك المميز…")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button onClick={close} className="icon-btn" aria-label="Close">
          <X size={20} />
        </button>
      </div>
      {q && (
        <div className="suggestions">
          {products
            .filter((p) =>
              (p.name_en + p.name_ar + p.brand)
                .toLowerCase()
                .includes(q.toLowerCase()),
            )
            .slice(0, 5)
            .map((p) => (
              <Link to={`/products/${p.id}`} key={p.id}>
                <img src={p.image_url} alt="" />
                <span>
                  {ar ? p.name_ar : p.name_en}
                  <small>{p.brand}</small>
                </span>
                <span>{money(priceOf(p))} EGP</span>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
function Hero() {
  const { t } = useShop();
  return (
    <div className="hero-stage hero-silver">
      <section className="hero hero-editorial">
        <HeroVideo />
        <div className="hero-spotlight" aria-hidden="true" />
        <div className="hero-layout shell">
          <div className="hero-heading">
            <h1>
              <span>{t("Rare.", "نادر.")}</span>
              <span>{t("Golden.", "ذهبي.")}</span>
              <em>{t("Unveiled.", "يُكتشف.")}</em>
            </h1>
          </div>
          <figure className="perfume-photo">
            <div className="perfume-display">
              <span className="floor-pool" aria-hidden="true" />
              <span className="bottle-cast-shadow" aria-hidden="true" />
              <span className="floor-contact-shadow" aria-hidden="true" />
              <picture>
                <source
                  type="image/webp"
                  srcSet="/images/oud-wood-100ml-lossless.webp"
                />
                <img
                  src="/images/oud-wood-100ml-original.png"
                  width="870"
                  height="1630"
                  fetchPriority="high"
                  decoding="sync"
                  alt={t(
                    "Tom Ford Oud Wood Eau de Parfum, 100ml — original product photograph",
                    "صورة المنتج الأصلية: توم فورد عود وود أو دو بارفان، ١٠٠ مل",
                  )}
                />
              </picture>
            </div>
          </figure>
          <div className="hero-copy">
            <p className="hero-intro">
              {t(
                "Not just a fragrance. An expression of you.",
                "ليس مجرد عطر. بل تعبير عنك.",
              )}
            </p>
            <p>
              {t(
                "Discover a world of extraordinary scents, thoughtfully curated for the unforgettable.",
                "اكتشف عالماً من الروائح الاستثنائية، اختيرت بعناية لتترك أثراً لا يُنسى.",
              )}
            </p>
            <div className="hero-buttons">
              <Link className="btn gold" to="/products">
                {t("Explore the Collection", "اكتشف المجموعة")}
                <ArrowUpRight size={18} />
              </Link>
              <Link className="btn glass" to="/contact">
                <MessageCircle size={19} strokeWidth={1.6} />
                {t("Private Tasting", "تجربة خاصة")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
function ServiceStrip() {
  const { t } = useShop();
  return (
    <div className="service-strip shell">
      {[
        [
          Truck,
          "DELIVERED WITH CARE",
          "توصيل بكل عناية",
          "Across all of Egypt",
          "إلى جميع أنحاء مصر",
        ],
        [
          ShieldCheck,
          "AUTHENTIC, ALWAYS",
          "أصالة دون مساومة",
          "100% original fragrances",
          "عطور أصلية ١٠٠٪",
        ],
        [
          Gift,
          "THE PERFECT GESTURE",
          "الهدية الأجمل",
          "Signature gift wrapping",
          "تغليف هدايا مميز",
        ],
        [
          MessageCircle,
          "PERSONAL ASSISTANCE",
          "مساعدة شخصية",
          "Your scent, expertly guided",
          "خبراؤنا لاختيار عطرك",
        ],
      ].map(([Icon, en, ar, sub, subar], i) => {
        const I = Icon as typeof Truck;
        return (
          <div className="service" key={i}>
            <I size={24} strokeWidth={1.2} />
            <div>
              <strong>{t(en as string, ar as string)}</strong>
              <span>{t(sub as string, subar as string)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
function SectionHead({
  eyebrow,
  title,
  italic,
  link,
  linkText,
}: {
  eyebrow: string;
  title: string;
  italic?: string;
  link?: string;
  linkText?: string;
}) {
  const { t } = useShop();
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">
          <span />
          {eyebrow}
        </div>
        <h2>
          {title} {italic && <em>{italic}</em>}
        </h2>
      </div>
      {link && (
        <Link to={link} className="text-link">
          {linkText || t("View all fragrances", "جميع العطور")}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
function Home() {
  const { t, products } = useShop();
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState("all");
  const carousel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setSlide((s) => (s + 1) % 3), 5000);
    return () => clearInterval(timer);
  }, []);
  const featured = [
    products.find((p) => p.name_en === "Baccarat Rouge 540"),
    products.find((p) => p.name_en === "Oud Wood"),
    products.find((p) => p.name_en === "Coco Mademoiselle"),
    products.find((p) => p.name_en === "Aventus"),
  ].filter(Boolean) as Product[];
  return (
    <>
      <Hero />
      <ServiceStrip />
      <section className="section shell" id="collection">
        <SectionHead
          eyebrow={t("THE WORLD OF MAISON NOIR", "عالم ميزون نوار")}
          title={t("Find your", "اكتشف")}
          italic={t("signature.", "بصمتك.")}
          link="/products"
          linkText={t("Explore all collections", "استكشف كل المجموعات")}
        />
        <div className="category-grid">
          {categories.map((c, i) => (
            <Link
              className={`category-card reveal cat-${i}`}
              key={c.slug}
              to={`/products?category=${c.slug}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <img src={c.image} alt={t(c.en, c.ar)} loading="lazy" />
              <span className="category-count">
                {String(
                  products.filter((p) => p.category === c.slug).length,
                ).padStart(2, "0")}{" "}
                {t("FRAGRANCES", "عطراً")}
              </span>
              <div className="category-caption">
                <div>
                  <small>{t("THE COLLECTION", "المجموعة")}</small>
                  <h3>{t(c.en, c.ar)}</h3>
                </div>
                <span className="circle-arrow">
                  <ArrowUpRight size={21} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="section shell favorites">
        <SectionHead
          eyebrow={t("THE MOST COVETED", "عطور تستحق الاقتناء")}
          title={t("Extraordinary scents.", "عطور استثنائية.")}
          italic={t("Enduring favourites.", "محبة تدوم.")}
          link="/bestsellers"
        />
        <div className="collection-tabs">
          {[
            ["all", "All fragrances", "كل العطور"],
            ["men", "For him", "للرجال"],
            ["women", "For her", "للنساء"],
            ["unisex", "Unisex", "للجميع"],
          ].map(([id, en, ar]) => (
            <button
              key={id}
              className={tab === id ? "selected" : ""}
              onClick={() => setTab(id)}
            >
              {t(en, ar)}
            </button>
          ))}
        </div>
        <div className="product-grid">
          {(tab === "all"
            ? featured
            : products.filter((p) => p.category === tab).slice(0, 4)
          ).map((p, i) => (
            <ProductCard
              key={p.id}
              p={p}
              badge={i === 0 ? t("BESTSELLER", "الأكثر مبيعاً") : undefined}
            />
          ))}
        </div>
      </section>
      <section className="editorial-banner shell reveal">
        <img
          src={
            slide === 1
              ? "/images/oud.jpg"
              : slide === 2
                ? "/images/floral.jpg"
                : "/images/hero.jpg"
          }
          alt=""
        />
        <div className="editorial-overlay" />
        <div className="editorial-copy">
          <div className="eyebrow">
            {t("THE SEASON OF EXCEPTION", "موسم الاستثناء")}
          </div>
          <h2>
            {slide === 0
              ? t("A little indulgence.", "القليل من الدلال.")
              : slide === 1
                ? t("The soul of the Orient.", "روح الشرق.")
                : t("A beautiful impression.", "انطباع لا يُنسى.")}
            <br />
            <em>
              {slide === 0
                ? t("An extraordinary offer.", "عرض استثنائي.")
                : slide === 1
                  ? t("Captured in a bottle.", "في زجاجة.")
                  : t("Made to linger.", "صُنع ليدوم.")}
            </em>
          </h2>
          <p>
            {t(
              "Discover exclusive savings on a selection of our most-loved fragrances.",
              "اكتشف عروضاً حصرية على مجموعة مختارة من عطورنا المحبوبة.",
            )}
          </p>
          <Link className="btn gold" to="/offers">
            {t("Discover the Offers", "اكتشف العروض")}
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="slider-control">
          <button
            onClick={() => setSlide((slide + 2) % 3)}
            aria-label="Previous offer"
          >
            <ChevronLeft size={18} />
          </button>
          {[0, 1, 2].map((i) => (
            <button
              className={`dot ${i === slide ? "active" : ""}`}
              onClick={() => setSlide(i)}
              key={i}
              aria-label={`Offer ${i + 1}`}
            />
          ))}
          <button
            onClick={() => setSlide((slide + 1) % 3)}
            aria-label="Next offer"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
      <section className="section shell">
        <SectionHead
          eyebrow={t("RECENTLY ARRIVED", "وصل حديثاً")}
          title={t("New discoveries.", "اكتشافات جديدة.")}
          italic={t("New obsessions.", "شغف جديد.")}
          link="/products"
        />
        <div className="horizontal-products" ref={carousel}>
          {products
            .filter((p) => p.stock > 0)
            .slice(4, 12)
            .map((p) => (
              <ProductCard p={p} key={p.id} />
            ))}
        </div>
        <div className="carousel-controls">
          <button
            className="circle-arrow"
            onClick={() =>
              carousel.current?.scrollBy({ left: -350, behavior: "smooth" })
            }
            aria-label="Previous products"
          >
            <ChevronLeft size={18} />
          </button>
          <span />
          <button
            className="circle-arrow"
            onClick={() =>
              carousel.current?.scrollBy({ left: 350, behavior: "smooth" })
            }
            aria-label="Next products"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
      <section className="story-section shell reveal">
        <div className="story-image">
          <img
            src="/images/oud.jpg"
            alt={t("The craft of fine perfumery", "فن صناعة العطور")}
          />
          <span>EST. 2010</span>
        </div>
        <div className="story-copy">
          <div className="eyebrow">
            <span />
            {t("MORE THAN A PERFUME HOUSE", "أكثر من دار للعطور")}
          </div>
          <h2>
            {t("A passion for the rare.", "شغف بكل نادر.")}
            <br />
            <em>
              {t(
                "An instinct for the unexpected.",
                "وحدس يقود إلى غير المتوقّع.",
              )}
            </em>
          </h2>
          <p>
            {t(
              "Since 2010, we have believed that the right fragrance is not simply worn. It becomes a part of who you are. We bring together the world’s most exceptional scents — each with a story, each waiting to become yours.",
              "منذ عام ٢٠١٠، نؤمن بأن العطر المناسب لا يُرتدى فحسب، بل يصبح جزءاً منك. نجمع أروع عطور العالم، لكل منها حكاية، وكل منها ينتظر أن يكون جزءاً من حكايتك.",
            )}
          </p>
          <Link className="text-link" to="/about">
            {t("The story of our maison", "حكاية دارنا")}
            <ArrowUpRight size={16} />
          </Link>
          <div className="signature">Maison Noir</div>
        </div>
      </section>
      <div className="offer-countdown shell">
        <div>
          <div className="eyebrow">
            {t("A MOMENT, NOT FOREVER", "لحظة لا تدوم للأبد")}
          </div>
          <h3>
            {t(
              "Exceptional finds. Limited time.",
              "اختيارات استثنائية. لوقت محدود.",
            )}
          </h3>
        </div>
        <Countdown />
        <Link to="/offers" className="text-link">
          {t("Shop offers", "تسوق العروض")}
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <Newsletter />
    </>
  );
}
function ProductCard({
  p,
  badge,
  offer = false,
}: {
  p: Product;
  badge?: string;
  offer?: boolean;
}) {
  const { ar, t, add, wish, toggleWish } = useShop();
  return (
    <article className="product-card">
      <div className="product-image">
        <Link to={`/products/${p.id}`}>
          <img
            src={p.image_url}
            alt={ar ? p.name_ar : p.name_en}
            loading="lazy"
          />
        </Link>
        {(badge || p.discount > 0) && (
          <span className={`product-badge ${p.discount ? "sale" : ""}`}>
            {p.discount ? `−${p.discount}%` : badge}
          </span>
        )}
        <button
          className={`wishlist ${wish.includes(p.id) ? "liked" : ""}`}
          onClick={() => toggleWish(p.id)}
          aria-label={t("Save fragrance", "حفظ العطر")}
        >
          <Heart
            size={17}
            fill={wish.includes(p.id) ? "currentColor" : "none"}
          />
        </button>
        <button
          className="quick-add"
          onClick={() => add(p.id)}
          disabled={p.stock === 0}
        >
          <Plus size={15} />
          {p.stock
            ? t("Add to bag", "أضف للحقيبة")
            : t("Coming soon", "قريباً")}
        </button>
      </div>
      <div className="product-info">
        <span className="brand">{p.brand}</span>
        <Link to={`/products/${p.id}`}>
          <h3>{ar ? p.name_ar : p.name_en}</h3>
        </Link>
        <div className="product-meta">
          <span>
            {t("Eau de Parfum", "أو دو بارفان")} · {p.size}
          </span>
          <span className="rating">
            <Star size={10} fill="currentColor" />
            {p.rating.toFixed(1)}
          </span>
        </div>
        <div className="price">
          {money(priceOf(p))}
          <small>{t("EGP", "ج.م")}</small>
          {p.discount > 0 && <del>{money(p.price)}</del>}
        </div>
        {offer && (
          <div className="card-offer-timer">
            <Countdown />
          </div>
        )}
      </div>
    </article>
  );
}
function Countdown() {
  const { t } = useShop();
  const [deadline] = useState(() => {
    const saved = stored<unknown>("mn-offer-end", null);
    const end =
      typeof saved === "number" && Number.isFinite(saved) && saved > 0
        ? saved
        : Date.now() + 4 * 86400000 + 11 * 3600000 + 23 * 60000;
    saveStored("mn-offer-end", end);
    return end;
  });
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, deadline - Date.now()),
  );
  useEffect(() => {
    const id = setInterval(
      () => setRemaining(Math.max(0, deadline - Date.now())),
      1000,
    );
    return () => clearInterval(id);
  }, [deadline]);
  const vals = [
    Math.floor(remaining / 86400000),
    Math.floor(remaining / 3600000) % 24,
    Math.floor(remaining / 60000) % 60,
    Math.floor(remaining / 1000) % 60,
  ];
  return (
    <div className="countdown" dir="ltr">
      {vals.map((n, i) => (
        <React.Fragment key={i}>
          {i > 0 && <b>:</b>}
          <div>
            <strong>{String(n).padStart(2, "0")}</strong>
            <small>
              {t(
                ["DAYS", "HOURS", "MINS", "SECS"][i],
                ["يوم", "ساعة", "دقيقة", "ثانية"][i],
              )}
            </small>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
function Newsletter() {
  const { t, notify } = useShop();
  return (
    <section className="newsletter shell">
      <div>
        <div className="eyebrow">
          {t("AN INVITATION TO THE EXCEPTIONAL", "دعوة إلى عالم استثنائي")}
        </div>
        <h2>
          {t("Some things are worth", "بعض الأشياء تستحق")}{" "}
          <em>{t("being first.", "أن تكون أولاً.")}</em>
        </h2>
        <p>
          {t(
            "New arrivals, private offers, and a little inspiration. Delivered thoughtfully.",
            "إصدارات جديدة وعروض خاصة وقليل من الإلهام. نرسلها إليك بعناية.",
          )}
        </p>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!supabase) {
            notify(
              t(
                "Subscriptions require backend connection. Your email has not been sent.",
                "يلزم ربط الخدمة للاشتراك. لم يتم إرسال بريدك.",
              ),
            );
            return;
          }
          const form = new FormData(e.currentTarget);
          const { error } = await supabase.from("subscribers").insert({
            email: form.get("email"),
            sms: form.get("sms") === "on",
            phone: form.get("phone") || null,
          });
          notify(
            error
              ? error.message
              : t(
                  "You’re on the list. Welcome to our world.",
                  "مرحباً بك في عالمنا. تم الاشتراك.",
                ),
          );
        }}
      >
        <div className="newsletter-input">
          <input
            type="email"
            name="email"
            placeholder={t("Your email address", "بريدك الإلكتروني")}
            required
          />
          <button aria-label="Subscribe" type="submit">
            <ArrowRight size={20} />
          </button>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            name="sms"
            onChange={(e) =>
              e.currentTarget.form?.classList.toggle(
                "sms-enabled",
                e.target.checked,
              )
            }
          />
          {t(
            "Notify me about new offers by SMS, too.",
            "أرغب أيضاً في تلقي العروض عبر الرسائل النصية.",
          )}
        </label>
        <input
          className="sms-phone"
          name="phone"
          type="tel"
          placeholder={t("Phone number for SMS", "رقم الهاتف للرسائل")}
        />
      </form>
    </section>
  );
}
function Footer() {
  const { t } = useShop();
  return (
    <footer>
      <div className="footer-main shell">
        <div className="footer-brand">
          <Logo />
          <p>
            {t(
              "Rare scents. Lasting impressions.\nA world of luxury, thoughtfully curated.",
              "عطور نادرة. انطباعات خالدة.\nعالم من الفخامة اختير بعناية.",
            )}
          </p>
          <div className="socials">
            <Link to="/contact" aria-label="Instagram information">
              <Instagram size={17} />
            </Link>
            <Link to="/contact" aria-label="Email information">
              <Mail size={17} />
            </Link>
            <Link to="/contact" aria-label="Contact information">
              <MessageCircle size={17} />
            </Link>
          </div>
        </div>
        <div>
          <h4>{t("EXPLORE", "استكشف")}</h4>
          <Link to="/products">{t("The Collection", "المجموعة")}</Link>
          <Link to="/wishlist">{t("Saved fragrances", "العطور المحفوظة")}</Link>
          <Link to="/bestsellers">{t("Bestsellers", "الأكثر مبيعاً")}</Link>
          <Link to="/offers">{t("Exclusive Offers", "عروض حصرية")}</Link>
          <Link to="/products?category=gift">
            {t("The Gift Edit", "الهدايا")}
          </Link>
        </div>
        <div>
          <h4>{t("THE MAISON", "الدار")}</h4>
          <Link to="/about">{t("Our Story", "حكايتنا")}</Link>
          <Link to="/contact">{t("Contact Us", "تواصل معنا")}</Link>
          <Link to="/faq">
            {t("Frequently Asked Questions", "الأسئلة الشائعة")}
          </Link>
          <Link to="/returns">
            {t("Shipping & Returns", "الشحن والاسترجاع")}
          </Link>
        </div>
        <div>
          <h4>{t("AT YOUR SERVICE", "في خدمتك")}</h4>
          <p>
            {t(
              "A personal approach to finding your scent.",
              "مساعدة شخصية لاختيار عطرك.",
            )}
          </p>
          <Link to="/contact" className="text-link">
            {t("Speak to our team", "تحدث إلى فريقنا")}
            <ArrowUpRight size={14} />
          </Link>
          <span className="payment-icons">
            <b>VISA</b>
            <b className="mastercard">●●</b>
            <b>InstaPay</b>
            <b>VODAFONE</b>
          </span>
          <small>
            {t(
              "Secure checkout · Integration pending",
              "دفع آمن · الربط قيد التجهيز",
            )}
          </small>
        </div>
      </div>
      <div className="footer-bottom shell">
        <span>
          © {new Date().getFullYear()} MAISON NOIR.{" "}
          {t("All rights reserved.", "جميع الحقوق محفوظة.")}
        </span>
        <span>
          {t(
            "Crafted with intention. Worn with distinction.",
            "صُنع بشغف. يُرتدى بتميّز.",
          )}
        </span>
        <Link to="/admin">
          {t("Maison administration", "إدارة الدار")} <LockKeyhole size={10} />
        </Link>
      </div>
    </footer>
  );
}
function WhatsApp() {
  const { t } = useShop();
  const number = import.meta.env.VITE_WHATSAPP_NUMBER;
  return number ? (
    <a
      className="whatsapp"
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp"
    >
      <MessageCircle size={24} />
    </a>
  ) : (
    <Link
      className="whatsapp"
      to="/contact"
      title={t("WhatsApp number coming soon", "رقم واتساب قريباً")}
      aria-label={t(
        "Contact us — WhatsApp coming soon",
        "تواصل معنا — واتساب قريباً",
      )}
    >
      <MessageCircle size={24} />
    </Link>
  );
}
function PageIntro({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="page-intro">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {desc && <p>{desc}</p>}
    </div>
  );
}
function Products({ mode }: { mode?: "offers" | "bestsellers" | "wishlist" }) {
  const { products, t, ar, wish } = useShop();
  const base =
    mode === "bestsellers"
      ? [...products].sort((a, b) => b.sales - a.sales).slice(0, 12)
      : mode === "offers"
        ? products.filter((p) => p.discount > 0)
        : mode === "wishlist"
          ? products.filter((p) => wish.includes(p.id))
          : products;
  const priceCeiling = Math.max(
    150,
    Math.ceil(Math.max(0, ...products.map(priceOf)) / 50) * 50,
  );
  const [params, setParams] = useSearchParams();
  const cat = params.get("category") || "all";
  const [q, setQ] = useState("");
  const [max, setMax] = useState<number | null>(null);
  const [brand, setBrand] = useState("all");
  const [size, setSize] = useState("all");
  const [sort, setSort] = useState(
    mode === "bestsellers" ? "bestseller" : "featured",
  );
  const [filters, setFilters] = useState(false);
  let list = base.filter(
    (p) =>
      (cat === "all" || p.category === cat) &&
      priceOf(p) <= (max ?? priceCeiling) &&
      (brand === "all" || p.brand === brand) &&
      (size === "all" || p.size === size) &&
      (p.name_ar + p.name_en + p.brand + p.category)
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  if (sort === "low") list.sort((a, b) => priceOf(a) - priceOf(b));
  if (sort === "high") list.sort((a, b) => priceOf(b) - priceOf(a));
  if (sort === "bestseller") list.sort((a, b) => b.sales - a.sales);

  return (
    <div className="page shell">
      <PageIntro
        eyebrow={t(
          mode === "wishlist"
            ? "YOUR SAVED DISCOVERIES"
            : mode === "offers"
              ? "AN EXCEPTIONAL OPPORTUNITY"
              : mode === "bestsellers"
                ? "THE MOST LOVED"
                : "YOUR SIGNATURE AWAITS",
          mode === "wishlist"
            ? "اكتشافاتك المحفوظة"
            : mode === "offers"
              ? "فرصة استثنائية"
              : mode === "bestsellers"
                ? "الأكثر حباً"
                : "بصمتك تنتظرك",
        )}
        title={t(
          mode === "wishlist"
            ? "Your saved fragrances."
            : mode === "offers"
              ? "The art of a beautiful offer."
              : mode === "bestsellers"
                ? "Unforgettable favourites."
                : "The fragrance collection.",
          mode === "wishlist"
            ? "عطورك المحفوظة."
            : mode === "offers"
              ? "فن العرض الجميل."
              : mode === "bestsellers"
                ? "عطور لا تُنسى."
                : "مجموعة العطور.",
        )}
        desc={t(
          "Discover extraordinary scents, chosen to become a part of your story.",
          "اكتشف عطوراً استثنائية، اختيرت لتكون جزءاً من حكايتك.",
        )}
      />
      {mode === "offers" && (
        <div className="offer-page-banner">
          <Countdown />
          <CouponCopy />
        </div>
      )}
      <div className="catalog-toolbar">
        <div className="search-input">
          <Search size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(
              "Search fragrance, brand, or type",
              "ابحث عن عطر أو علامة أو نوع",
            )}
          />
          {q && (
            <button
              className="icon-btn"
              onClick={() => setQ("")}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button
          className="btn glass filter-toggle"
          onClick={() => setFilters(!filters)}
        >
          <SlidersHorizontal size={16} />
          {t("Filters", "تصفية")}
        </button>
        <select
          aria-label={t("Sort products", "ترتيب المنتجات")}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="featured">{t("Featured", "المميز")}</option>
          <option value="bestseller">
            {t("Bestselling", "الأكثر مبيعاً")}
          </option>
          <option value="low">
            {t("Price: low to high", "السعر: من الأقل")}
          </option>
          <option value="high">
            {t("Price: high to low", "السعر: من الأعلى")}
          </option>
        </select>
      </div>
      <div className="catalog">
        <aside className={`filters ${filters ? "open" : ""}`}>
          <div className="filter-title">
            {t("Refine your discovery", "اختر ما يناسبك")}
            <button
              className="icon-btn"
              onClick={() => {
                setParams({});
                setMax(null);
                setBrand("all");
                setSize("all");
                setQ("");
              }}
            >
              {t("Reset", "إعادة")}
            </button>
          </div>
          <fieldset>
            <legend>{t("COLLECTION", "المجموعة")}</legend>
            <label>
              <input
                type="radio"
                name="collection"
                checked={cat === "all"}
                onChange={() => setParams({})}
              />
              {t("All fragrances", "كل العطور")}
              <span>{base.length}</span>
            </label>
            {categories.map((c) => (
              <label key={c.slug}>
                <input
                  type="radio"
                  name="collection"
                  checked={cat === c.slug}
                  onChange={() => setParams({ category: c.slug })}
                />
                {ar ? c.ar : c.en}
                <span>{base.filter((p) => p.category === c.slug).length}</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>{t("PRICE RANGE", "نطاق السعر")}</legend>
            <input
              className="range"
              type="range"
              min="0"
              max={priceCeiling}
              aria-label={t("Maximum price", "أقصى سعر")}
              step="50"
              value={max ?? priceCeiling}
              onChange={(e) => setMax(+e.target.value)}
            />
            <div className="range-label">
              <span>0 EGP</span>
              <span>{money(max ?? priceCeiling)} EGP</span>
            </div>
          </fieldset>
          <fieldset>
            <legend>{t("HOUSE / BRAND", "العلامة التجارية")}</legend>
            <select
              aria-label={t("House or brand", "العلامة التجارية")}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            >
              <option value="all">{t("All houses", "جميع العلامات")}</option>
              {[...new Set(products.map((p) => p.brand))].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </fieldset>
          <fieldset>
            <legend>{t("BOTTLE SIZE", "حجم الزجاجة")}</legend>
            <div className="size-options">
              {["50ml", "70ml", "75ml", "80ml", "90ml", "100ml", "Tola"].map(
                (s) => (
                  <button
                    key={s}
                    className={size === s ? "selected" : ""}
                    onClick={() => setSize(size === s ? "all" : s)}
                  >
                    {s}
                  </button>
                ),
              )}
            </div>
          </fieldset>
        </aside>
        <div className="catalog-results">
          <p className="result-count">
            {list.length} {t("exceptional discoveries", "عطراً استثنائياً")}
          </p>
          <div className="product-grid catalog-grid">
            {list.map((p) => (
              <ProductCard
                p={p}
                key={p.id}
                offer={mode === "offers"}
                badge={
                  mode === "bestsellers"
                    ? t("BESTSELLER", "الأكثر مبيعاً")
                    : undefined
                }
              />
            ))}
          </div>
          {!list.length && (
            <div className="empty">
              <Search size={40} />
              <h3>{t("No fragrances found.", "لم نعثر على عطور.")}</h3>
              <p>
                {t(
                  "Try a different search or adjust your filters.",
                  "جرّب البحث بكلمة أخرى أو غيّر التصفية.",
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function CouponCopy() {
  const { t, notify } = useShop();
  return (
    <button
      className="coupon-copy"
      onClick={async () => {
        try {
          if (!navigator.clipboard) throw new Error("Clipboard unavailable");
          await navigator.clipboard.writeText("MAISON10");
        } catch {
          notify(
            t(
              "Could not copy. Enter MAISON10 manually.",
              "تعذّر النسخ. اكتب MAISON10 يدوياً.",
            ),
          );
          return;
        }
        notify(
          t(
            "MAISON10 copied. Demo coupon: 10% off.",
            "تم نسخ MAISON10. رمز تجريبي لخصم ١٠٪.",
          ),
        );
      }}
    >
      <span>
        {t("A welcome gesture · Demo code", "هدية ترحيبية · رمز تجريبي")}
      </span>
      <b>
        MAISON10 <Copy size={14} />
      </b>
    </button>
  );
}
function CartDrawer({ close }: { close: () => void }) {
  useDialog(true, close);
  const { cart, products, t, setCart } = useShop();
  const items = cart
    .map((c) => ({ ...c, p: products.find((p) => p.id === c.id) }))
    .filter((c) => c.p);
  const subtotal = items.reduce((n, c) => n + priceOf(c.p!) * c.qty, 0);
  return (
    <div className="drawer-layer">
      <button
        className="drawer-backdrop"
        aria-label="Close bag"
        onClick={close}
      />
      <aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t("Your bag", "حقيبتك")}
      >
        <div className="drawer-head">
          <h2>
            {t("Your collection", "مجموعتك")}{" "}
            <small>({cart.reduce((n, c) => n + c.qty, 0)})</small>
          </h2>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="cart-items">
          {items.map(({ p, qty, id }) => (
            <div className="cart-item" key={id}>
              <img src={p!.image_url} alt="" />
              <div>
                <small className="brand">{p!.brand}</small>
                <Link onClick={close} to={`/products/${id}`}>
                  <h3>{t(p!.name_en, p!.name_ar)}</h3>
                </Link>
                <small>{p!.size}</small>
                <div className="qty">
                  <button
                    aria-label="Decrease quantity"
                    onClick={() =>
                      setCart((c) =>
                        c.flatMap((x) =>
                          x.id === id
                            ? x.qty > 1
                              ? [{ ...x, qty: x.qty - 1 }]
                              : []
                            : [x],
                        ),
                      )
                    }
                  >
                    <Minus size={12} />
                  </button>
                  <span>{qty}</span>
                  <button
                    aria-label="Increase quantity"
                    disabled={qty >= p!.stock}
                    onClick={() =>
                      setCart((c) =>
                        c.map((x) =>
                          x.id === id ? { ...x, qty: x.qty + 1 } : x,
                        ),
                      )
                    }
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              <div className="cart-price">
                {money(priceOf(p!) * qty)} EGP
                <button
                  className="icon-btn"
                  aria-label="Remove item"
                  onClick={() => setCart((c) => c.filter((x) => x.id !== id))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {!items.length && (
            <div className="empty">
              <ShoppingBag size={44} />
              <h3>{t("Your next signature awaits.", "عطرك القادم ينتظرك.")}</h3>
              <p>{t("Your bag is currently empty.", "حقيبتك فارغة حالياً.")}</p>
              <Link className="btn gold" to="/products" onClick={close}>
                {t("Explore the collection", "اكتشف المجموعة")}
              </Link>
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div className="cart-summary">
            <div>
              <span>{t("Subtotal", "المجموع الفرعي")}</span>
              <strong>{money(subtotal)} EGP</strong>
            </div>
            <p>
              {t(
                "Shipping and gift options calculated at checkout.",
                "تُحسب تكاليف الشحن وخيارات الهدايا عند الدفع.",
              )}
            </p>
            <Link className="btn gold full" onClick={close} to="/checkout">
              {t("Continue to checkout", "متابعة إلى الدفع")}
              <ArrowRight size={17} />
            </Link>
            <button className="text-link" onClick={close}>
              {t("Continue discovering", "تابع الاكتشاف")}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
function Checkout() {
  const {
    cart,
    products,
    t,
    user,
    notify,
    setCart,
    shippingRates,
    catalogReady,
  } = useShop();
  const [gov, setGov] = useState("Cairo");
  const [wrap, setWrap] = useState(false);
  const [method, setMethod] = useState("cod");
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [applied, setApplied] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState("");
  const subtotal = cart.reduce(
    (n, c) =>
      n +
      (products.find((p) => p.id === c.id)
        ? priceOf(products.find((p) => p.id === c.id)!) * c.qty
        : 0),
    0,
  );
  const shipping = shippingRates[gov] ?? 75;
  const total =
    subtotal +
    shipping +
    (wrap ? 50 : 0) -
    Math.round((subtotal * discount) / 100);
  if (order)
    return (
      <div className="page shell">
        <PageIntro
          eyebrow={t("ORDER RECEIVED", "تم استلام الطلب")}
          title={t("Your order is being prepared.", "طلبك قيد التجهيز.")}
          desc={`${t("Order reference", "رقم الطلب")}: ${order}`}
        />
        <div className="notice">
          {t(
            "Payment status: pending. No online payment has been processed.",
            "حالة الدفع: معلّق. لم تتم معالجة أي دفعة إلكترونية.",
          )}
        </div>
        <Link className="btn gold" to="/account">
          {t("Track your order", "تتبع طلبك")}
        </Link>
      </div>
    );
  if (!cart.length)
    return (
      <div className="page shell empty">
        <ShoppingBag size={44} />
        <h1>{t("Your bag is empty.", "حقيبتك فارغة.")}</h1>
        <Link className="btn gold" to="/products">
          {t("Discover the collection", "اكتشف المجموعة")}
        </Link>
      </div>
    );
  return (
    <div className="page shell">
      <PageIntro
        eyebrow={t("A FEW FINAL DETAILS", "بعض التفاصيل الأخيرة")}
        title={t("Make it yours.", "اجعله لك.")}
      />
      <form
        className="checkout-layout"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!catalogReady) {
            notify(
              t(
                "The catalog is unavailable. Please retry shortly.",
                "المنتجات غير متاحة. حاول بعد قليل.",
              ),
            );
            return;
          }
          if (!user) {
            notify(
              t(
                "Please sign in before placing your order.",
                "يرجى تسجيل الدخول قبل تأكيد الطلب.",
              ),
            );
            return;
          }
          if (method !== "cod") {
            notify(
              t(
                "Payment gateway integration required. No charge or order has been made.",
                "يلزم ربط بوابة الدفع. لم تُخصم أي مبالغ ولم يُنشأ طلب.",
              ),
            );
            return;
          }
          setBusy(true);
          const form = new FormData(e.currentTarget);
          try {
            const payload = {
              items: cart,
              governorate: gov,
              gift_wrap: wrap,
              gift_card_text: form.get("gift_card_text"),
              payment_method: method,
              discount_code: applied,
              address: form.get("address"),
              phone: form.get("phone"),
              name: form.get("name"),
            };
            const result = await api(
              "orders/create",
              {
                ...payload,
                idempotency_key: await checkoutRequestKey(user.id, payload),
              },
              user.id,
            );
            finishCheckout(user.id);
            saveStored(cartKey(user.id), []);
            setOrder(result.id);
            setCart([]);
          } catch (err) {
            notify((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <h3>01 — {t("Delivery details", "تفاصيل التوصيل")}</h3>
          {!user && (
            <div className="notice">
              <Link to="/account">
                {t(
                  "Sign in or create an account to place an order →",
                  "سجّل الدخول أو أنشئ حساباً لإتمام الطلب ←",
                )}
              </Link>
            </div>
          )}
          <div className="form-grid">
            <Field
              label={t("Full name", "الاسم الكامل")}
              name="name"
              required
            />
            <Field
              label={t("Phone number", "رقم الهاتف")}
              name="phone"
              type="tel"
              required
            />
            <label>
              {t("Governorate", "المحافظة")}
              <select value={gov} onChange={(e) => setGov(e.target.value)}>
                {governorates.map((g) => (
                  <option key={g[0]} value={g[0]}>
                    {t(g[0], g[1])} — {shippingRates[g[0]] ?? 75} EGP
                  </option>
                ))}
              </select>
            </label>
            <Field
              label={t("Delivery address", "عنوان التوصيل")}
              name="address"
              required
            />
          </div>
          <h3>02 — {t("A thoughtful touch", "لمسة تعبّر عنك")}</h3>
          <label className="check-label gift-check">
            <input
              type="checkbox"
              checked={wrap}
              onChange={(e) => setWrap(e.target.checked)}
            />
            <Gift size={20} />
            {t(
              "Signature gift wrapping (+50 EGP)",
              "تغليف هدية مميز (+٥٠ ج.م)",
            )}
          </label>
          {wrap && (
            <label>
              {t("Your gift card message", "رسالة بطاقة الهدية")}
              <textarea
                name="gift_card_text"
                maxLength={300}
                placeholder={t(
                  "A few words, a lasting memory…",
                  "كلمات قليلة، ذكرى تدوم…",
                )}
              />
            </label>
          )}
          <h3>03 — {t("Payment preference", "طريقة الدفع")}</h3>
          <div className="payment-options">
            {[
              ["vodafone_cash", "Vodafone Cash", "فودافون كاش"],
              ["visa", "Visa / Mastercard", "فيزا / ماستركارد"],
              ["instapay", "InstaPay", "إنستاباي"],
              ["cod", "Cash on delivery", "الدفع عند الاستلام"],
            ].map(([id, en, ar]) => (
              <label className={method === id ? "selected" : ""} key={id}>
                <input
                  type="radio"
                  name="payment"
                  checked={method === id}
                  onChange={() => setMethod(id)}
                />
                {t(en, ar)}
                {id !== "cod" && (
                  <small>{t("Integration required", "يلزم الربط")}</small>
                )}
              </label>
            ))}
          </div>
          {method !== "cod" && (
            <div className="notice">
              <LockKeyhole size={16} />
              {t(
                "Gateway not connected. Secure card fields will appear here once enabled. Never enter payment details until integration is complete.",
                "بوابة الدفع غير متصلة. ستظهر حقول الدفع الآمن بعد تفعيل الربط. لا تدخل بيانات الدفع قبل اكتمال الربط.",
              )}
            </div>
          )}
        </div>
        <aside className="checkout-summary">
          <h3>{t("Your selection", "اختياراتك")}</h3>
          {cart.map((c) => {
            const p = products.find((p) => p.id === c.id);
            return (
              p && (
                <div className="summary-item" key={p.id}>
                  <img src={p.image_url} alt="" />
                  <span>
                    {t(p.name_en, p.name_ar)}
                    <small>
                      {c.qty} × {p.size}
                    </small>
                  </span>
                  <b>{money(priceOf(p) * c.qty)}</b>
                </div>
              )
            );
          })}
          <div className="coupon-input">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder={t("Coupon code", "رمز الخصم")}
            />
            <button
              type="button"
              onClick={async () => {
                if (!supabase) {
                  if (coupon.toUpperCase() === "MAISON10") {
                    setDiscount(10);
                    setApplied("MAISON10");
                    notify(
                      t(
                        "Demo discount applied. Connect backend to place orders.",
                        "تم تطبيق الخصم التجريبي. اربط الخدمة لإتمام الطلب.",
                      ),
                    );
                  } else {
                    setDiscount(0);
                    setApplied("");
                    notify(t("Coupon not found.", "رمز الخصم غير موجود."));
                  }
                  return;
                }
                try {
                  const d = await api("coupons/validate", { code: coupon });
                  setDiscount(d.discount_percent);
                  setApplied(coupon);
                } catch (e) {
                  setDiscount(0);
                  setApplied("");
                  notify((e as Error).message);
                }
              }}
            >
              {t("Apply", "تطبيق")}
            </button>
          </div>
          <div className="summary-row">
            <span>{t("Subtotal", "المجموع الفرعي")}</span>
            <b>{money(subtotal)} EGP</b>
          </div>
          <div className="summary-row">
            <span>{t("Delivery", "التوصيل")}</span>
            <b>{shipping} EGP</b>
          </div>
          {wrap && (
            <div className="summary-row">
              <span>{t("Gift wrap", "تغليف هدية")}</span>
              <b>50 EGP</b>
            </div>
          )}
          {discount > 0 && (
            <div className="summary-row">
              <span>
                {t("Discount", "الخصم")} ({discount}%)
              </span>
              <b>−{money(Math.round((subtotal * discount) / 100))} EGP</b>
            </div>
          )}
          <div className="summary-row total">
            <span>{t("Total", "الإجمالي")}</span>
            <b>{money(total)} EGP</b>
          </div>
          <button
            className="btn gold full"
            disabled={busy || !catalogReady}
            type="submit"
          >
            {busy
              ? t("Processing…", "جارٍ المعالجة…")
              : t("Place order", "إتمام الطلب")}
            <ArrowRight size={17} />
          </button>
          <p className="muted">
            {t(
              "Online payments are pending integration. Orders are only created with a connected backend.",
              "الدفع الإلكتروني بانتظار الربط. لا تُنشأ الطلبات إلا بعد توصيل الخدمة.",
            )}
          </p>
        </aside>
      </form>
    </div>
  );
}
function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label>
      {label}
      <input {...props} />
    </label>
  );
}
function ProductPage() {
  const { products, ar, t, add, wish, toggleWish, user, notify, catalogReady } =
    useShop();
  const id = useLocation().pathname.split("/").pop();
  const p = products.find((p) => p.id === id);
  const [lightbox, setLightbox] = useState(false);
  useDialog(lightbox, () => setLightbox(false));
  const [reviews, setReviews] = useState<any[]>([]);
  const [rating, setRating] = useState(5);
  useEffect(() => {
    if (supabase && p)
      supabase
        .from("reviews")
        .select("*")
        .eq("product_id", p.id)
        .then(({ data }) => setReviews(data || []));
  }, [p?.id]);
  if (!p && !catalogReady)
    return (
      <div className="page shell">
        <p>
          {t("Waiting for catalog availability…", "في انتظار إتاحة المنتجات…")}
        </p>
      </div>
    );
  if (!p)
    return (
      <div className="page shell">
        <h1>{t("Fragrance not found", "العطر غير موجود")}</h1>
        <Link to="/products">{t("Back to collection", "العودة للمجموعة")}</Link>
      </div>
    );
  return (
    <div className="page shell">
      <div className="breadcrumb">
        <Link to="/products">{t("The Collection", "المجموعة")}</Link> /{" "}
        {t(p.name_en, p.name_ar)}
      </div>
      <div className="product-detail">
        <button
          className="detail-image"
          onClick={() => setLightbox(true)}
          aria-label="Enlarge product image"
        >
          <img src={p.image_url} alt={t(p.name_en, p.name_ar)} />
          <span>
            <Search size={16} />
            {t("View closer", "نظرة أقرب")}
          </span>
        </button>
        <div className="detail-copy">
          <div className="eyebrow">{p.brand}</div>
          <h1>{ar ? p.name_ar : p.name_en}</h1>
          <div className="rating">
            <Star size={15} fill="currentColor" />
            {p.rating.toFixed(1)}{" "}
            <span>
              ({p.reviews_count}{" "}
              {t("ratings · catalog data", "تقييماً · بيانات الكتالوج")})
            </span>
          </div>
          <p>
            {t(
              "A distinctive expression of elegance. An exceptional fragrance that unfolds beautifully, leaving an unforgettable impression from the first moment to the last.",
              "تعبير مميز عن الأناقة. عطر استثنائي تتكشف طبقاته برقي، ليترك انطباعاً لا يُنسى من اللحظة الأولى وحتى النهاية.",
            )}
          </p>
          <div className="size-options">
            <button className="selected">{p.size}</button>
          </div>
          <div className="detail-price">
            {money(priceOf(p))} <small>EGP</small>
            {p.discount > 0 && <del>{money(p.price)} EGP</del>}
          </div>
          <span className="stock">
            ●{" "}
            {p.stock > 0
              ? t("In stock · ready to discover", "متوفر · جاهز للاكتشاف")
              : t("Coming soon", "متاح قريباً")}
          </span>
          <div className="detail-actions">
            <button
              className="btn gold"
              onClick={() => add(p.id)}
              disabled={!p.stock}
            >
              <ShoppingBag size={17} />
              {t("Add to your collection", "أضف إلى مجموعتك")}
            </button>
            <button
              className="btn glass"
              onClick={() => toggleWish(p.id)}
              aria-label="Save fragrance"
            >
              <Heart
                fill={wish.includes(p.id) ? "currentColor" : "none"}
                size={19}
              />
            </button>
          </div>
          <div className="detail-benefits">
            <span>
              <ShieldCheck size={17} />
              {t("Authenticity assured", "أصالة مضمونة")}
            </span>
            <span>
              <Truck size={17} />
              {t("Delivery across Egypt", "توصيل لجميع أنحاء مصر")}
            </span>
            <span>
              <Gift size={17} />
              {t("Gift wrapping available", "تغليف الهدايا متاح")}
            </span>
          </div>
        </div>
      </div>
      <section className="reviews-section">
        <SectionHead
          eyebrow={t("SHARED IMPRESSIONS", "انطباعات مشتركة")}
          title={t("The fragrance, through your eyes.", "العطر من وجهة نظرك.")}
        />
        {reviews.length ? (
          reviews.map((r) => (
            <article className="review" key={r.id}>
              <span className="rating">
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)}
              </span>
              <p>{r.comment}</p>
              <small>{new Date(r.created_at).toLocaleDateString()}</small>
            </article>
          ))
        ) : (
          <p className="muted">
            {t(
              "Be the first to share your impression. No customer reviews yet.",
              "كن أول من يشارك انطباعه. لا توجد مراجعات عملاء بعد.",
            )}
          </p>
        )}
        <form
          className="review-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!user) {
              notify(
                t("Sign in to share your review.", "سجل الدخول لكتابة مراجعة."),
              );
              return;
            }
            const form = e.currentTarget;
            try {
              const r = await api("reviews/add", {
                product_id: p.id,
                rating,
                comment: new FormData(form).get("comment"),
              });
              setReviews((rs) => [r, ...rs]);
              form.reset();
              notify(t("Thank you for your review.", "شكراً على مراجعتك."));
            } catch (err) {
              notify((err as Error).message);
            }
          }}
        >
          <label>
            {t("Your rating", "تقييمك")}
            <select value={rating} onChange={(e) => setRating(+e.target.value)}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Your impression", "انطباعك")}
            <textarea name="comment" required maxLength={1500} />
          </label>
          <button className="btn glass">
            {t("Share review", "نشر المراجعة")}
          </button>
        </form>
      </section>
      <div className="mobile-sticky">
        <span>{money(priceOf(p))} EGP</span>
        <button
          className="btn gold"
          onClick={() => add(p.id)}
          disabled={!p.stock}
        >
          {t("Add to bag", "أضف للحقيبة")}
          <Plus size={16} />
        </button>
      </div>
      {lightbox && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Product image"
        >
          <button
            className="icon-btn"
            onClick={() => setLightbox(false)}
            aria-label="Close"
          >
            <X size={30} />
          </button>
          <img src={p.image_url} alt={t(p.name_en, p.name_ar)} />
        </div>
      )}
    </div>
  );
}
function About() {
  const { t } = useShop();
  return (
    <div className="page shell">
      <PageIntro
        eyebrow={t("ESTABLISHED 2010", "منذ ٢٠١٠")}
        title={t(
          "An enduring love for the exceptional.",
          "شغف خالد بكل استثنائي.",
        )}
        desc={t("Our story is written in scent.", "حكايتنا تُكتب بالعطر.")}
      />
      <div className="about-layout">
        <img src="/images/oud.jpg" alt="The art of scent" />
        <div>
          <div className="eyebrow">{t("OUR STORY", "حكايتنا")}</div>
          <h2>
            {t("Not just worn.", "لا يُرتدى فحسب.")}
            <br />
            <em>{t("Remembered.", "بل يُتذكر.")}</em>
          </h2>
          <p>
            {t(
              "Since 2010, MAISON NOIR has been guided by a simple belief: a truly exceptional fragrance is an extension of the person who wears it. Our collection bridges celebrated perfume houses and the timeless traditions of oriental perfumery.",
              "منذ عام ٢٠١٠، تنطلق ميزون نوار من إيمان بسيط: العطر الاستثنائي حقاً هو امتداد لشخصية من يرتديه. تجمع مجموعتنا بين دور العطور العريقة وتقاليد العطارة الشرقية الخالدة.",
            )}
          </p>
          <h3>{t("Our vision", "رؤيتنا")}</h3>
          <p>
            {t(
              "To make discovering your signature fragrance a personal, inspiring experience. Thoughtful curation, genuine quality, and a love of beautiful details guide everything we do.",
              "نجعل اكتشاف عطرك الخاص تجربة شخصية وملهمة. الاختيار بعناية، والجودة الأصيلة، وحب التفاصيل الجميلة هي ما يوجه كل ما نقدمه.",
            )}
          </p>
          <Link to="/contact" className="text-link">
            {t("Visit our maison", "زر دارنا")}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
      <SectionHead
        eyebrow={t("A GLIMPSE INSIDE", "نظرة إلى الداخل")}
        title={t("The world of our maison.", "عالم دارنا.")}
      />
      <div className="store-grid">
        {[1, 2, 3].map((n) => (
          <div key={n}>
            <MapPin size={25} />
            <h3>{t(`Store photograph ${n}`, `صورة المتجر ${n}`)}</h3>
            <p>{t("Coming soon — to be confirmed", "قريباً — يُؤكد لاحقاً")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
const faqs = [
  [
    "How long does delivery take?",
    "كم يستغرق التوصيل؟",
    "Delivery is available across Egypt. Shipping cost is calculated by governorate at checkout. Estimated delivery is 2–5 working days, subject to confirmation.",
    "نوصل إلى جميع أنحاء مصر. تُحسب التكلفة حسب المحافظة عند الدفع. مدة التوصيل المتوقعة ٢–٥ أيام عمل، وتُؤكد عند الطلب.",
  ],
  [
    "Can I return my fragrance?",
    "هل يمكنني استرجاع العطر؟",
    "You may request a return within 14 days of delivery for unopened, unused products in their original sealed packaging. Please see our return policy for full conditions.",
    "يمكنك طلب الاسترجاع خلال ١٤ يوماً من الاستلام للمنتجات غير المفتوحة وغير المستخدمة وفي عبواتها الأصلية المغلقة. راجع سياسة الاسترجاع لجميع الشروط.",
  ],
  [
    "Which payment methods are available?",
    "ما طرق الدفع المتاحة؟",
    "Cash on delivery is supported when the backend is connected. Vodafone Cash, Visa / Mastercard, and InstaPay are planned and require payment gateway integration. No online payments are currently processed.",
    "الدفع عند الاستلام مدعوم بعد توصيل الخدمة. فودافون كاش وفيزا / ماستركارد وإنستاباي تتطلب ربط بوابة الدفع. لا تُعالج مدفوعات إلكترونية حالياً.",
  ],
  [
    "Are the fragrances authentic?",
    "هل العطور أصلية؟",
    "Our collection is curated with authenticity and quality in mind. Contact our team for product-specific sourcing information before purchasing.",
    "نختار مجموعتنا مع الاهتمام بالأصالة والجودة. تواصل مع فريقنا لمعرفة معلومات مصدر أي منتج قبل الشراء.",
  ],
  [
    "Can I add gift wrapping?",
    "هل يمكن إضافة تغليف هدية؟",
    "Yes. Choose signature gift wrapping at checkout for 50 EGP, and add a personal gift card message.",
    "نعم. اختر تغليف الهدايا المميز عند الدفع مقابل ٥٠ جنيهاً، وأضف رسالة شخصية لبطاقة الهدية.",
  ],
];
function FAQ() {
  const { t } = useShop();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="page shell narrow">
      <PageIntro
        eyebrow={t("A LITTLE CLARITY", "إجابات واضحة")}
        title={t("Questions, beautifully answered.", "لكل سؤال، إجابة.")}
        desc={t(
          "Everything you need to know before your next discovery.",
          "كل ما تحتاج معرفته قبل اكتشافك القادم.",
        )}
      />
      <div className="faq-list">
        {faqs.map(([en, ar, ans, ansar], i) => (
          <div className="faq-item" key={en}>
            <button
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
            >
              {t(en, ar)}
              {open === i ? <Minus size={18} /> : <Plus size={18} />}
            </button>
            {open === i && <p>{t(ans, ansar)}</p>}
          </div>
        ))}
      </div>
      <Link className="text-link" to="/contact">
        {t("Still curious? Speak to us", "لديك سؤال آخر؟ تواصل معنا")}
        <ArrowUpRight size={16} />
      </Link>
    </div>
  );
}
function Returns() {
  const { t } = useShop();
  return (
    <div className="page shell narrow">
      <PageIntro
        eyebrow={t("SHOP WITH CONFIDENCE", "تسوق بثقة")}
        title={t("Returns & peace of mind.", "الاسترجاع وراحة البال.")}
      />
      {[
        [
          "14 days to decide",
          "١٤ يوماً لاتخاذ القرار",
          "Request a return within 14 days of receiving your order. Keep your proof of purchase and contact our team before sending anything back.",
          "اطلب الاسترجاع خلال ١٤ يوماً من استلام طلبك. احتفظ بإثبات الشراء وتواصل مع فريقنا قبل إعادة أي منتج.",
        ],
        [
          "Return conditions",
          "شروط الاسترجاع",
          "Products must be unused, unopened, and in their original sealed packaging with all accessories. Opened perfumes, used items, and personalized gift items cannot be returned unless faulty.",
          "يجب أن تكون المنتجات غير مستخدمة وغير مفتوحة وفي عبواتها الأصلية المغلقة مع جميع الملحقات. لا يمكن إرجاع العطور المفتوحة أو المنتجات المستخدمة أو الهدايا المخصصة إلا في حالة وجود عيب.",
        ],
        [
          "Damaged or incorrect items",
          "المنتجات التالفة أو غير الصحيحة",
          "Please contact us promptly with your order number and photographs. We will review the issue and arrange a suitable resolution. Statutory consumer rights remain unaffected.",
          "يرجى التواصل معنا سريعاً برقم الطلب وصور المنتج. سنراجع المشكلة ونرتب حلاً مناسباً، مع عدم الإخلال بحقوق المستهلك القانونية.",
        ],
        [
          "Refunds & delivery fees",
          "المبالغ المستردة ورسوم التوصيل",
          "Approved refunds are processed after inspection to the original payment method when available. Return shipping costs are confirmed with our team; faulty or incorrect items are handled at our expense.",
          "تُعالج المبالغ المستردة بعد الموافقة والفحص عبر طريقة الدفع الأصلية عند توفرها. تُؤكد تكلفة الشحن المرتجع مع فريقنا؛ ونتحمل نحن تكلفة المنتجات المعيبة أو غير الصحيحة.",
        ],
      ].map(([en, ar, desc, descar]) => (
        <section className="policy-block" key={en}>
          <h2>{t(en, ar)}</h2>
          <p>{t(desc, descar)}</p>
        </section>
      ))}
      <Link to="/contact" className="btn gold">
        {t("Contact our team", "تواصل مع فريقنا")}
      </Link>
    </div>
  );
}
function Contact() {
  const { t, notify } = useShop();
  return (
    <div className="page shell">
      <PageIntro
        eyebrow={t("PERSONALLY, FOR YOU", "خصيصاً من أجلك")}
        title={t("A conversation begins here.", "هنا تبدأ الحكاية.")}
        desc={t(
          "Finding your scent is personal. We’re here to help.",
          "اختيار عطرك أمر شخصي. نحن هنا لنساعدك.",
        )}
      />
      <div className="contact-layout">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!supabase) {
              notify(
                t(
                  "Contact form integration required. Your message has not been sent.",
                  "يلزم ربط نموذج التواصل. لم يتم إرسال رسالتك.",
                ),
              );
              return;
            }
            const f = new FormData(e.currentTarget);
            const { error } = await supabase.from("contact_messages").insert({
              name: f.get("name"),
              phone: f.get("phone"),
              message: f.get("message"),
            });
            notify(
              error
                ? error.message
                : t("Your message has been received.", "تم استلام رسالتك."),
            );
          }}
        >
          <Field label={t("Your name", "اسمك")} name="name" required />
          <Field
            label={t("Phone number", "رقم الهاتف")}
            type="tel"
            name="phone"
            required
          />
          <label>
            {t("How can we help?", "كيف يمكننا مساعدتك؟")}
            <textarea name="message" rows={5} required maxLength={2000} />
          </label>
          <button className="btn gold">
            {t("Send your message", "أرسل رسالتك")}
            <ArrowUpRight size={17} />
          </button>
        </form>
        <div className="contact-info">
          <h2>{t("At your service.", "في خدمتك.")}</h2>
          <div>
            <MapPin size={19} />
            <p>
              <b>{t("Our branches", "فروعنا")}</b>
              <span>
                {t("Coming soon — to be confirmed", "قريباً — يُؤكد لاحقاً")}
              </span>
            </p>
          </div>
          <div>
            <Phone size={19} />
            <p>
              <b>{t("Speak to us", "اتصل بنا")}</b>
              <span>
                {t("Coming soon — to be confirmed", "قريباً — يُؤكد لاحقاً")}
              </span>
            </p>
          </div>
          <div className="map-placeholder">
            <MapPin size={28} />
            <p>{t("Branch map coming soon", "خريطة الفروع قريباً")}</p>
            <small>
              {t("Location to be confirmed", "يُؤكد الموقع لاحقاً")}
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
function PasswordReset() {
  const { user, ar, notify, authReady } = useShop();
  return (
    <ResetPassword
      ar={ar}
      notify={notify}
      authenticated={!!user}
      authReady={authReady}
    />
  );
}
function Account() {
  const { user, t, notify, ar } = useShop();
  const [forgot, setForgot] = useState(false);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => {
    if (user && supabase) {
      const load = () =>
        supabase!
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .then(({ data }) => setOrders(data || []));
      load();
      const c = supabase
        .channel("my-orders")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `customer_id=eq.${user.id}`,
          },
          load,
        )
        .subscribe();
      return () => {
        supabase!.removeChannel(c);
      };
    }
  }, [user]);
  if (forgot)
    return (
      <ForgotPassword ar={ar} notify={notify} onBack={() => setForgot(false)} />
    );
  if (user)
    return (
      <div className="page shell">
        <PageIntro
          eyebrow={t("WELCOME TO YOUR MAISON", "مرحباً بك في دارك")}
          title={t("Your account. Your collection.", "حسابك. مجموعتك.")}
          desc={user.email}
        />
        <button className="btn glass" onClick={() => supabase?.auth.signOut()}>
          <LogOut size={16} />
          {t("Sign out", "تسجيل الخروج")}
        </button>
        <Link className="btn glass" to="/wishlist">
          {t("Saved fragrances", "العطور المحفوظة")}
        </Link>
        <h2 className="orders-heading">{t("Your orders", "طلباتك")}</h2>
        {!orders.length && (
          <div className="empty">
            <Package size={36} />
            <p>
              {t(
                "Your story is just beginning. No orders yet.",
                "حكايتك تبدأ الآن. لا توجد طلبات بعد.",
              )}
            </p>
            <Link className="text-link" to="/products">
              {t("Discover the collection", "اكتشف المجموعة")}
            </Link>
          </div>
        )}
        {orders.map((o) => (
          <div className="order-card" key={o.id}>
            <div className="summary-row">
              <b>#{o.id.slice(0, 8)}</b>
              <span>
                {money(o.total)} EGP ·{" "}
                {t(
                  o.payment_status,
                  o.payment_status === "paid"
                    ? "مدفوع"
                    : o.payment_status === "failed"
                      ? "فشل الدفع"
                      : "معلّق",
                )}
              </span>
            </div>
            <small>{new Date(o.created_at).toLocaleDateString()}</small>
            <div className="tracking">
              {[
                ["preparing", "Preparing", "قيد التجهيز"],
                ["shipped", "Shipped", "تم الشحن"],
                ["delivered", "Delivered", "تم التوصيل"],
              ].map(([id, en, ar], i) => (
                <div
                  key={id}
                  className={
                    ["preparing", "shipped", "delivered"].indexOf(
                      o.order_status,
                    ) >= i
                      ? "done"
                      : ""
                  }
                >
                  <span>
                    <Check size={15} />
                  </span>
                  {t(en, ar)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  return (
    <div className="page shell auth-page">
      <div className="auth-image">
        <img src="/images/hero.jpg" alt="" />
        <div>
          <Logo />
          <h2>
            {t("Your world of", "عالمك من")}
            <br />
            <em>{t("exceptional.", "الاستثناء.")}</em>
          </h2>
        </div>
      </div>
      <div className="auth-form">
        <PageIntro
          eyebrow={t("THE MAISON AWAITS", "الدار تنتظرك")}
          title={t(
            register ? "A new beginning." : "Welcome back.",
            register ? "بداية جديدة." : "مرحباً بعودتك.",
          )}
        />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!supabase) {
              notify(
                t(
                  "Supabase connection required. No account has been created.",
                  "يلزم توصيل Supabase. لم يتم إنشاء حساب.",
                ),
              );
              return;
            }
            setBusy(true);
            const f = new FormData(e.currentTarget);
            const email = String(f.get("email")),
              password = String(f.get("password"));
            const { error } = register
              ? await supabase.auth.signUp({
                  email,
                  password,
                  options: {
                    data: { name: f.get("name"), phone: f.get("phone") },
                  },
                })
              : await supabase.auth.signInWithPassword({ email, password });
            setBusy(false);
            notify(
              error
                ? error.message
                : t(
                    register
                      ? "Check your email to confirm your account."
                      : "Welcome back to Maison Noir.",
                    register
                      ? "تحقق من بريدك لتأكيد حسابك."
                      : "مرحباً بعودتك إلى ميزون نوار.",
                  ),
            );
          }}
        >
          {register && (
            <>
              <Field label={t("Your name", "اسمك")} name="name" required />
              <Field
                label={t("Phone number", "رقم الهاتف")}
                name="phone"
                type="tel"
                required
              />
            </>
          )}
          <Field
            label={t("Email address", "البريد الإلكتروني")}
            type="email"
            name="email"
            required
          />
          <Field
            label={t("Password", "كلمة المرور")}
            type="password"
            name="password"
            minLength={8}
            required
          />
          <button className="btn gold full" disabled={busy}>
            {busy
              ? "…"
              : t(
                  register ? "Create account" : "Sign in",
                  register ? "إنشاء حساب" : "تسجيل الدخول",
                )}
          </button>
        </form>
        {!register && (
          <button className="text-link" onClick={() => setForgot(true)}>
            {t("Forgot password?", "نسيت كلمة المرور؟")}
          </button>
        )}
        <button className="text-link" onClick={() => setRegister(!register)}>
          {t(
            register
              ? "Already a member? Sign in"
              : "New to the maison? Create an account",
            register ? "لديك حساب؟ سجّل الدخول" : "جديد في دارنا؟ أنشئ حساباً",
          )}
        </button>
        <small className="muted">
          {t(
            "Secure email & password authentication by Supabase.",
            "تسجيل آمن عبر البريد وكلمة المرور باستخدام Supabase.",
          )}
        </small>
      </div>
    </div>
  );
}
function Admin() {
  const { user, t, notify, products, setProducts } = useShop();
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState("products");
  const [edit, setEdit] = useState<Partial<Product> | null>(null);
  useDialog(!!edit, () => setEdit(null));
  const [orders, setOrders] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user || !supabase) {
      setAllowed(false);
      setChecked(true);
      return;
    }
    supabase
      .from("admins")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setAllowed(!!data);
        setChecked(true);
      });
  }, [user]);
  useEffect(() => {
    if (allowed && supabase) {
      supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data }) => setOrders(data || []));
      supabase
        .from("coupons")
        .select("*")
        .then(({ data }) => setCoupons(data || []));
    }
  }, [allowed]);
  if (!checked)
    return (
      <div className="page shell">{t("Checking access…", "جارٍ التحقق…")}</div>
    );
  if (!allowed)
    return (
      <div className="page shell narrow">
        <PageIntro
          eyebrow={t("PRIVATE ACCESS", "دخول خاص")}
          title={t("Maison administration.", "إدارة الدار.")}
          desc={t(
            "Protected by Supabase Auth and administrator role verification. A backend connection and an authorized admin account are required.",
            "محمية بمصادقة Supabase والتحقق من صلاحية المدير. يلزم توصيل الخدمة وحساب مدير مخوّل.",
          )}
        />
        <div className="notice">
          <LockKeyhole size={20} />
          {!supabase
            ? t(
                "Backend not connected. See README to configure Supabase.",
                "الخدمة غير متصلة. راجع README لإعداد Supabase.",
              )
            : t(
                "Administrator access required.",
                "يلزم تسجيل الدخول بحساب مدير.",
              )}
        </div>
        <Link to="/account" className="btn gold">
          {t("Sign in", "تسجيل الدخول")}
        </Link>
      </div>
    );
  const revenue = orders
    .filter((o) => o.payment_status === "paid")
    .reduce((n, o) => n + o.total, 0);
  return (
    <div className="page shell">
      <PageIntro
        eyebrow="MAISON NOIR"
        title={t("The maison, at a glance.", "نظرة شاملة على الدار.")}
      />
      <div className="admin-tabs">
        {[
          ["products", "Products", "المنتجات"],
          ["orders", "Orders", "الطلبات"],
          ["coupons", "Coupons", "القسائم"],
          ["reports", "Reports", "التقارير"],
        ].map(([id, en, ar]) => (
          <button
            className={`btn ${tab === id ? "gold" : "glass"}`}
            key={id}
            onClick={() => setTab(id)}
          >
            {t(en, ar)}
          </button>
        ))}
      </div>
      {tab === "products" && (
        <>
          <button
            className="btn gold"
            onClick={() =>
              setEdit({
                name_en: "",
                name_ar: "",
                brand: "MAISON NOIR",
                size: "100ml",
                price: 1000,
                category: "men",
                stock: 20,
                discount: 0,
                image_url: "/images/fresh.jpg",
                rating: 0,
                reviews_count: 0,
              })
            }
          >
            <Plus size={17} />
            {t("Add fragrance", "إضافة عطر")}
          </button>
          <div className="admin-table">
            <table>
              <thead>
                <tr>
                  <th>{t("Fragrance", "العطر")}</th>
                  <th>EGP</th>
                  <th>{t("Stock", "المخزون")}</th>
                  <th>{t("Actions", "إجراءات")}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {t(p.name_en, p.name_ar)}
                      <small>{p.brand}</small>
                    </td>
                    <td>{p.price}</td>
                    <td>{p.stock}</td>
                    <td>
                      <button onClick={() => setEdit(p)}>
                        {t("Edit", "تعديل")}
                      </button>
                      <button
                        className="danger"
                        onClick={async () => {
                          if (
                            !confirm(
                              t("Delete this fragrance?", "حذف هذا العطر؟"),
                            )
                          )
                            return;
                          const { error } = await supabase!
                            .from("products")
                            .delete()
                            .eq("id", p.id);
                          if (error) notify(error.message);
                          else
                            setProducts((ps) =>
                              ps.filter((x) => x.id !== p.id),
                            );
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "orders" && (
        <div>
          {!orders.length && <p>{t("No orders yet.", "لا توجد طلبات بعد.")}</p>}
          {orders.map((o) => (
            <div className="order-card" key={o.id}>
              <div className="summary-row">
                <b>
                  #{o.id.slice(0, 8)} · {money(o.total)} EGP
                </b>
                <span>
                  {o.payment_method} / {o.payment_status}
                </span>
              </div>
              <p>
                {o.name} · {o.phone} · {o.address} · {o.governorate}
              </p>
              {o.payment_method === "cod" &&
                o.order_status === "delivered" &&
                o.payment_status !== "paid" && (
                  <button
                    className="btn glass"
                    onClick={async () => {
                      if (
                        !confirm(
                          t(
                            `Confirm receipt of ${money(o.total)} EGP?`,
                            `تأكيد استلام ${money(o.total)} جنيه؟`,
                          ),
                        )
                      )
                        return;
                      const { data, error } = await supabase!.rpc(
                        "collect_cod_payment",
                        { p_order: o.id },
                      );
                      if (error) notify(error.message);
                      else {
                        setOrders((rows) =>
                          rows.map((row) =>
                            row.id === o.id
                              ? {
                                  ...row,
                                  payment_status: "paid",
                                  payment_collected_at:
                                    data.payment_collected_at,
                                }
                              : row,
                          ),
                        );
                        notify(
                          t("Cash receipt recorded.", "تم تسجيل تحصيل المبلغ."),
                        );
                      }
                    }}
                  >
                    {t("Record cash received", "تسجيل تحصيل المبلغ")}
                  </button>
                )}
              <select
                value={o.order_status}
                onChange={async (e) => {
                  const status = e.target.value;
                  const { error } = await supabase!
                    .from("orders")
                    .update({ order_status: status })
                    .eq("id", o.id);
                  if (error) notify(error.message);
                  else
                    setOrders((os) =>
                      os.map((x) =>
                        x.id === o.id ? { ...x, order_status: status } : x,
                      ),
                    );
                }}
              >
                {[
                  ["preparing", "Preparing", "قيد التجهيز"],
                  ["shipped", "Shipped", "تم الشحن"],
                  ["delivered", "Delivered", "تم التوصيل"],
                ].map(([id, en, ar]) => (
                  <option value={id} key={id}>
                    {t(en, ar)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
      {tab === "coupons" && (
        <>
          <form
            className="coupon-admin"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const { data, error } = await supabase!
                .from("coupons")
                .insert({
                  code: String(f.get("code")).toUpperCase(),
                  discount_percent: Number(f.get("percent")),
                  max_uses: Number(f.get("max")),
                  expires_at: new Date(String(f.get("expires"))).toISOString(),
                })
                .select()
                .single();
              if (error) notify(error.message);
              else {
                setCoupons((c) => [...c, data]);
                notify(t("Coupon created.", "تم إنشاء القسيمة."));
              }
            }}
          >
            <Field label={t("Code", "الرمز")} name="code" required />
            <Field
              label={t("Discount %", "نسبة الخصم")}
              name="percent"
              type="number"
              min="1"
              max="100"
              required
            />
            <Field
              label={t("Max uses", "أقصى استخدام")}
              name="max"
              type="number"
              min="1"
              defaultValue="100"
              required
            />
            <Field
              label={t("Expires", "تاريخ الانتهاء")}
              name="expires"
              type="date"
              required
            />
            <button className="btn gold">
              {t("Create coupon", "إنشاء قسيمة")}
            </button>
          </form>
          {coupons.map((c) => (
            <div className="order-card summary-row" key={c.id}>
              <b>
                {c.code} — {c.discount_percent}%
              </b>
              <span>
                {c.used_count}/{c.max_uses}
              </span>
              <button
                className="btn glass"
                onClick={async () => {
                  const { error } = await supabase!
                    .from("coupons")
                    .update({ active: !c.active })
                    .eq("id", c.id);
                  if (error) notify(error.message);
                  else
                    setCoupons((cs) =>
                      cs.map((x) =>
                        x.id === c.id ? { ...x, active: !c.active } : x,
                      ),
                    );
                }}
              >
                {t(
                  c.active ? "Deactivate" : "Activate",
                  c.active ? "تعطيل" : "تفعيل",
                )}
              </button>
            </div>
          ))}
        </>
      )}
      {tab === "reports" && <SalesReports orders={orders} />}
      {edit && (
        <div className="modal-layer">
          <form
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Edit fragrance", "تعديل العطر")}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const { sales, ...payload } = edit;
              const existing = products.some((p) => p.id === edit.id);
              const query = existing
                ? supabase!.from("products").update(payload).eq("id", edit.id!)
                : supabase!.from("products").insert(payload);
              const { data, error } = await query.select().single();
              setBusy(false);
              if (error) notify(error.message);
              else {
                setProducts((ps) =>
                  existing
                    ? ps.map((p) => (p.id === edit.id ? data : p))
                    : [data, ...ps],
                );
                setEdit(null);
                notify(t("Product saved.", "تم حفظ المنتج."));
              }
            }}
          >
            <div className="drawer-head">
              <h2>{t("Edit fragrance", "تعديل العطر")}</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setEdit(null)}
                aria-label="Close"
              >
                <X />
              </button>
            </div>
            <div className="form-grid">
              {[
                ["name_en", "English name"],
                ["name_ar", "الاسم بالعربية"],
                ["brand", "Brand / العلامة"],
                ["size", "Size / الحجم"],
                ["price", "Price / السعر"],
                ["stock", "Stock / المخزون"],
                ["discount", "Discount % / الخصم"],
              ].map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  required
                  type={
                    ["price", "stock", "discount"].includes(key)
                      ? "number"
                      : "text"
                  }
                  min="0"
                  max={key === "discount" ? 100 : undefined}
                  value={String(edit[key as keyof Product] ?? "")}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      [key]: ["price", "stock", "discount"].includes(key)
                        ? +e.target.value
                        : e.target.value,
                    })
                  }
                />
              ))}
              <label>
                {t("Category", "الفئة")}
                <select
                  value={edit.category}
                  onChange={(e) =>
                    setEdit({ ...edit, category: e.target.value as Category })
                  }
                >
                  {categories.map((c) => (
                    <option value={c.slug} key={c.slug}>
                      {t(c.en, c.ar)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Field
              label={t("Image URL", "رابط الصورة")}
              type="text"
              value={edit.image_url || ""}
              onChange={(e) => setEdit({ ...edit, image_url: e.target.value })}
            />
            <label className="upload-label">
              <Upload size={18} />
              {t(
                "Upload JPG / WebP · max 2 MB",
                "رفع JPG / WebP · حد أقصى ٢ ميجابايت",
              )}
              <input
                type="file"
                accept="image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (
                    file.size > 2 * 1024 * 1024 ||
                    !["image/jpeg", "image/webp"].includes(file.type)
                  ) {
                    notify(
                      t(
                        "Only JPG/WebP images under 2 MB.",
                        "صور JPG/WebP أصغر من ٢ ميجابايت فقط.",
                      ),
                    );
                    return;
                  }
                  const id = edit.id || crypto.randomUUID();
                  const path = `products/${id}/${Date.now()}.${file.type === "image/webp" ? "webp" : "jpg"}`;
                  const { error } = await supabase!.storage
                    .from("product-images")
                    .upload(path, file);
                  if (error) notify(error.message);
                  else
                    setEdit({
                      ...edit,
                      ...(!edit.id ? { id } : {}),
                      image_url: supabase!.storage
                        .from("product-images")
                        .getPublicUrl(path).data.publicUrl,
                    });
                }}
              />
            </label>
            <button className="btn gold full" disabled={busy}>
              {busy ? "…" : t("Save fragrance", "حفظ العطر")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function SalesReports({ orders }: { orders: any[] }) {
  const { t, products } = useShop();
  const [period, setPeriod] = useState("daily");
  const paid = orders.filter((o) => o.payment_status === "paid");
  const revenue = paid.reduce((n, o) => n + o.total, 0);
  const buckets = Array.from(
    { length: period === "daily" ? 14 : 12 },
    (_, i) => {
      const date = new Date();
      if (period === "daily") date.setDate(date.getDate() - 13 + i);
      else date.setMonth(date.getMonth() - 11 + i, 1);
      const key = date.toISOString().slice(0, period === "daily" ? 10 : 7);
      return {
        label:
          period === "daily"
            ? String(date.getDate())
            : date.toLocaleString("en", { month: "short" }),
        date: key,
        value: paid
          .filter((o) =>
            (o.payment_collected_at || o.created_at).startsWith(key),
          )
          .reduce((n, o) => n + o.total, 0),
      };
    },
  );
  const max = Math.max(1, ...buckets.map((b) => b.value));
  return (
    <>
      <div className="report-cards">
        {[
          [t("Paid revenue", "الإيرادات المدفوعة"), `${money(revenue)} EGP`],
          [t("Orders", "الطلبات"), orders.length],
          [t("Products", "المنتجات"), products.length],
        ].map(([label, val]) => (
          <div key={label}>
            <BarChart3 size={22} />
            <small>{label}</small>
            <strong>{val}</strong>
          </div>
        ))}
      </div>
      <div className="report-chart">
        <div className="report-heading">
          <h3>{t("Revenue over time", "الإيرادات عبر الزمن")}</h3>
          <select
            aria-label={t("Report period", "فترة التقرير")}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="daily">
              {t("Daily · last 14 days", "يومي · آخر ١٤ يوماً")}
            </option>
            <option value="monthly">
              {t("Monthly · last 12 months", "شهري · آخر ١٢ شهراً")}
            </option>
          </select>
        </div>
        <div className="bars">
          {buckets.map((b) => (
            <div key={b.date} title={`${b.date}: ${b.value} EGP`}>
              <span
                style={{ height: `${Math.max(2, (b.value / max) * 200)}px` }}
              />
              <small>{b.label}</small>
            </div>
          ))}
        </div>
        <p>
          {t(
            "Paid transactions only. Hover a bar for details.",
            "المعاملات المدفوعة فقط. مرّر على العمود للتفاصيل.",
          )}
        </p>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
