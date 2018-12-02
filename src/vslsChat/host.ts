import * as vsls from "vsls/vscode";
import {
  VslsChatMessage,
  REQUEST_NAME,
  NOTIFICATION_NAME,
  toBaseUser,
  toBaseMessage
} from "./utils";
import { VslsBaseService } from "./base";
import { LIVE_SHARE_INFO_MESSAGES } from "../strings";

interface VslsMessages {
  [timestamp: string]: VslsChatMessage;
}

export class VslsHostService extends VslsBaseService {
  messages: VslsMessages = {};
  cachedPeers: vsls.Peer[] = [];

  constructor(
    private sharedService: vsls.SharedService,
    private peerNumber: number
  ) {
    super();
    sharedService.onRequest(REQUEST_NAME.message, payload => {
      if (!!payload) {
        const message = payload[0];
        const { userId, text } = message;
        return this.broadcastMessage(userId, text);
      }
    });

    sharedService.onRequest(REQUEST_NAME.fetchUsers, () => {
      return this.fetchUsers();
    });

    sharedService.onRequest(REQUEST_NAME.fetchUserInfo, payload => {
      if (!!payload) {
        const userId = payload[0];
        return this.fetchUserInfo(userId);
      }
    });

    sharedService.onRequest(REQUEST_NAME.fetchMessages, () => {
      return this.fetchMessagesHistory();
    });

    sharedService.onRequest(REQUEST_NAME.registerGuest, payload => {
      if (!!payload) {
        const { peer } = payload[0];
        return this.updateCachedPeers([peer], []);
      }
    });
  }

  isConnected() {
    return !!this.sharedService ? this.sharedService.isServiceAvailable : false;
  }

  sendStartedMessage() {
    return this.broadcastMessage(
      this.peerNumber.toString(),
      LIVE_SHARE_INFO_MESSAGES.started
    );
  }

  sendJoinedMessages(peers: vsls.Peer[]) {
    peers.forEach(({ peerNumber }) => {
      this.broadcastMessage(
        peerNumber.toString(),
        LIVE_SHARE_INFO_MESSAGES.joined
      );
    });
  }

  sendLeavingMessages(peers: vsls.Peer[]) {
    peers.forEach(({ peerNumber }) => {
      this.broadcastMessage(
        peerNumber.toString(),
        LIVE_SHARE_INFO_MESSAGES.left
      );
    });
  }

  async fetchUsers(): Promise<Users> {
    const users: Users = {};
    const liveshare = <vsls.LiveShare>await vsls.getApi();
    const { peerNumber: userId, user } = liveshare.session;

    if (!!user) {
      const currentUser = toBaseUser(userId, user);
      users[currentUser.id] = currentUser;
    }

    liveshare.peers.map(peer => {
      const { peerNumber: peerId, user: peerUser } = peer;

      if (!!peerUser) {
        const user: User = toBaseUser(peerId, peerUser);
        users[user.id] = user;
      }
    });

    return users;
  }

  async fetchUserInfo(userId: string): Promise<User | undefined> {
    // userId could be current user or one of the peers
    const liveshare = <vsls.LiveShare>await vsls.getApi();
    const { peerNumber, user } = liveshare.session;

    if (peerNumber.toString() === userId && !!user) {
      return Promise.resolve(toBaseUser(peerNumber, user));
    }

    const peer = liveshare.peers.find(
      peer => peer.peerNumber.toString() === userId
    );

    if (!!peer) {
      const { peerNumber: peerId, user: peerUser } = peer;

      if (!!peerUser) {
        return Promise.resolve(toBaseUser(peerId, peerUser));
      }
    }

    // Finally, let's check cached peers
    // In some cases, vsls seems to be returning stale data, and
    // so we cache whatever we know locally.
    const cachedPeer = this.cachedPeers.find(
      peer => peer.peerNumber.toString() === userId
    );

    if (!!cachedPeer) {
      const { peerNumber: peerId, user: peerUser } = cachedPeer;

      if (!!peerUser) {
        return Promise.resolve(toBaseUser(peerId, peerUser));
      }
    }
  }

  fetchMessagesHistory(): Promise<ChannelMessages> {
    const result: ChannelMessages = {};
    Object.keys(this.messages).forEach(key => {
      result[key] = toBaseMessage(this.messages[key]);
    });
    return Promise.resolve(result);
  }

  broadcastMessage(userId: string, text: string) {
    const timestamp = (+new Date() / 1000.0).toString();
    const message: VslsChatMessage = {
      userId,
      text,
      timestamp
    };
    this.sharedService.notify(NOTIFICATION_NAME.message, message);
    this.updateMessages(message);
    this.messages[timestamp] = message;
  }

  sendMessage(text: string, userId: string, channelId: string) {
    this.broadcastMessage(userId, text);
    return Promise.resolve();
  }

  updateCachedPeers(addedPeers: vsls.Peer[], removedPeers: vsls.Peer[]) {
    const updated = [...this.cachedPeers, ...addedPeers, ...removedPeers];
    const uniquePeers = updated.filter(
      (peer, index, self) =>
        index === self.findIndex(t => t.peerNumber === peer.peerNumber)
    );
    this.cachedPeers = uniquePeers;
  }
}
