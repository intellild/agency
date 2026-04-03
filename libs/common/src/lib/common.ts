import type {
  ListSessionsRequest,
  ListSessionsResponse,
} from '@agentclientprotocol/sdk';

export enum MessageTypes {
  GetHostList = 'list-hosts',
  HostList = 'HostList',
  GetSessionList = 'get-session-list',
  SessionList = 'session-list',
}

export interface GetHostListMessage {
  type: MessageTypes.GetHostList;
}

export interface HostListMessage {
  type: MessageTypes.HostList;
  hosts: string[];
}

export interface GetSessionListMessage extends ListSessionsRequest {
  type: MessageTypes.GetSessionList;
}

export interface SessionListMessage extends ListSessionsResponse {
  type: MessageTypes.SessionList;
}

export type Message = GetHostListMessage | HostListMessage;
