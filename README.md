# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies on server dir
   
   ```bash
   chdir server && npm install
   ```
   
2. Run backend server
   
   ```bash
   npm run dev
   ```
3. On a new terminal, install dependencies on root folder

   ```bash
   npm install
   ```

4. Start the app

   ```bash
   npx expo start
   ```

5. Scan the QR code on an iOS device with Expo Go installed


## One-click experience using Apple Widget:
`/components/onramp/ApplePayWidget.tsx`
* Render Payment Link as WebView
* Listen to post message Event [`onramp_api.load_success`] (https://docs.cdp.coinbase.com/onramp-&-offramp/onramp-apis/apple-pay-onramp-api).
* Inject CSS to hide button + click 
