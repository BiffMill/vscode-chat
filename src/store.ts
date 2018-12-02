import * as vscode from "vscode";
import { uuidv4 } from "./utils";

// Large discord communities can have lots of users/channels
// More than the quota of context.globalState
const VALUE_LENGTH_LIMIT = 100;

const stateKeys = {
  EXTENSION_VERSION: "extensionVersion",
  INSTALLATION_ID: "installationId",
  LAST_CHANNEL_ID: "lastChannelId",
  CHANNELS: "channels",
  USER_INFO: "userInfo",
  USERS: "users"
};

export class Store implements IStore {
  currentUserInfo: CurrentUser | undefined;
  channels: Channel[] = [];
  users: Users = {};
  lastChannelId: string | undefined;
  installationId: string | undefined;
  existingVersion: string | undefined;

  constructor(private context: vscode.ExtensionContext) {
    const { globalState } = context;
    this.installationId = globalState.get(stateKeys.INSTALLATION_ID);
    this.channels = globalState.get(stateKeys.CHANNELS) || [];
    this.currentUserInfo = globalState.get(stateKeys.USER_INFO);
    this.users = globalState.get(stateKeys.USERS) || {};
    this.lastChannelId = globalState.get(stateKeys.LAST_CHANNEL_ID);
    this.existingVersion = globalState.get(stateKeys.EXTENSION_VERSION);
  }

  generateInstallationId(): string {
    const uuidStr = uuidv4();
    const { globalState } = this.context;
    globalState.update(stateKeys.INSTALLATION_ID, uuidStr);
    this.installationId = uuidStr;
    return uuidStr;
  }

  updateExtensionVersion(version: string) {
    const { globalState } = this.context;
    globalState.update(stateKeys.EXTENSION_VERSION, version);
  }

  updateLastChannelId = (channelId: string | undefined): Thenable<void> => {
    this.lastChannelId = channelId;
    return this.context.globalState.update(
      stateKeys.LAST_CHANNEL_ID,
      this.lastChannelId
    );
  };

  updateUsers = (users: Users): Thenable<void> => {
    this.users = users;

    if (Object.keys(this.users).length <= VALUE_LENGTH_LIMIT) {
      return this.context.globalState.update(stateKeys.USERS, this.users);
    }

    return Promise.resolve();
  };

  updateChannels = (channels: Channel[]): Thenable<void> => {
    this.channels = channels;

    if (this.channels.length <= VALUE_LENGTH_LIMIT) {
      return this.context.globalState.update(stateKeys.CHANNELS, this.channels);
    }

    return Promise.resolve();
  };

  updateCurrentUser = (userInfo: CurrentUser | undefined): Thenable<void> => {
    this.currentUserInfo = userInfo;
    return this.context.globalState.update(
      stateKeys.USER_INFO,
      this.currentUserInfo
    );
  };
}
