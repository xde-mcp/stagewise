import { WebContentsView, shell, session, app } from 'electron';
import { domCodeToElectronKeyCode } from '../../utils/dom-code-to-electron-key-code';
import path from 'node:path';
import contextMenu from 'electron-context-menu';
import type { Logger } from '../logger';
import { EventEmitter } from 'node:events';
import { KartonService } from '../karton';
import type { SerializableKeyboardEvent } from '@shared/karton-contracts/web-contents-preload';
import type { ColorScheme } from '@shared/karton-contracts/ui';
import type { PageTransition } from '@shared/karton-contracts/pages-api/types';
import type { SelectedElement } from '@shared/selected-elements';
import { fileURLToPath } from 'node:url';
import { canBrowserHandleUrl } from './protocol-utils';
import {
  default as installExtension,
  REACT_DEVELOPER_TOOLS,
} from 'electron-devtools-installer';

const UI_SESSION_PARTITION = 'persist:stagewise-ui';

/**
 * Installs React DevTools extension on the UI session.
 * Must be called before creating any WebContentsView that uses the UI session.
 */
async function installReactDevToolsOnUISession(logger: Logger): Promise<void> {
  if (app.isPackaged) return; // Don't install in production

  try {
    // Get the UI session (creates it if it doesn't exist)
    const uiSession = session.fromPartition(UI_SESSION_PARTITION);

    // First, use electron-devtools-installer to download/cache the extension
    // This returns extension info including the path
    const extensionInfo = await installExtension(REACT_DEVELOPER_TOOLS, {
      loadExtensionOptions: { allowFileAccess: true },
      forceDownload: false,
    });

    // Now load the extension explicitly on the UI session
    // electron-devtools-installer loads on defaultSession, but we need it on UI session
    const extensionPath =
      typeof extensionInfo === 'object' && extensionInfo.path
        ? extensionInfo.path
        : null;
    if (!extensionPath) {
      logger.warn(
        '[UIController] Could not determine React DevTools extension path',
      );
      return;
    }

    // Load extension on the UI session specifically
    const loadedExtension = await uiSession.extensions.loadExtension(
      extensionPath,
      {
        allowFileAccess: true,
      },
    );
    logger.debug(
      `[UIController] Loaded React DevTools on UI session: ${loadedExtension.name}`,
    );
  } catch (err) {
    logger.warn('[UIController] Failed to install React DevTools:', err);
  }
}

// These are injected by the build system
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

export interface UIControllerEventMap {
  uiReady: [];
  createTab: [url?: string, setActive?: boolean];
  closeTab: [tabId: string];
  switchTab: [tabId: string];
  reorderTabs: [tabIds: string[]];
  layoutUpdate: [
    bounds: { x: number; y: number; width: number; height: number } | null,
  ];
  movePanelToForeground: [panel: 'stagewise-ui' | 'tab-content'];
  togglePanelKeyboardFocus: [panel: 'stagewise-ui' | 'tab-content'];
  stop: [tabId?: string];
  reload: [tabId?: string];
  trustCertificateAndReload: [tabId: string, origin: string];
  goto: [url: string, tabId?: string, transition?: PageTransition];
  goBack: [tabId?: string];
  goForward: [tabId?: string];
  // DevTools events are handled by DevToolAPIService
  setAudioMuted: [muted: boolean, tabId?: string];
  toggleAudioMuted: [tabId?: string];
  setColorScheme: [scheme: ColorScheme, tabId?: string];
  cycleColorScheme: [tabId?: string];
  setZoomPercentage: [percentage: number, tabId?: string];
  setContextSelectionMode: [active: boolean];
  setContextSelectionMouseCoordinates: [x: number, y: number];
  clearContextSelectionMouseCoordinates: [];
  passthroughWheelEvent: [
    event: {
      type: 'wheel';
      x: number;
      y: number;
      deltaX: number;
      deltaY: number;
    },
  ];
  selectHoveredElement: [];
  removeElement: [elementId: string];
  clearElements: [];
  restoreElements: [elements: SelectedElement[]];
  clearPendingScreenshots: [];
  scrollToElement: [tabId: string, backendNodeId: number, frameId: string];
  checkFrameValidity: [
    tabId: string,
    frameId: string,
    expectedFrameLocation: string,
  ];
  startSearchInPage: [searchText: string, tabId?: string];
  updateSearchInPageText: [searchText: string, tabId?: string];
  nextSearchResult: [tabId?: string];
  previousSearchResult: [tabId?: string];
  stopSearchInPage: [tabId?: string];
  activateSearchBar: [];
  deactivateSearchBar: [];
  // Permission handling events
  acceptPermission: [requestId: string];
  rejectPermission: [requestId: string];
  alwaysAllowPermission: [requestId: string];
  alwaysBlockPermission: [requestId: string];
  selectPermissionDevice: [requestId: string, deviceId: string];
  respondToBluetoothPairing: [
    requestId: string,
    confirmed: boolean,
    pin?: string,
  ];
  // Authentication handling events
  submitAuthCredentials: [
    requestId: string,
    username: string,
    password: string,
  ];
  cancelAuth: [requestId: string];
}

