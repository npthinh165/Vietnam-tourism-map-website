import {
  Province,
  LocationItem,
  TravelNotebookEntry,
  SavedItinerary,
  Review,
  Badge,
  User,
  LeaderboardUser,
  HeatmapMetric,
} from "../types";
import {
  PROVINCES_DATA,
  SAMPLE_LOCATIONS,
  INITIAL_BADGES,
  INITIAL_REVIEWS,
} from "../data/provincesData";
import { buildCompleteProvincesData, LOCATION_SEED } from "../data/seedData63";
import { centroid } from "@turf/centroid";
import { authService } from "./authService";

export function getPolygonCentroid(geometry: any): [number, number] {
  try {
    if (!geometry) return [16.0544, 108.2022];
    const center = centroid({ type: "Feature", geometry, properties: {} });
    return [center.geometry.coordinates[1], center.geometry.coordinates[0]]; // [lat, lng]
  } catch {
    return [16.0544, 108.2022];
  }
}

export async function fetchVietnamGeoJSON(): Promise<any> {
  // Thử tải từ API /api/provinces hoặc static file /data/vietnam-provinces.geojson
  const sources = [
    "/data/vietnam-provinces.geojson",
    "/api/provinces",
    "./data/vietnam-provinces.geojson",
  ];

  let lastError = null;
  for (const src of sources) {
    try {
      const res = await fetch(src);
      if (res.ok) {
        const data = await res.json();
        if (
          data &&
          data.type === "FeatureCollection" &&
          Array.isArray(data.features)
        ) {
          return data;
        }
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw (
    lastError ||
    new Error("Không thể tải tệp GeoJSON ranh giới tỉnh thành Việt Nam")
  );
}

const STORAGE_KEYS = {
  PROVINCES: "vntravel_provinces_v1",
  LOCATIONS: "vntravel_locations_v1",
  NOTEBOOK: "vntravel_notebook_v1",
  ITINERARIES: "vntravel_itineraries_v1",
  REVIEWS: "vntravel_reviews_v1",
  BADGES: "vntravel_badges_v1",
  USER: "vntravel_current_user_v1",
};

// Haversine distance formula in kilometers
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Heatmap Color scale mapped strictly to user's specification:
// Thấp nhất: #E6F5F3
// Thấp: #A8DCD5
// Trung bình: #5CC0B4
// Cao: #1F9E91
// Cao nhất: #0B5F57
export function getHeatmapColor(
  value: number,
  min: number,
  max: number,
): { color: string; label: string; textColor: string } {
  if (max === min)
    return { color: "#5CC0B4", label: "Trung bình", textColor: "#1F2D3D" };
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));

  if (ratio <= 0.2) {
    return { color: "#E6F5F3", label: "Thấp nhất", textColor: "#1F2D3D" };
  } else if (ratio <= 0.4) {
    return { color: "#A8DCD5", label: "Thấp", textColor: "#1F2D3D" };
  } else if (ratio <= 0.6) {
    return { color: "#5CC0B4", label: "Trung bình", textColor: "#1F2D3D" };
  } else if (ratio <= 0.8) {
    return { color: "#1F9E91", label: "Cao", textColor: "#FFFFFF" };
  } else {
    return { color: "#0B5F57", label: "Cao nhất", textColor: "#FFFFFF" };
  }
}

class ApiService {
  private scopedKey(key: string): string {
    if (
      [
        STORAGE_KEYS.USER,
        STORAGE_KEYS.NOTEBOOK,
        STORAGE_KEYS.ITINERARIES,
      ].includes(key)
    ) {
      return key + ":" + (authService.getUser()?.id ?? "guest");
    }
    return key;
  }
  private requireUser(): User {
    const user = this.getCurrentUser();
    if (user.role === "guest")
      throw new Error("Vui lòng đăng nhập để lưu hành trình.");
    return user;
  }
  private getStorage<T>(key: string, defaultVal: T): T {
    try {
      const item = localStorage.getItem(this.scopedKey(key));
      return item ? JSON.parse(item) : defaultVal;
    } catch {
      return defaultVal;
    }
  }

  private setStorage<T>(key: string, data: T): void {
    try {
      localStorage.setItem(this.scopedKey(key), JSON.stringify(data));
    } catch (e) {
      throw new Error(
        "Không thể lưu dữ liệu trên trình duyệt. Hãy kiểm tra dung lượng và quyền lưu trữ.",
      );
    }
  }

  // Identity is verified by the auth service; browser data never grants roles.
  getCurrentUser(): User {
    const identity = authService.getUser();
    const guest: User = {
      user_id: 0,
      username: "Khách",
      email: "",
      role: "guest",
      total_points: 0,
      avatar: "",
      title: "",
      visited_provinces: [],
      wishlist_locations: [],
      visited_locations: [],
    };
    if (!identity) return guest;
    const stored = this.getStorage<User>(STORAGE_KEYS.USER, guest);
    const metadata = identity.user_metadata || {};
    const numericId = Array.from(identity.id).reduce(
      (hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
      0,
    );
    return {
      ...stored,
      user_id: numericId,
      auth_id: identity.id,
      role: "user",
      username:
        metadata.full_name ||
        metadata.name ||
        identity.email?.split("@")[0] ||
        "Du khách",
      email: identity.email || "",
      avatar: metadata.avatar_url || metadata.picture || "",
    };
  }

  updateCurrentUser(user: User): void {
    const identity = this.requireUser();
    if (user.auth_id !== identity.auth_id)
      throw new Error("Tài khoản đã thay đổi. Vui lòng thử lại.");
    this.setStorage(STORAGE_KEYS.USER, { ...user, role: "user" });
  }

  addPoints(points: number, reason: string): User {
    const user = this.getCurrentUser();
    user.total_points += points;
    if (user.total_points >= 500) user.title = "Bậc thầy Xuyên Việt";
    else if (user.total_points >= 300) user.title = "Lữ khách sành sỏi";
    else if (user.total_points >= 150) user.title = "Nhà thám hiểm";
    else user.title = "Phượt thủ tập sự";
    this.updateCurrentUser(user);
    return user;
  }

  // --- PROVINCES ---
  getProvinces(): Province[] {
    const list = this.getStorage<Province[]>(STORAGE_KEYS.PROVINCES, []);
    if (!list || list.length < 63) {
      const full63 = buildCompleteProvincesData();
      this.setStorage(STORAGE_KEYS.PROVINCES, full63);
      return full63;
    }
    return list;
  }

  getProvinceById(id: number): Province | undefined {
    return this.getProvinces().find((p) => p.province_id === id);
  }

  updateProvince(updated: Province): void {
    const list = this.getProvinces().map((p) =>
      p.province_id === updated.province_id ? updated : p,
    );
    this.setStorage(STORAGE_KEYS.PROVINCES, list);
  }

  addProvince(prov: Province): void {
    const list = this.getProvinces();
    list.push(prov);
    this.setStorage(STORAGE_KEYS.PROVINCES, list);
  }

  // --- LOCATIONS ---
  getLocations(
    provinceId?: number,
    category?: string,
    season?: string,
  ): LocationItem[] {
    let list = this.getStorage<LocationItem[]>(STORAGE_KEYS.LOCATIONS, []);
    if (!list || list.length < 50) {
      list = LOCATION_SEED;
      this.setStorage(STORAGE_KEYS.LOCATIONS, list);
    }
    if (provinceId) {
      list = list.filter((l) => l.province_id === provinceId);
    }
    if (category && category !== "All") {
      list = list.filter((l) => l.category === category);
    }
    if (season && season !== "AllYear") {
      list = list.filter((l) => l.season === season || l.season === "AllYear");
    }
    return list;
  }

  getLocationById(id: number): LocationItem | undefined {
    return this.getLocations().find((l) => l.location_id === id);
  }

  addLocation(loc: LocationItem): void {
    const list = this.getLocations();
    list.push(loc);
    this.setStorage(STORAGE_KEYS.LOCATIONS, list);
  }

  // --- TRAVEL NOTEBOOK ---
  getNotebook(): TravelNotebookEntry[] {
    if (this.getCurrentUser().role === "guest") return [];
    return this.getStorage<TravelNotebookEntry[]>(STORAGE_KEYS.NOTEBOOK, []);
  }

  toggleNotebookLocation(
    location: LocationItem,
    status: "Visited" | "Wishlist",
  ): { added: boolean; pointsEarned: number } {
    const user = this.requireUser();
    const list = this.getNotebook();
    const existing = list.find(
      (entry) => entry.location_id === location.location_id,
    );
    const remaining = list.filter(
      (entry) => entry.location_id !== location.location_id,
    );
    const added = existing?.status !== status;
    if (added)
      remaining.unshift({
        notebook_id: existing?.notebook_id ?? Date.now(),
        user_id: user.user_id,
        location_id: location.location_id,
        province_id: location.province_id,
        item_name: location.name,
        province_name:
          this.getProvinceById(location.province_id)?.name || "Việt Nam",
        category: location.category,
        status,
        created_at: new Date().toISOString(),
      });
    user.visited_locations = remaining
      .filter((n) => n.status === "Visited" && n.location_id)
      .map((n) => n.location_id!);
    user.wishlist_locations = remaining
      .filter((n) => n.status === "Wishlist" && n.location_id)
      .map((n) => n.location_id!);
    if (
      added &&
      status === "Visited" &&
      !user.visited_provinces.includes(location.province_id)
    )
      user.visited_provinces.push(location.province_id);
    this.setStorage(STORAGE_KEYS.NOTEBOOK, remaining);
    this.updateCurrentUser(user);
    return { added, pointsEarned: 0 };
  }

  removeNotebookEntry(id: number): void {
    const user = this.requireUser();
    const remaining = this.getNotebook().filter(
      (entry) => entry.notebook_id !== id,
    );
    user.visited_locations = remaining
      .filter((n) => n.status === "Visited" && n.location_id)
      .map((n) => n.location_id!);
    user.wishlist_locations = remaining
      .filter((n) => n.status === "Wishlist" && n.location_id)
      .map((n) => n.location_id!);
    this.setStorage(STORAGE_KEYS.NOTEBOOK, remaining);
    this.updateCurrentUser(user);
  }

  markProvinceVisited(provinceId: number): void {
    const user = this.requireUser();
    user.visited_provinces = user.visited_provinces.includes(provinceId)
      ? user.visited_provinces.filter((id) => id !== provinceId)
      : [...user.visited_provinces, provinceId];
    this.updateCurrentUser(user);
  }

  // --- REVIEWS & UGC ---
  getReviews(status?: "Pending" | "Approved" | "Rejected"): Review[] {
    const list = this.getStorage<Review[]>(
      STORAGE_KEYS.REVIEWS,
      INITIAL_REVIEWS,
    );
    if (status) {
      return list.filter((r) => r.status === status);
    }
    return list;
  }

  submitReview(
    review: Omit<Review, "review_id" | "status" | "created_at">,
  ): Review {
    const currentUser = this.requireUser();
    const list = this.getReviews();
    const newReview: Review = {
      ...review,
      user_id: currentUser.user_id,
      username: currentUser.username,
      review_id: Date.now(),
      status: "Pending", // Pending admin approval as in system workflow
      created_at: new Date().toISOString().replace("T", " ").substring(0, 16),
    };
    list.unshift(newReview);
    this.setStorage(STORAGE_KEYS.REVIEWS, list);

    // Gamification: Give preliminary points for UGC participation
    this.addPoints(30, "Đăng tải đóng góp đánh giá UGC");
    return newReview;
  }

  moderateReview(reviewId: number, newStatus: "Approved" | "Rejected"): void {
    const list = this.getReviews().map((r) => {
      if (r.review_id === reviewId) {
        return { ...r, status: newStatus };
      }
      return r;
    });
    this.setStorage(STORAGE_KEYS.REVIEWS, list);
  }

  // --- GAMIFICATION & BADGES ---
  getBadges(): Badge[] {
    const user = this.getCurrentUser();
    const list = this.getStorage<Badge[]>(STORAGE_KEYS.BADGES, INITIAL_BADGES);
    // Dynamically evaluate lock/unlock
    return list.map((b) => {
      const isUnlocked = user.total_points >= b.required_points;
      return { ...b, unlocked: isUnlocked };
    });
  }

  getLeaderboard(): LeaderboardUser[] {
    const user = this.getCurrentUser();
    const staticTop: LeaderboardUser[] = [
      {
        rank: 1,
        username: "Đặng Tuấn Anh (Xuyên Việt Master)",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
        total_points: 920,
        badge_count: 5,
        visited_count: 42,
        title: "Bậc thầy Xuyên Việt",
      },
      {
        rank: 2,
        username: "Lê Hoàng Yến (Foodie Sài Gòn)",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        total_points: 680,
        badge_count: 4,
        visited_count: 28,
        title: "Bậc thầy Ẩm thực",
      },
      {
        rank: 3,
        username: user.username,
        avatar: user.avatar,
        total_points: user.total_points,
        badge_count: 2,
        visited_count: user.visited_provinces.length,
        title: user.title,
      },
      {
        rank: 4,
        username: "Phạm Minh Quân",
        avatar:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
        total_points: 240,
        badge_count: 2,
        visited_count: 12,
        title: "Nhà thám hiểm",
      },
      {
        rank: 5,
        username: "Vũ Bích Phương",
        avatar:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
        total_points: 190,
        badge_count: 1,
        visited_count: 8,
        title: "Phượt thủ tập sự",
      },
    ];

    // Sort by points descending
    return staticTop
      .sort((a, b) => b.total_points - a.total_points)
      .map((u, i) => ({ ...u, rank: i + 1 }));
  }

  // --- TRAVEL PLANNER CORE ALGORITHM ---
  generateOptimalItinerary(
    selectedProvinceNames: string[],
    durationStr: string,
    preferences: string[],
  ): SavedItinerary {
    const allProvinces = this.getProvinces();
    const chosenProvinces = allProvinces.filter((p) =>
      selectedProvinceNames.includes(p.name),
    );

    // Sort provinces by geographic chain (North -> South or South -> North nearest neighbor)
    const sortedProvinces = [...chosenProvinces].sort((a, b) => b.lat - a.lat);

    const numDays = Number.parseInt(durationStr, 10);
    if (!Number.isInteger(numDays) || numDays < 1 || numDays > 7)
      throw new Error("Chọn từ 1 đến 7 ngày.");
    if (!chosenProvinces.length || chosenProvinces.length > numDays)
      throw new Error("Số ngày cần bằng hoặc nhiều hơn số điểm đến.");

    const allLocations = this.getLocations();

    const days = [];

    for (let dayIndex = 0; dayIndex < numDays; dayIndex++) {
      const activeProvince =
        sortedProvinces[
          Math.min(
            sortedProvinces.length - 1,
            Math.floor((dayIndex * sortedProvinces.length) / numDays),
          )
        ] || allProvinces[0];
      const provLocations = allLocations.filter(
        (l) => l.province_id === activeProvince.province_id,
      );

      const foodItems = provLocations.filter((l) => l.category === "Food");
      const landmarkItems = provLocations.filter(
        (l) => l.category === "Landmark" || l.category === "Geography",
      );
      const historyItems = provLocations.filter(
        (l) => l.category === "History",
      );

      const preferredItems = preferences.includes("Văn hóa")
        ? [...historyItems, ...landmarkItems]
        : landmarkItems;
      const morningSpot =
        preferredItems[dayIndex % (preferredItems.length || 1)]?.name ||
        `${activeProvince.top_landmark.split(",")[0] || "Khu trung tâm danh lam"}`;
      const lunchSpot =
        foodItems[0]?.name ||
        `Đặc sản trưa: ${activeProvince.specialty_dish.split(",")[0] || "Món ngon địa phương"}`;
      const afternoonSpot =
        historyItems[0]?.name ||
        landmarkItems[1]?.name ||
        `${activeProvince.name} - Di tích thắng cảnh`;
      const dinnerSpot =
        foodItems[1]?.name ||
        `Thưởng thức ẩm thực: ${activeProvince.specialty_dish.split(",")[1] || activeProvince.specialty_dish}`;
      const eveningSpot = `Dạo phố ${activeProvince.name}`;

      days.push({
        day: dayIndex + 1,
        title: activeProvince.name,
        activities: [
          {
            time: "08:00",
            title: `Tham quan ${morningSpot}`,
            type: "landmark" as const,
            description: `Khởi đầu ngày mới với điểm tham quan biểu tượng của ${activeProvince.name}, hít thở không khí trong lành và chụp ảnh lưu niệm.`,
            location_name: morningSpot,
          },
          {
            time: "10:30",
            title: `Khám phá di sản ${activeProvince.name}`,
            type: "landmark" as const,
            description: `Tìm hiểu nét văn hóa địa phương độc đáo, chiêm ngưỡng kiến trúc đặc sắc gắn liền với vùng đất.`,
            location_name: activeProvince.name,
          },
          {
            time: "12:00",
            title: `Ăn trưa: ${lunchSpot}`,
            type: "food" as const,
            description: `Thưởng thức món đặc sản ${activeProvince.specialty_dish.split(",")[0] || "truyền thống"}, nạp đầy năng lượng cho hành trình.`,
            location_name: lunchSpot,
          },
          {
            time: "14:30",
            title: `Check-in ${afternoonSpot}`,
            type: "landmark" as const,
            description: `Trải nghiệm các hoạt động thú vị, ngắm cảnh thiên nhiên hoặc hòa mình vào không gian cổ kính.`,
            location_name: afternoonSpot,
          },
          {
            time: "18:30",
            title: `Ăn tối: ${dinnerSpot}`,
            type: "food" as const,
            description: `Bữa tối ấm cúng với những món ngon nức tiếng, không gian ẩm thực đậm đà phong vị bản xứ.`,
            location_name: dinnerSpot,
          },
          {
            time: "20:30",
            title: eveningSpot,
            type: "rest" as const,
            description: `Dạo mát ngắm phố lung linh ánh đèn, thưởng thức cà phê hoặc chè địa phương thư thái trước khi nghỉ ngơi.`,
            location_name: activeProvince.name,
          },
        ],
      });
    }

    const itinerary: SavedItinerary = {
      id: `itinerary_${crypto.randomUUID()}`,
      title: selectedProvinceNames.join(" → "),
      provinces: selectedProvinceNames,
      duration: durationStr,
      preferences: preferences,
      created_at: new Date().toISOString().split("T")[0],
      days: days,
    };

    return itinerary;
  }

  saveItineraryToNotebook(itinerary: SavedItinerary): void {
    this.requireUser();
    const list = this.getSavedItineraries().filter(
      (item) => item.id !== itinerary.id,
    );
    this.setStorage(STORAGE_KEYS.ITINERARIES, [itinerary, ...list]);
  }

  getSavedItineraries(): SavedItinerary[] {
    if (this.getCurrentUser().role === "guest") return [];
    return this.getStorage<SavedItinerary[]>(STORAGE_KEYS.ITINERARIES, []);
  }

  removeSavedItinerary(id: string): void {
    this.requireUser();
    this.setStorage(
      STORAGE_KEYS.ITINERARIES,
      this.getSavedItineraries().filter((item) => item.id !== id),
    );
  }

  // --- CMS STATS ---
  getCMSStats() {
    const provinces = this.getProvinces();
    const locations = this.getLocations();
    const reviews = this.getReviews();
    const pendingReviews = reviews.filter((r) => r.status === "Pending").length;
    const approvedReviews = reviews.filter(
      (r) => r.status === "Approved",
    ).length;

    return {
      totalUsers: 1024,
      totalProvinces: provinces.length,
      totalLocations: locations.length,
      pendingReviews: pendingReviews,
      approvedReviews: approvedReviews,
      totalReviews: reviews.length,
      approvalRate:
        reviews.length > 0
          ? Math.round((approvedReviews / reviews.length) * 100)
          : 100,
    };
  }
}

export const apiService = new ApiService();
