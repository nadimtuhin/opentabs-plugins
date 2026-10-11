export type TriageAction = 'ACCEPT' | 'DELETE' | 'REVIEW';

export interface FriendRequestItem {
  id: string;
  name: string;
  profile_url: string;
  profile_picture_url?: string;
  mutual_friends: number;
  mutual_friends_text: string;
  request_time?: string;
}

export interface TriageSuggestion {
  user_id: string;
  name: string;
  profile_url: string;
  action: TriageAction;
  confidence: number; // 0.0 - 1.0
  reasons: string[];
  mutual_friends: number;
  request_time?: string;
}

export interface TriageSummary {
  total: number;
  accept_count: number;
  delete_count: number;
  review_count: number;
}
