// Chrome extension type definitions
declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      tab?: chrome.tabs.Tab;
      frameId?: number;
      id?: string;
      url?: string;
      tlsChannelId?: string;
    }

    interface Port {
      name: string;
      disconnect(): void;
      onDisconnect: chrome.events.Event<(port: Port) => void>;
      onMessage: chrome.events.Event<(message: any, port: Port) => void>;
      postMessage(message: any): void;
      sender?: MessageSender;
    }

    interface InstalledDetails {
      reason: string;
      previousVersion?: string;
      id?: string;
    }

    const onInstalled: chrome.events.Event<(details: InstalledDetails) => void>;
    const onMessage: chrome.events.Event<(message: any, sender: MessageSender, sendResponse: (response?: any) => void) => boolean | void>;
    
    function sendMessage(message: any, responseCallback?: (response: any) => void): void;
    function sendMessage(extensionId: string, message: any, responseCallback?: (response: any) => void): void;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      index: number;
      windowId: number;
      openerTabId?: number;
      selected: boolean;
      highlighted: boolean;
      active: boolean;
      pinned: boolean;
      audible?: boolean;
      discarded: boolean;
      autoDiscardable: boolean;
      mutedInfo?: MutedInfo;
      url?: string;
      title?: string;
      favIconUrl?: string;
      status?: string;
      incognito: boolean;
      width?: number;
      height?: number;
      sessionId?: string;
    }

    interface MutedInfo {
      muted: boolean;
      reason?: string;
      extensionId?: string;
    }

    function query(queryInfo: any, callback: (result: Tab[]) => void): void;
    function sendMessage(tabId: number, message: any, responseCallback?: (response: any) => void): void;
  }

  namespace storage {
    interface StorageArea {
      get(callback: (items: { [key: string]: any }) => void): void;
      get(keys: string | string[] | { [key: string]: any } | null, callback: (items: { [key: string]: any }) => void): void;
      getBytesInUse(callback: (bytesInUse: number) => void): void;
      getBytesInUse(keys: string | string[] | null, callback: (bytesInUse: number) => void): void;
      set(items: { [key: string]: any }, callback?: () => void): void;
      remove(keys: string | string[], callback?: () => void): void;
      clear(callback?: () => void): void;
    }

    const local: StorageArea;
    const sync: StorageArea;
    const managed: StorageArea;
  }

  namespace events {
    interface Event<T extends Function> {
      addListener(callback: T): void;
      removeListener(callback: T): void;
      hasListener(callback: T): boolean;
    }
  }
}