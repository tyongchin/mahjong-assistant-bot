export type ChatType = "private" | "group" | "supergroup" | "channel";

export interface TgChat {
  id: number;
  type: ChatType;
  title?: string;
}

export interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TgMessage {
  chat: TgChat;
  from: TgUser;
  text?: string;
}

export interface TgUpdate {
  message?: TgMessage;
  edited_message?: TgMessage;
}
