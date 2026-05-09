export const AGENCY_ACP_PROTOCOL = '/agency/acp/1.0.0';

export interface AgencyHostStatus {
  protocol: typeof AGENCY_ACP_PROTOCOL;
  initialized: boolean;
  sessionId?: string;
  message?: string;
}
