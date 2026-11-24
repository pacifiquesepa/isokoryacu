export const merchantShopDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type MerchantShopDay = (typeof merchantShopDays)[number];

export type MerchantBusinessHour = {
  day: MerchantShopDay;
  open: string;
  close: string;
  closed: boolean;
};

export const defaultMerchantBusinessHours: MerchantBusinessHour[] =
  merchantShopDays.map((day) => ({
    day,
    open: "09:00",
    close: "18:00",
    closed: day === "Sunday",
  }));

export const merchantShopCategories = [
  "Agriculture",
  "Beauty & personal care",
  "Electronics",
  "Fashion",
  "Food & groceries",
  "Health",
  "Home & living",
  "Services",
  "Other",
] as const;