export class UIController extends EventEmitter<UIControllerEventMap> {
  private view: WebContentsView;
  private logger: Logger;
  public readonly uiKarton: KartonService;
  private checkFrameValidityHandler?: (
    tabId: string,
    frameId: string,
    expectedFrameLocation: string,
  ) => Promise<boolean>;
  private checkElementExistsHandler?: (
    tabId: string,
    backendNodeId: number,
    frameId: string,
  ) => Promise<boolean>;

  /**
   * Creates a new UIController instance with React DevTools installed.
   * This must be used instead of the constructor to ensure DevTools are loaded
   * on the session before the WebContentsView is created.
   */
  public static async create(logger: Logger): Promise<UIController> {
    // Install React DevTools on the UI session BEFORE creating the WebContentsView
    await installReactDevToolsOnUISession(logger);
    return new UIController(logger);
  }

  /**
   * Creates a new UIController instance.
   * Use the static `create()` method instead of calling this directly.
   */
  private constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.uiKarton = new KartonService(logger);

    this.view = new WebContentsView({
      webPreferences: {
        preload: path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          'ui-preload/index.js',
        ),
        partition: UI_SESSION_PARTITION,
      },
    });

    this.view.setBackgroundColor('#00000000');
    this.view.webContents.setWindowOpenHandler((details) => {
      // Check if the browser can handle this URL's protocol
      if (!canBrowserHandleUrl(details.url)) {
        // Open in external application (mailto:, tel:, vscode:, etc.)
        this.logger.debug(
          `[UIController] Opening URL with external handler: ${details.url}`,
        );
        shell.openExternal(details.url);
        return { action: 'deny' };
      }

      // Check disposition to determine if tab should be opened in background
      // disposition can be: 'default', 'foreground-tab', 'background-tab', 'new-window', etc.
      const setActive = details.disposition !== 'background-tab';
      this.emit('createTab', details.url, setActive);
      return { action: 'deny' };
    });

    contextMenu({
      showSaveImage: false,
      showSaveImageAs: false,
      showCopyLink: false,
      showSearchWithGoogle: false,
      showSelectAll: false,
      showServices: false,
      showLookUpSelection: false,
      showInspectElement: false,
      window: this.view.webContents,
    });

    if (process.env.NODE_ENV === 'development') {
      this.view.webContents.openDevTools();
    }

    // Listen for the UI finishing load to ensure proper rendering
    this.view.webContents.once('did-finish-load', () => {
      this.logger.debug(
        '[UIController] UI finished loading, invalidating view',
      );
      // Force a repaint after UI loads to prevent invisible UI bug
      const bounds = this.view.getBounds();
      this.view.setBounds({ ...bounds });
      // Emit event so WindowLayoutService can trigger initial layout check
      this.emit('uiReady');
    });

    this.loadApp();
    this.registerKartonProcedures();
  }

  private loadApp() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      this.view.webContents.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      this.view.webContents.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      );
    }
    this.logger.debug('[UIController] UI content view loaded');
  }

  private registerKartonProcedures() {
    this.uiKarton.registerServerProcedureHandler(
      'browser.createTab',
      async (_callingClientId: string, url?: string, setActive?: boolean) => {
        this.emit('createTab', url, setActive);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.closeTab',
      async (_callingClientId: string, tabId: string) => {
        this.emit('closeTab', tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.switchTab',
      async (_callingClientId: string, tabId: string) => {
        this.emit('switchTab', tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.reorderTabs',
      async (_callingClientId: string, tabIds: string[]) => {
        this.emit('reorderTabs', tabIds);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.layout.update',
      async (
        _callingClientId: string,
        bounds: { x: number; y: number; width: number; height: number } | null,
      ) => {
        this.emit('layoutUpdate', bounds);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.layout.movePanelToForeground',
      async (
        _callingClientId: string,
        panel: 'stagewise-ui' | 'tab-content',
      ) => {
        this.emit('movePanelToForeground', panel);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.layout.togglePanelKeyboardFocus',
      async (
        _callingClientId: string,
        panel: 'stagewise-ui' | 'tab-content',
      ) => {
        this.emit('togglePanelKeyboardFocus', panel);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.stop',
      async (_callingClientId: string, tabId?: string) => {
        this.emit('stop', tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.reload',
      async (_callingClientId: string, tabId?: string) => {
        this.emit('reload', tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.trustCertificateAndReload',
      async (_callingClientId: string, tabId: string, origin: string) => {
        this.emit('trustCertificateAndReload', tabId, origin);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.goto',
      async (
        _callingClientId: string,
        url: string,
        tabId?: string,
        transition?: PageTransition,
      ) => {
        this.emit('goto', url, tabId, transition);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.goBack',
      async (_callingClientId: string, tabId?: string) => {
        this.emit('goBack', tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.goForward',
      async (_callingClientId: string, tabId?: string) => {
        this.emit('goForward', tabId);
      },
    );
    // DevTools procedures are registered by DevToolAPIService
    this.uiKarton.registerServerProcedureHandler(
      'browser.setAudioMuted',
      async (_callingClientId: string, muted: boolean, tabId?: string) => {
        this.emit('setAudioMuted', muted, tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.toggleAudioMuted',
      async (_callingClientId: string, tabId?: string) => {
        this.emit('toggleAudioMuted', tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.setColorScheme',
      async (_callingClientId: string, scheme: ColorScheme, tabId?: string) => {
        this.emit('setColorScheme', scheme, tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.cycleColorScheme',
      async (_callingClientId: string, tabId?: string) => {
        this.emit('cycleColorScheme', tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.setZoomPercentage',
      async (_callingClientId: string, percentage: number, tabId?: string) => {
        this.emit('setZoomPercentage', percentage, tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.contextSelection.setActive',
      async (_callingClientId: string, active: boolean) => {
        this.emit('setContextSelectionMode', active);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.contextSelection.setMouseCoordinates',
      async (_callingClientId: string, x: number, y: number) => {
        this.emit('setContextSelectionMouseCoordinates', x, y);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.contextSelection.clearMouseCoordinates',
      async (_callingClientId: string) => {
        this.emit('clearContextSelectionMouseCoordinates');
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.contextSelection.passthroughWheelEvent',
      async (_callingClientId: string, event) => {
        this.emit('passthroughWheelEvent', event);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.contextSelection.selectHoveredElement',
      async (_callingClientId: string) => {
        // TODO: Implement by adding the element to the chat state controller.
        this.emit('selectHoveredElement');
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.contextSelection.removeElement',
      async (_callingClientId: string, elementId: string) => {
        this.emit('removeElement', elementId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.contextSelection.clearElements',
      async (_callingClientId: string) => {
        this.emit('clearElements');
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.contextSelection.restoreElements',
      async (_callingClientId: string, elements: SelectedElement[]) => {
        this.emit('restoreElements', elements);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.contextSelection.clearPendingScreenshots',
      async (_callingClientId: string) => {
        this.emit('clearPendingScreenshots');
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.scrollToElement',
      async (
        _callingClientId: string,
        tabId: string,
        backendNodeId: number,
        frameId: string,
      ) => {
        this.emit('scrollToElement', tabId, backendNodeId, frameId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.checkFrameValidity',
      async (
        _callingClientId: string,
        tabId: string,
        frameId: string,
        expectedFrameLocation: string,
      ) => {
        if (this.checkFrameValidityHandler) {
          return await this.checkFrameValidityHandler(
            tabId,
            frameId,
            expectedFrameLocation,
          );
        }
        return false;
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.checkElementExists',
      async (
        _callingClientId: string,
        tabId: string,
        backendNodeId: number,
        frameId: string,
      ) => {
        if (this.checkElementExistsHandler) {
          return await this.checkElementExistsHandler(
            tabId,
            backendNodeId,
            frameId,
          );
        }
        return false;
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.searchInPage.start',
      async (_callingClientId: string, searchText: string, tabId?: string) => {
        this.emit('startSearchInPage', searchText, tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.searchInPage.updateText',
      async (_callingClientId: string, searchText: string, tabId?: string) => {
        this.emit('updateSearchInPageText', searchText, tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.searchInPage.next',
      async (_callingClientId: string, tabId?: string) => {
        this.emit('nextSearchResult', tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.searchInPage.previous',
      async (_callingClientId: string, tabId?: string) => {
        this.emit('previousSearchResult', tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.searchInPage.stop',
      async (_callingClientId: string, tabId?: string) => {
        this.emit('stopSearchInPage', tabId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.searchBar.activate',
      async (_callingClientId: string) => {
        this.emit('activateSearchBar');
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.searchBar.deactivate',
      async (_callingClientId: string) => {
        this.emit('deactivateSearchBar');
      },
    );

    // Permission handling procedures
    this.uiKarton.registerServerProcedureHandler(
      'browser.permissions.accept',
      async (_callingClientId: string, requestId: string) => {
        this.emit('acceptPermission', requestId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.permissions.reject',
      async (_callingClientId: string, requestId: string) => {
        this.emit('rejectPermission', requestId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.permissions.selectDevice',
      async (_callingClientId: string, requestId: string, deviceId: string) => {
        this.emit('selectPermissionDevice', requestId, deviceId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.permissions.respondToPairing',
      async (
        _callingClientId: string,
        requestId: string,
        confirmed: boolean,
        pin?: string,
      ) => {
        this.emit('respondToBluetoothPairing', requestId, confirmed, pin);
      },
    );

    // "Always" permission responses - saves to preferences for future requests
    this.uiKarton.registerServerProcedureHandler(
      'browser.permissions.alwaysAllow',
      async (_callingClientId: string, requestId: string) => {
        this.emit('alwaysAllowPermission', requestId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.permissions.alwaysBlock',
      async (_callingClientId: string, requestId: string) => {
        this.emit('alwaysBlockPermission', requestId);
      },
    );

    // Authentication handling procedures
    this.uiKarton.registerServerProcedureHandler(
      'browser.auth.submit',
      async (
        _callingClientId: string,
        requestId: string,
        username: string,
        password: string,
      ) => {
        this.emit('submitAuthCredentials', requestId, username, password);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'browser.auth.cancel',
      async (_callingClientId: string, requestId: string) => {
        this.emit('cancelAuth', requestId);
      },
    );
  }

  public forwardFocusEvent(tabId: string) {
    this.view.webContents.send('stagewise-tab-focused', tabId);
  }

  public forwardKeyDownEvent(key: SerializableKeyboardEvent) {
    const electronKeyCode = domCodeToElectronKeyCode(key.code, key.key);
    const modifiers = [
      key.ctrlKey ? ('control' as const) : undefined,
      key.altKey ? ('alt' as const) : undefined,
      key.shiftKey ? ('shift' as const) : undefined,
      key.metaKey ? ('meta' as const) : undefined,
    ].filter(Boolean) as ('control' | 'alt' | 'shift' | 'meta')[];

    this.view.webContents.sendInputEvent({
      type: 'keyDown',
      keyCode: electronKeyCode,
      modifiers,
    });
  }

  public setCheckFrameValidityHandler(
    handler: (
      tabId: string,
      frameId: string,
      expectedFrameLocation: string,
    ) => Promise<boolean>,
  ) {
    this.checkFrameValidityHandler = handler;
  }

  public setCheckElementExistsHandler(
    handler: (
      tabId: string,
      backendNodeId: number,
      frameId: string,
    ) => Promise<boolean>,
  ) {
    this.checkElementExistsHandler = handler;
  }

  public unregisterKartonProcedures() {
    this.uiKarton.removeServerProcedureHandler('browser.createTab');
    this.uiKarton.removeServerProcedureHandler('browser.closeTab');
    this.uiKarton.removeServerProcedureHandler('browser.switchTab');
    this.uiKarton.removeServerProcedureHandler('browser.reorderTabs');
    this.uiKarton.removeServerProcedureHandler('browser.layout.update');
    this.uiKarton.removeServerProcedureHandler(
      'browser.layout.movePanelToForeground',
    );
    this.uiKarton.removeServerProcedureHandler(
      'browser.layout.togglePanelKeyboardFocus',
    );
    this.uiKarton.removeServerProcedureHandler('browser.stop');
    this.uiKarton.removeServerProcedureHandler('browser.reload');
    this.uiKarton.removeServerProcedureHandler(
      'browser.trustCertificateAndReload',
    );
    this.uiKarton.removeServerProcedureHandler('browser.goto');
    this.uiKarton.removeServerProcedureHandler('browser.goBack');
    this.uiKarton.removeServerProcedureHandler('browser.goForward');
    // DevTools procedure handlers are removed by DevToolAPIService
    this.uiKarton.removeServerProcedureHandler('browser.setAudioMuted');
    this.uiKarton.removeServerProcedureHandler('browser.toggleAudioMuted');
    this.uiKarton.removeServerProcedureHandler('browser.setColorScheme');
    this.uiKarton.removeServerProcedureHandler('browser.cycleColorScheme');
    this.uiKarton.removeServerProcedureHandler('browser.setZoomPercentage');
    this.uiKarton.removeServerProcedureHandler(
      'browser.contextSelection.setActive',
    );
    this.uiKarton.removeServerProcedureHandler(
      'browser.contextSelection.setMouseCoordinates',
    );
    this.uiKarton.removeServerProcedureHandler(
      'browser.contextSelection.selectHoveredElement',
    );
    this.uiKarton.removeServerProcedureHandler(
      'browser.contextSelection.removeElement',
    );
    this.uiKarton.removeServerProcedureHandler(
      'browser.contextSelection.clearElements',
    );
    // Note: Removing handlers by reference is tricky if we use arrow functions or inline handlers.
    // The karton service implementation likely matches by name or needs exact reference.
    // Assuming we might just need to unregister all or handle lifecycle properly.
    // For now, since these are anonymous, removal might not work perfectly unless we store references.
    // However, UIController is likely long-lived or destroyed on app exit.
  }

  public getView(): WebContentsView {
    return this.view;
  }

  public setBounds(bounds: Electron.Rectangle) {
    this.view.setBounds(bounds);
  }

  public toggleDevTools() {
    this.view.webContents.toggleDevTools();
  }

  public focus() {
    this.view.webContents.focus();
  }
}
