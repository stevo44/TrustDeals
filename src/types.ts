export type UserRole = 'buyer' | 'seller' | 'rider' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  phoneNumber?: string;
  photoURL?: string;
  createdAt: string;
}

export type DealStatus = 'created' | 'funded' | 'transit' | 'delivered' | 'finalized' | 'dispute';

export interface Deal {
  id: string;
  title: string;
  description: string;
  price: number;
  buyerId: string;
  sellerId: string;
  riderId?: string;
  status: DealStatus;
  milestone: number;
  createdAt: string;
  updatedAt: string;
}

export type MessageType = 'text' | 'system' | 'image';

export interface Message {
  id: string;
  dealId: string;
  senderId: string;
  text: string;
  timestamp: string;
  type: MessageType;
  imageUrl?: string;
}
