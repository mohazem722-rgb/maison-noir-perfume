import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { Product } from "./data";

const routes: Record<string, [string, string, string, string]> = {
  "/": [
    "The Art of Scent",
    "فن العطر",
    "Discover exceptional fragrances, precious oud and your next signature scent.",
    "اكتشف عطوراً استثنائية وعوداً فاخراً وبصمتك العطرية القادمة.",
  ],
  "/products": [
    "The Fragrance Collection",
    "مجموعة العطور",
    "Explore our fragrance collection by house, price, size and style.",
    "استكشف مجموعة العطور حسب العلامة والسعر والحجم والنوع.",
  ],
  "/offers": [
    "Fragrance Offers",
    "عروض العطور",
    "Discover our current fragrance offers and gift selections.",
    "اكتشف عروض العطور الحالية ومختارات الهدايا.",
  ],
  "/bestsellers": [
    "Bestselling Fragrances",
    "العطور الأكثر مبيعاً",
    "Explore the most-loved fragrances in our collection.",
    "استكشف العطور الأكثر مبيعاً في مجموعتنا.",
  ],
  "/wishlist": [
    "Saved Fragrances",
    "العطور المحفوظة",
    "Your saved fragrance discoveries.",
    "اكتشافاتك العطرية المحفوظة.",
  ],
  "/about": [
    "Our Story",
    "حكايتنا",
    "Discover the inspiration behind Maison Noir and our fragrance collection.",
    "تعرّف على الإلهام وراء ميزون نوار ومجموعتنا العطرية.",
  ],
  "/contact": [
    "Contact Maison Noir",
    "تواصل مع ميزون نوار",
    "Get in touch for help choosing your fragrance or with your order.",
    "تواصل معنا للمساعدة في اختيار عطرك أو بخصوص طلبك.",
  ],
  "/faq": [
    "Frequently Asked Questions",
    "الأسئلة الشائعة",
    "Answers about fragrances, delivery, payments and returns.",
    "إجابات عن العطور والتوصيل والدفع والاسترجاع.",
  ],
  "/returns": [
    "Shipping and Returns",
    "الشحن والاسترجاع",
    "Read our delivery, return and refund information before ordering.",
    "اطّلع على معلومات التوصيل والاسترجاع والمبالغ المستردة قبل الطلب.",
  ],
  "/account": [
    "Your Account",
    "حسابك",
    "Sign in to view and track your Maison Noir orders.",
    "سجّل الدخول لمتابعة طلباتك من ميزون نوار.",
  ],
  "/checkout": [
    "Checkout",
    "إتمام الطلب",
    "Review your selection and delivery details.",
    "راجع اختياراتك وتفاصيل التوصيل.",
  ],
  "/admin": [
    "Administration",
    "الإدارة",
    "Authorized administrator access.",
    "دخول المدير المخوّل.",
  ],
  "/reset-password": [
    "Reset Password",
    "استرجاع كلمة المرور",
    "Securely reset your account password.",
    "استرجع كلمة مرور حسابك بأمان.",
  ],
};
function meta(name: string, content: string, property = false) {
  const attribute = property ? "property" : "name";
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${name}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.append(element);
  }
  element.content = content;
}
export function Seo({ ar, products }: { ar: boolean; products: Product[] }) {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    const product = path.startsWith("/products/")
      ? products.find((p) => `/products/${p.id}` === path)
      : undefined;
    const entry = routes[path];
    const title = product
      ? ar
        ? product.name_ar
        : product.name_en
      : entry
        ? entry[ar ? 1 : 0]
        : ar
          ? "الصفحة غير موجودة"
          : "Page Not Found";
    const description = product
      ? `${ar ? product.name_ar : product.name_en} · ${product.brand} · ${product.size} — ${ar ? "اكتشف تفاصيل العطر وتوفره." : "Discover fragrance details and availability."}`
      : entry
        ? entry[ar ? 3 : 2]
        : ar
          ? "هذه الصفحة غير موجودة."
          : "This page does not exist.";
    document.title = `${title} | MAISON NOIR`;
    meta("description", description);
    let origin = window.location.origin;
    let configured = false;
    try {
      const site = new URL(import.meta.env.VITE_SITE_URL || "");
      if (
        site.protocol === "https:" &&
        !site.username &&
        !site.password &&
        site.pathname === "/" &&
        !site.search &&
        !site.hash
      ) {
        origin = site.origin;
        configured = true;
      }
    } catch {
      /* Do not invent a production domain. */
    }
    const canonicalURL = `${origin}${path}`;
    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = canonicalURL;
    const privatePage =
      [
        "/admin",
        "/account",
        "/checkout",
        "/wishlist",
        "/reset-password",
      ].includes(path) ||
      (!entry && !product);
    meta(
      "robots",
      configured && origin === window.location.origin && !privatePage
        ? "index,follow"
        : "noindex,follow",
    );
    meta("og:title", document.title, true);
    meta("og:description", description, true);
    meta("og:url", canonicalURL, true);
    meta("og:type", product ? "product" : "website", true);
    meta("og:locale", ar ? "ar_EG" : "en_US", true);
  }, [location.pathname, ar, products]);
  return null;
}
