export interface PlatformActor { id: string; name: string; role: 'user' | 'admin' }
export interface Profile { id: string; name: string; bio: string; avatar: string; points: number; level: string; badges: string[]; demo?: boolean }
export type ModerationStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export interface Activity { id: string; time: string; title: string; place: string; lat?: number; lng?: number; notes: string; transport: string; cost: number }
export interface ItineraryDay { day: number; title: string; activities: Activity[] }
export interface Itinerary { id: string; authorId: string; title: string; cover: string; description: string; origin: string; destination: string; province: string; region: 'Bắc' | 'Trung' | 'Nam'; days: ItineraryDay[]; budget: number; actualCost?: number; transport: string; tips: string; tags: string[]; visibility: 'public' | 'private'; status: ModerationStatus; createdAt: string; updatedAt: string; demo?: boolean; pinned?: boolean; verified?: boolean; verificationSource?: string; photos: string[] }
export interface CommunityPost { id: string; authorId: string; content: string; images: string[]; province: string; region: string; tags: string[]; itineraryId?: string; status: ModerationStatus; createdAt: string; updatedAt: string; demo?: boolean }
export interface Comment { id: string; authorId: string; targetType: 'post' | 'itinerary'; targetId: string; parentId?: string; content: string; createdAt: string }
export interface DestinationReview { id: string; authorId: string; placeId: string; placeName: string; rating: number; content: string; images: string[]; visitedAt?: string; status: ModerationStatus; createdAt: string; updatedAt: string; demo?: boolean }
export interface SavedItem { id: string; userId: string; targetType: 'place' | 'itinerary' | 'post'; targetId: string; title: string; collectionId?: string; notes: string; visited: boolean; budget: number; day?: number; createdAt: string }
export interface Collection { id: string; userId: string; name: string }
export interface PointTransaction { id: string; userId: string; amount: number; reason: string; source: string; createdAt: string }
export interface Notification { id: string; userId: string; message: string; read: boolean; createdAt: string; tab?: string; targetId?: string }
export interface Report { id: string; authorId: string; targetType: string; targetId: string; reason: string; status: 'open' | 'resolved'; createdAt: string }
export interface Reaction { id: string; userId: string; targetType: 'post' | 'review'; targetId: string }
export interface PlatformState { version: number; posts: CommunityPost[]; itineraries: Itinerary[]; reviews: DestinationReview[]; comments: Comment[]; profiles: Profile[]; saves: SavedItem[]; collections: Collection[]; points: PointTransaction[]; notifications: Notification[]; reports: Report[]; reactions: Reaction[]; follows: {userId:string;targetId:string}[]; settings: { points: { profile: number; review: number; post: number; itinerary: number; helpful: number }; requireModeration: boolean } }
export interface PlatformAction { type: string; payload: Record<string, unknown> }
export type PlatformMutate = (type: string, payload: Record<string, unknown>) => Promise<boolean>;
