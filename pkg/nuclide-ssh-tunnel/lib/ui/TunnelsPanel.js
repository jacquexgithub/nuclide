/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import type {AppState, Store} from '../types';
import type {Props} from './TunnelsPanelContents';

import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {createObservableForTunnel} from '../CreateObservables';
import * as Actions from '../redux/Actions';
import {Observable} from 'rxjs';
import {TunnelsPanelContents} from './TunnelsPanelContents';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import * as React from 'react';

export const WORKSPACE_VIEW_URI = 'atom://nuclide/ssh-tunnels';

export class TunnelsPanel {
  _store: Store;
  _wat: any;

  constructor(store: Store) {
    this._store = store;
  }

  getTitle() {
    return 'SSH tunnels';
  }

  getIconName() {
    return 'milestone';
  }

  getPreferredWidth(): number {
    return 400;
  }

  getDefaultLocation(): string {
    return 'right';
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  getElement(): HTMLElement {
    // $FlowFixMe: We need to teach Flow about Symbol.observable
    const states: Observable<AppState> = Observable.from(this._store);

    const props: Observable<Props> = states.map((state: AppState) => {
      let workingDirectoryHost;
      if (state.currentWorkingDirectory == null) {
        workingDirectoryHost = null;
      } else {
        const path = state.currentWorkingDirectory;
        if (nuclideUri.isLocal(path)) {
          workingDirectoryHost = 'localhost';
        } else {
          workingDirectoryHost = nuclideUri.getHostname(path);
        }
      }
      return {
        tunnels: state.tunnels.toList(),
        openTunnel: tunnel => {
          let noMoreNotifications = false;
          createObservableForTunnel(tunnel, this._store)
            .do(() => (noMoreNotifications = true))
            .subscribe({
              error: e => {
                if (!noMoreNotifications) {
                  atom.notifications.addError('Failed to open tunnel', {
                    detail: e.code,
                    dismissable: true,
                  });
                }
              },
            });
        },
        closeTunnel: tunnel =>
          this._store.dispatch(
            Actions.closeTunnel(tunnel, new Error('Closed from panel')),
          ),
        workingDirectoryHost,
      };
    });

    const BoundPanelContents = bindObservableAsProps(
      props,
      TunnelsPanelContents,
    );
    return renderReactRoot(<BoundPanelContents />);
  }

  serialize(): {deserializer: string} {
    return {
      deserializer: 'nuclide.SshTunnelsPanel',
    };
  }
}
