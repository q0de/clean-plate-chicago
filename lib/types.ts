// Shared types for the application

export interface Restaurant {
  id: string;
  slug: string;
  dba_name: string;
  aka_name?: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  neighborhood?: string;
  cleanplate_score: number;
  latest_result: string;
  latest_inspection_date: string;
  facility_type?: string;
  risk_level?: number;
  violation_count?: number;
  latitude: number;
  longitude: number;
}

export interface MapRestaurant {
  id: string;
  slug: string;
  dba_name: string;
  address: string;
  cleanplate_score: number;
  latest_result: string;
  latitude: number;
  longitude: number;
}

export interface Neighborhood {
  id: string;
  name: string;
  slug: string;
  community_area_number?: number;
  pass_rate: number | null;
  avg_score: number | null;
  recent_failures: number;
  total_establishments: number;
}

export interface Inspection {
  id: string;
  establishment_id: string;
  inspection_id: string;
  inspection_date: string;
  inspection_type: string;
  results: string;
  raw_violations?: string;
  violation_count: number;
  critical_count: number;
  violations?: Violation[];
}

export interface Violation {
  id: string;
  inspection_id: string;
  violation_code: string;
  violation_description: string;
  violation_comment?: string;
  is_critical: boolean;
  plain_english?: string;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    limit?: number;
    offset?: number;
    has_more?: boolean;
  };
}






