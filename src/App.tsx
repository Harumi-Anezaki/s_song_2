/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StoreProvider } from './store/StoreContext';
import Layout from './components/Layout';

export default function App() {
  return (
    <StoreProvider>
      <Layout />
    </StoreProvider>
  );
}
