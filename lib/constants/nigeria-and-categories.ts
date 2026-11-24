export interface NigerianStateSeed {
  code: string;
  name: string;
  geoZone: string;
}

export interface ListingCategorySeed {
  name: string;
  slug: string;
  sortOrder: number;
  description?: string | null;
  isActive?: boolean;
}

export const NIGERIAN_STATES_SEED: NigerianStateSeed[] = [
  { code: 'AB', name: 'Abia', geoZone: 'South East' },
  { code: 'AD', name: 'Adamawa', geoZone: 'North East' },
  { code: 'AK', name: 'Akwa Ibom', geoZone: 'South South' },
  { code: 'AN', name: 'Anambra', geoZone: 'South East' },
  { code: 'BA', name: 'Bauchi', geoZone: 'North East' },
  { code: 'BY', name: 'Bayelsa', geoZone: 'South South' },
  { code: 'BE', name: 'Benue', geoZone: 'North Central' },
  { code: 'BO', name: 'Borno', geoZone: 'North East' },
  { code: 'CR', name: 'Cross River', geoZone: 'South South' },
  { code: 'DE', name: 'Delta', geoZone: 'South South' },
  { code: 'EB', name: 'Ebonyi', geoZone: 'South East' },
  { code: 'ED', name: 'Edo', geoZone: 'South South' },
  { code: 'EK', name: 'Ekiti', geoZone: 'South West' },
  { code: 'EN', name: 'Enugu', geoZone: 'South East' },
  { code: 'FC', name: 'FCT - Abuja', geoZone: 'North Central' },
  { code: 'GO', name: 'Gombe', geoZone: 'North East' },
  { code: 'IM', name: 'Imo', geoZone: 'South East' },
  { code: 'JI', name: 'Jigawa', geoZone: 'North West' },
  { code: 'KD', name: 'Kaduna', geoZone: 'North West' },
  { code: 'KN', name: 'Kano', geoZone: 'North West' },
  { code: 'KT', name: 'Katsina', geoZone: 'North West' },
  { code: 'KE', name: 'Kebbi', geoZone: 'North West' },
  { code: 'KO', name: 'Kogi', geoZone: 'North Central' },
  { code: 'KW', name: 'Kwara', geoZone: 'North Central' },
  { code: 'LA', name: 'Lagos', geoZone: 'South West' },
  { code: 'NA', name: 'Nasarawa', geoZone: 'North Central' },
  { code: 'NI', name: 'Niger', geoZone: 'North Central' },
  { code: 'OG', name: 'Ogun', geoZone: 'South West' },
  { code: 'ON', name: 'Ondo', geoZone: 'South West' },
  { code: 'OS', name: 'Osun', geoZone: 'South West' },
  { code: 'OY', name: 'Oyo', geoZone: 'South West' },
  { code: 'PL', name: 'Plateau', geoZone: 'North Central' },
  { code: 'RI', name: 'Rivers', geoZone: 'South South' },
  { code: 'SO', name: 'Sokoto', geoZone: 'North West' },
  { code: 'TA', name: 'Taraba', geoZone: 'North East' },
  { code: 'YO', name: 'Yobe', geoZone: 'North East' },
  { code: 'ZA', name: 'Zamfara', geoZone: 'North West' },
];

export const DEFAULT_LISTING_CATEGORIES_SEED: ListingCategorySeed[] = [
  { name: 'Fashion & Apparel', slug: 'fashion-apparel', sortOrder: 1 },
  { name: 'Electronics & Gadgets', slug: 'electronics-gadgets', sortOrder: 2 },
  { name: 'Phones & Accessories', slug: 'phones-accessories', sortOrder: 3 },
  { name: 'Beauty & Personal Care', slug: 'beauty-personal-care', sortOrder: 4 },
  { name: 'Home & Living', slug: 'home-living', sortOrder: 5 },
  { name: 'Health & Wellness', slug: 'health-wellness', sortOrder: 6 },
  { name: 'Groceries & Provisions', slug: 'groceries-provisions', sortOrder: 7 },
  { name: 'Books & Education', slug: 'books-education', sortOrder: 8 },
];

export function slugifyCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
