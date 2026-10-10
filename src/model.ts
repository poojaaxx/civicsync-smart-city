export const departments = [
  "Water Department",
  "Electricity Department",
  "Roads & Highways",
  "Municipal Corporation",
] as const;
export const statuses = ["Planned", "Ongoing", "Delayed", "Completed"] as const;
export const types = [
  "Pipeline",
  "Underground cable",
  "Road resurfacing",
  "Drainage",
  "Street lighting",
  "Footpath",
] as const;
export const complaintStatuses = [
  "Submitted",
  "Under Review",
  "In Progress",
  "Resolved",
] as const;
export const categories = [
  "Pothole",
  "Road damage",
  "Unfinished construction",
  "Unsafe excavation",
  "Water leakage",
  "Construction debris",
  "Other",
] as const;
export type Role = "City Administrator" | "Department Officer" | "Citizen";
export interface ProjectUpdate {
  id: string;
  at: string;
  department: string;
  description: string;
}
export interface Department {
  id: string;
  name: string;
}
export interface RoadSegment {
  isIllustrative?: boolean;
  id: string;
  name: string;
  verified: boolean;
  coordinates: [number, number][];
}
export interface Project {
  isIllustrative?: boolean;
  id: string;
  name: string;
  department: string;
  contractor: string;
  authority: string;
  description: string;
  roadId: string;
  roadName: string;
  lat?: number;
  lng?: number;
  start: string;
  end: string;
  status: (typeof statuses)[number];
  type: (typeof types)[number];
  excavation: boolean;
  progress: number;
  delayReason: string;
  updates: ProjectUpdate[];
}
export interface Complaint {
  id: string;
  category: string;
  description: string;
  location: string;
  projectId: string;
  photo?: string;
  status: (typeof complaintStatuses)[number];
  createdAt: string;
  updates: { at: string; status: string }[];
}
export interface Conflict {
  id: string;
  projectIds: [string, string];
  type: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  explanation: string;
  recommendation: string;
  distance?: number;
  evidence: string;
}
export interface Coordination {
  id: string;
  conflict: Conflict;
  status: "Detected" | "Under review" | "Acknowledged";
  notes: { text: string; at: string; author: string }[];
}
export interface Database {
  departments: Department[];
  roads: RoadSegment[];
  version: 1;
  projects: Project[];
  complaints: Complaint[];
  coordination: Record<string, Coordination>;
  windowDays: number;
}
