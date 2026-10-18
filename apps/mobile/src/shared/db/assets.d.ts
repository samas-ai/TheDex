/** Metro resolves `require('…/thedex-data.db')` to an asset module id (see metro.config.js). */
declare module '*.db' {
  const assetId: number;
  export default assetId;
}
