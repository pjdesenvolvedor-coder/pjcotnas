// Represents a user profile, corresponding to a document in the /users collection.
export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  phoneNumber?: string;
  registrationDate: string;
  role: 'admin' | 'customer' | 'seller';
  sellerUsername?: string;
  lastSeen?: string;
  photoURL?: string;
  whatsappApiToken?: string;
};

// Represents a plan for a streaming service, corresponding to a document in the /subscriptions collection.
export type Plan = {
  id: string;
  name: string;
  price: number;
  features: string[];
  serviceId: string;
  sellerId: string;
  description: string;
  accountModel: 'Capturada' | 'Acesso Total';
  isBoosted?: boolean;
  // Denormalized from Service
  serviceName?: string;
  bannerUrl?: string;
  bannerHint?: string;
  // Denormalized from User
  sellerName?: string;
  sellerUsername?: string;
  sellerPhotoURL?: string;
};

// Represents a streaming service provider, corresponding to a document in the /services collection.
export type SubscriptionService = {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  logoUrl: string;
  imageHint: string;
  bannerUrl: string;
  bannerHint: string;
};

// Represents a user's purchase of a subscription plan, corresponding to a document in the /users/{userId}/userSubscriptions subcollection.
export type UserSubscription = {
  id: string;
  userId: string;
  subscriptionId: string;
  serviceId: string;
  planName: string;
  serviceName: string;
  price: number;
  startDate: string;
  endDate: string;
  paymentMethod: string;
  ticketId?: string;
  bannerUrl?: string;
};


// Represents an individual, sellable instance of a subscription account (e.g., login credentials).
export type Deliverable = {
  id: string;
  subscriptionId: string;
  sellerId: string;
  content: string;
  status: 'available' | 'sold';
  createdAt: string;
}

// Represents a support ticket and chat for a purchase.
export type Ticket = {
  id: string;
  userSubscriptionId: string;
  customerId: string;
  customerName: string;
  sellerId: string;
  sellerName: string;
  subscriptionId: string;
  serviceName: string;
  planName: string;
  status: 'open' | 'closed';
  createdAt: string;
  lastMessageAt: string;
  lastMessageText: string;
  unreadBySellerCount: number;
  unreadByCustomerCount: number;
  price: number;
};

// Represents a single message within a ticket.
export type ChatMessage = {
  id: string;
  ticketId: string;
  senderId: string;
  text: string;
  timestamp: string;
  senderName?: string;
};

// Represents the central WhatsApp configuration.
export type WhatsappConfig = {
  apiToken?: string;
  welcomeMessage?: string;
  saleNotificationMessage?: string;
  deliveryMessage?: string;
  ticketNotificationMessage?: string;
};

// Represents a pending message to be sent via WhatsApp.
export type PendingMessage = {
  id: string;
  type: 'welcome' | 'sale_notification' | 'delivery' | 'ticket_notification';
  recipientPhoneNumber: string;
  createdAt: string;
  data: {
    // General
    customerName?: string;
    customerEmail?: string;
    sellerName?: string;
    // For sales/delivery
    serviceName?: string;
    planName?: string;
    price?: number;
    deliverableContent?: string;
    // For ticket notifications
    ticketId?: string;
  };
};

// Represents a discount coupon.
export type Coupon = {
  id: string;
  name: string;
  discountPercentage: number;
  usageLimit?: number;
  usageCount?: number;
  subscriptionId?: string;
  subscriptionName?: string;
};

// Represents the central payment provider configuration.
export type PaymentProvider = 'axenpay' | 'pushinpay';

export type PaymentConfig = {
  activeProvider: PaymentProvider;
  axenpay?: {
    clientId: string;
    clientSecret: string;
  };
  pushinpay?: {
    apiKey: string;
  };
};

// Represents the configuration for special, automated coupons.
export type SpecialCouponsConfig = {
  abandonedCartCouponId?: string;
};
