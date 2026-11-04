export type RegionType = 'Bắc' | 'Trung' | 'Nam' | 'Bac' | 'TayNguyen';

export type LocationCategory = 'History' | 'Geography' | 'Food' | 'Festival' | 'Landmark';

export type SeasonType = 'Spring' | 'Summer' | 'Autumn' | 'Winter' | 'AllYear';

export type HeatmapMetric = 'tourist_density' | 'gdp' | 'population';

export interface LocationItem {
  location_id: number;
  province_id: number;
  name: string;
  category: LocationCategory;
  season: SeasonType;
  description: string;
  article?: string;
  lat: number;
  lng: number;
  address: string;
  image_url: string;
  rating_star: number;
  review_count: number;
  tourism_type?: 'attraction' | 'restaurant';
  price_range?: string;
  highlight_tag?: string;
}

export interface SpecialtyItem {
  specialty_id?: number;
  province_id: number;
  name: string;
  season_months: string; // e.g. "Quanh năm", "Tháng 5 - Tháng 8"
  description: string;
  image_url?: string;
}

export interface FestivalItem {
  festival_id?: number;
  province_id: number;
  name: string;
  month_held: string; // e.g. "Tháng Giêng âm lịch", "Tháng 4 - Tháng 6"
  description: string;
}

export interface Province {
  province_id: number;
  name: string;
  previous_names?: string[];
  slug?: string;
  region: RegionType;
  gdp: number; // Tỷ VNĐ (2023)
  population: number; // Người (2023)
  tourist_density: number; // Triệu lượt hoặc chỉ số 0-100
  tourists_million?: number; // Số triệu lượt khách (2023)
  lat: number;
  lng: number;
  map_x?: number;
  map_y?: number;
  description: string;
  history_brief: string;
  geography_brief: string;
  cover_image: string;
  avg_rating: number;
  review_count: number;
  specialty_dish: string;
  top_festival: string;
  top_landmark: string;
  specialties?: SpecialtyItem[];
  festivals?: FestivalItem[];
}

export interface TravelNotebookEntry {
  notebook_id: number;
  user_id: number;
  location_id?: number;
  province_id?: number;
  item_name: string;
  province_name: string;
  category?: LocationCategory;
  status: 'Visited' | 'Wishlist';
  rating?: number;
  notes?: string;
  created_at: string;
}

export interface SavedItinerary {
  id: string;
  title: string;
  provinces: string[];
  duration: string;
  preferences: string[];
  created_at: string;
  days: {
    day: number;
    title: string;
    activities: {
      time: string;
      title: string;
      type: 'landmark' | 'food' | 'rest' | 'transport';
      description: string;
      location_name: string;
    }[];
  }[];
}

export interface Review {
  review_id: number;
  user_id: number;
  username: string;
  user_avatar?: string;
  location_id: number;
  location_name: string;
  province_name: string;
  rating_star: number;
  content: string;
  image_url?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}

export interface Badge {
  badge_id: number;
  name: string;
  description: string;
  required_points: number;
  icon: string;
  category: string;
  unlocked?: boolean;
}

export interface User {
  auth_id?: string;
  user_id: number;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  total_points: number;
  avatar: string;
  title: string;
  visited_provinces: number[];
  wishlist_locations: number[];
  visited_locations: number[];
}

export interface LeaderboardUser {
  rank: number;
  username: string;
  avatar: string;
  total_points: number;
  badge_count: number;
  visited_count: number;
  title: string;
}
