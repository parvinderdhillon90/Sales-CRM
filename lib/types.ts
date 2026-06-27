export type Role = 'cmd' | 'director' | 'manager';
export type Zone = 'south_west' | 'north';
export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
export type DealTemperature = 'hot' | 'warm' | 'cold';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type ActivityType =
  | 'created'
  | 'call'
  | 'email'
  | 'meeting'
  | 'note'
  | 'stage_change'
  | 'temperature_change'
  | 'close_date_change'
  | 'assignment_change'
  | 'value_change';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  zone: Zone | null;
  created_at: string;
}

export interface Client {
  id: number;
  name: string;
  company: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  zone: Zone;
  assigned_to: number | null;
  assigned_user?: User;
  created_by: number;
  notes: string | null;
  deal_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: number;
  title: string;
  client_id: number;
  client?: Client;
  assigned_to: number;
  assigned_user?: User;
  created_by: number;
  value: number | null;
  stage: DealStage;
  temperature: DealTemperature;
  probability: number;
  expected_close_date: string | null;
  last_contact_date: string | null;
  last_contact_summary: string | null;
  close_date_change_count: number;
  notes: string | null;
  loss_reason: string | null;
  days_since_contact: number | null;
  is_stale: boolean;
  created_at: string;
  updated_at: string;
}

export interface DealActivity {
  id: number;
  deal_id: number;
  user_id: number;
  user?: User;
  activity_type: ActivityType;
  description: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  created_by: number;
  creator?: User;
  assigned_to: number;
  assigned_user?: User;
  deal_id: number | null;
  deal?: Pick<Deal, 'id' | 'title'>;
  client_id: number | null;
  client?: Pick<Client, 'id' | 'name' | 'company'>;
  due_date: string;
  priority: TaskPriority;
  status: TaskStatus;
  completion_note: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Message {
  id: number;
  sender_id: number;
  sender?: User;
  recipient_id: number;
  recipient?: User;
  subject: string | null;
  content: string;
  deal_id: number | null;
  deal?: Pick<Deal, 'id' | 'title'>;
  read_at: string | null;
  created_at: string;
}

export interface Target {
  id: number;
  user_id: number;
  user?: User;
  month: number;
  year: number;
  revenue_target: number | null;
  deal_count_target: number | null;
  pipeline_coverage_target: number | null;
  created_by: number;
  achieved_revenue?: number;
  achieved_deals?: number;
  created_at: string;
}

export interface Alert {
  id: number;
  rule_type: string;
  severity: AlertSeverity;
  message: string;
  deal_id: number | null;
  about_user_id: number | null;
  recipient_id: number;
  acknowledged_at: string | null;
  created_at: string;
}

export interface TeamMemberStat {
  user_id: number;
  name: string;
  zone: Zone | null;
  role: Role;
  revenue_target: number;
  achieved_revenue: number;
  weighted_pipeline: number;
  pipeline_coverage: number;
  total_deals: number;
  hot_deals: number;
  stale_deals: number;
  is_team_row?: boolean;
}

export interface DashboardStats {
  total_clients: number;
  total_deals: number;
  active_deals: number;
  hot_deals: number;
  stale_deals: number;
  overdue_tasks: number;
  pending_tasks: number;
  unread_messages: number;
  pipeline_value: number;
  weighted_pipeline: number;
  closed_won_this_month: number;
  closed_won_value_this_month: number;
  deals_closing_soon: number;
  zone_stats: ZoneStat[];
  stage_breakdown: Record<string, number>;
  team_members?: TeamMemberStat[];
  my_alerts?: Alert[];
}

export interface ZoneStat {
  zone: string;
  manager_name: string;
  total_deals: number;
  hot_deals: number;
  stale_deals: number;
  pipeline_value: number;
  closed_won_month: number;
  avg_days_since_contact: number;
  date_slips_total: number;
}
