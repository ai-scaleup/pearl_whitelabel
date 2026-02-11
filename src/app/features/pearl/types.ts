// Mirror your page types (trimmed to what's used by apis)
export interface UserData {
  id: string
  email: string
  oauthId: string
  username: string
  authId: string | null
  token: string | null
  createdAt: string
  updatedAt: string
}

export interface CallData {
  id: string
  startTime: string
  conversationStatus: number
  status: number
  from: string
  to: string
  fromName?: string
  toName?: string
  fromEmail?: string
  toEmail?: string
  duration: number
  tags?: string[]
}

export interface CallsResponse {
  count?: number
  totalCount?: number
  results: CallData[]
}

export interface CallDetails {
  id: string
  relatedId: string | null
  startTime: string
  conversationStatus: number
  status: number
  from: string | null
  to: string | null
  name: string | null
  fromName?: string | null
  toName?: string | null
  fromEmail?: string | null
  toEmail?: string | null
  duration: number
  recording: string | null
  transcript: Array<{ role: number; content: string; startTime: number; endTime: number }> | null
  summary: string | null
  collectedInfo: Array<{ id: string; name: string; value: string | number | boolean | null }> | null
  tags: string[] | null
  isCallTransferred: boolean
  overallSentiment: number
}

export interface CallsFilters {
  skip: number
  limit: number
  sortProp: string
  isAscending: boolean
  fromDate: string
  toDate: string
  tags: string[]
  statuses: number[]
  conversationStatuses: number[]
}

export interface CampaignData {
  id: string
  campaignName: string
  outboundId: string
  bearerToken: string
  userId: string
  createdAt: string
  updatedAt: string
}

export interface PearlCampaignDetails {
  id: string
  name: string
  type: number
  status: number
  phoneNumber: string
  totalAgents: number
  created: string
  budgetConsumed: number
  totalTodayCalls: number
  totalOngoingCalls: number
  totalLeads: number
  totalLeadsCompleted: number
  totalLeadsSuccess: number
}
