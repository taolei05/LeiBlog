export const USER_ROLE = {
  Admin: "admin",
  User: "user",
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export type UserRecord = {
  id: string;
  role: UserRole;
  name: string | null;
  username: string;
  passwordHash: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  tags: string[];
  blogUrl: string | null;
  commentEmailNotifications: boolean;
  newPostEmailNotifications: boolean;
};

export type AdminProfile = {
  id: string;
  role: typeof USER_ROLE.Admin;
  username: string;
  email: string;
  tags: string[];
  commentEmailNotifications: boolean;
  newPostEmailNotifications: boolean;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  blogUrl?: string;
};

export type AdminSessionPayload = {
  userId: string;
  sessionId: string;
  username: string;
  role: typeof USER_ROLE.Admin;
};
