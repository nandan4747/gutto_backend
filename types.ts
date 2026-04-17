export interface IIncomingMessage {
  receiverId: string;
  text: string;
  from: string;
  isGroup: false;
  type: string;
  url: string;
}

export interface IOutgoingMessage {
  text: string;
  from: string;
  timestamp: number;
}
