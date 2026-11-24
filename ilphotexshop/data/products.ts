export type CategoryKey = string;

export type Product = {
  id: string;
  sku?: string | null;
  brand?: string | null;
  subcategory?: string | null;
  name: string;
  nameFr?: string | null;
  nameRw?: string | null;
  description?: string | null;
  warranty?: string | null;
  specifications?: { name: string; value: string }[] | null;
  returnPolicy?: string | null;
  category: CategoryKey;
  categoryLabel?: string;
  price: number;
  basePrice?: number;
  commissionAmount?: number;
  previousPrice?: number | null;
  rating: number;
  reviewCount: number;
  badge?: string | null;
  badgeFr?: string | null;
  badgeRw?: string | null;
  image: string;
  seller: string;
  location: string;
  stockQuantity?: number;
  isFeatured?: boolean;
  images?: { id: string; sortOrder: number }[];
};

export const products: Product[] = [
  {
    id: "wireless-headphones",
    name: "Wireless headphones",
    nameFr: "Casque sans fil",
    nameRw: "Headphones zitagira umugozi",
    category: "technology",
    price: 68500,
    previousPrice: 79000,
    rating: 4.8,
    reviewCount: 24,
    badge: "On sale",
    badgeFr: "En promotion",
    badgeRw: "Igiciro cyagabanutse",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85",
    seller: "Kigali Tech Store",
    location: "Kigali",
    stockQuantity: 18,
  },
  {
    id: "classic-watch",
    name: "Classic watch",
    nameFr: "Montre classique",
    nameRw: "Isaha ya Classic",
    category: "fashion",
    price: 42000,
    rating: 4.7,
    reviewCount: 18,
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85",
    seller: "Urban Style",
    location: "Kigali",
    stockQuantity: 12,
  },
  {
    id: "everyday-sneakers",
    name: "Everyday sneakers",
    nameFr: "Baskets du quotidien",
    nameRw: "Inkweto za buri munsi",
    category: "fashion",
    price: 55000,
    previousPrice: 65000,
    rating: 4.9,
    reviewCount: 31,
    badge: "Popular",
    badgeFr: "Populaire",
    badgeRw: "Bikunzwe",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85",
    seller: "Step Up Rwanda",
    location: "Gasabo",
    stockQuantity: 9,
  },
  {
    id: "skincare-set",
    name: "Skin care set",
    nameFr: "Coffret de soins",
    nameRw: "Ibikoresho by’ubwiza",
    category: "beauty",
    price: 28500,
    rating: 4.6,
    reviewCount: 12,
    image:
      "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=85",
    seller: "Glow & Go",
    location: "Kigali",
    stockQuantity: 22,
  },
  {
    id: "portable-speaker",
    name: "Portable speaker",
    nameFr: "Enceinte portable",
    nameRw: "Speaker igendanwa",
    category: "technology",
    price: 37000,
    rating: 4.8,
    reviewCount: 16,
    image:
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85",
    seller: "Kigali Tech Store",
    location: "Kigali",
    stockQuantity: 7,
  },
  {
    id: "leather-handbag",
    name: "Leather handbag",
    nameFr: "Sac à main en cuir",
    nameRw: "Isakoshi y’uruhu",
    category: "fashion",
    price: 48000,
    rating: 4.5,
    reviewCount: 9,
    image:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=85",
    seller: "Umurage Designs",
    location: "Huye",
    stockQuantity: 5,
  },
  {
    id: "coffee-set",
    name: "Coffee cup set",
    nameFr: "Service à café",
    nameRw: "Ibikoresho byo kunyweramo ikawa",
    category: "home",
    price: 32000,
    rating: 4.7,
    reviewCount: 14,
    image:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=85",
    seller: "Casa Rwanda",
    location: "Kigali",
    stockQuantity: 14,
  },
  {
    id: "smartphone",
    name: "Smartphone 128GB",
    nameFr: "Smartphone 128 Go",
    nameRw: "Smartphone 128GB",
    category: "technology",
    price: 295000,
    previousPrice: 320000,
    rating: 4.9,
    reviewCount: 27,
    badge: "On sale",
    badgeFr: "En promotion",
    badgeRw: "Igiciro cyagabanutse",
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=85",
    seller: "Kigali Tech Store",
    location: "Kigali",
    stockQuantity: 6,
  },
];
